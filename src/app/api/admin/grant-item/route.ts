import { NextResponse } from "next/server";
import { z } from "zod";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebaseAdmin";
import { getItemById } from "@/data/items";
import { LIMITS } from "@/lib/constants";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const RequestSchema = z.object({
  uid: z.string().min(6).max(128).regex(/^[A-Za-z0-9:_-]+$/),
  itemId: z.string().min(1).max(128),
  quantity: z.number().int().min(1).max(99).optional(),
  note: z.string().max(200).optional(),
});

const getAdminKeyFromRequest = (req: Request): string => {
  const headerKey = req.headers.get("x-admin-api-key");
  if (headerKey) return headerKey.trim();

  const auth = req.headers.get("authorization");
  if (!auth) return "";
  const [scheme, token] = auth.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) return "";
  return token.trim();
};

type InventoryEntry = {
  itemId: string;
  quantity: number;
  obtainedAt: string;
};

export async function POST(req: Request) {
  try {
    const expectedKey = process.env.ADMIN_API_KEY;
    if (!expectedKey) {
      return NextResponse.json(
        { error: "ADMIN_API_KEY is not configured" },
        { status: 500 }
      );
    }

    const requestKey = getAdminKeyFromRequest(req);
    if (!requestKey || requestKey !== expectedKey) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const parsed = RequestSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid request body",
          issues: parsed.error.issues.map((i) => ({
            path: i.path.join("."),
            message: i.message,
          })),
        },
        { status: 400 }
      );
    }

    const { uid, itemId, quantity: requestedQty = 1, note } = parsed.data;

    const item = getItemById(itemId);
    if (!item) {
      return NextResponse.json(
        { error: "Unknown itemId", itemId },
        { status: 400 }
      );
    }

    const userRef = adminDb.collection("users").doc(uid);
    const snap = await userRef.get();
    if (!snap.exists) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    const currentInventory = (snap.data()?.inventory ?? []) as InventoryEntry[];
    const now = new Date().toISOString();
    const maxStack = LIMITS.INVENTORY?.MAX_STACK ?? 99;

    const existingIndex = currentInventory.findIndex(
      (e) => e.itemId === itemId
    );
    let newInventory: InventoryEntry[];
    let actualGranted: number;

    if (existingIndex >= 0) {
      const entry = currentInventory[existingIndex];
      actualGranted = Math.min(requestedQty, maxStack - entry.quantity);
      if (actualGranted <= 0) {
        return NextResponse.json(
          {
            error: "Stack limit reached",
            itemId,
            currentQuantity: entry.quantity,
            maxStack,
          },
          { status: 400 }
        );
      }
      const newQty = entry.quantity + actualGranted;
      newInventory = [...currentInventory];
      newInventory[existingIndex] = {
        ...entry,
        quantity: newQty,
      };
    } else {
      actualGranted = Math.min(requestedQty, maxStack);
      newInventory = [
        ...currentInventory,
        { itemId, quantity: actualGranted, obtainedAt: now },
      ];
    }

    await userRef.set(
      {
        inventory: newInventory,
        updatedAt: now,
        adminOps: {
          lastItemGrant: {
            uid,
            itemId,
            quantity: requestedQty,
            at: now,
            note: note ?? "",
          },
        },
      },
      { merge: true }
    );

    try {
      await adminDb.collection("admin_actions").add({
        action: "grant_item",
        uid,
        itemId,
        quantity: requestedQty,
        note: note ?? "",
        createdAt: FieldValue.serverTimestamp(),
      });
    } catch (auditErr) {
      console.warn("[grant-item] failed to write admin_actions:", auditErr);
    }

    const grantedEntry = newInventory.find((e) => e.itemId === itemId);
    return NextResponse.json({
      success: true,
      uid,
      itemId,
      itemName: item.name,
      quantityGranted: actualGranted,
      inventoryAfter: grantedEntry?.quantity ?? 0,
      grantedAt: now,
    });
  } catch (error) {
    console.error("[grant-item] error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
