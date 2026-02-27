import { NextResponse } from "next/server";
import { z } from "zod";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebaseAdmin";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const RequestSchema = z.object({
  uid: z.string().min(6).max(128).regex(/^[A-Za-z0-9:_-]+$/),
  // 追加で付与するボーナス回数（加算方式）
  bonusAmount: z.number().int().min(1).max(200),
  note: z.string().max(200).optional(),
});

const getTodayString = (): string => {
  return new Date().toISOString().split("T")[0];
};

const getAdminKeyFromRequest = (req: Request): string => {
  const headerKey = req.headers.get("x-admin-api-key");
  if (headerKey) return headerKey.trim();

  const auth = req.headers.get("authorization");
  if (!auth) return "";
  const [scheme, token] = auth.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) return "";
  return token.trim();
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

    const { uid, bonusAmount, note } = parsed.data;
    const today = getTodayString();

    const userRef = adminDb.collection("users").doc(uid);
    const snap = await userRef.get();
    if (!snap.exists) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    const currentUserState = (snap.data()?.userState ?? {}) as {
      dailyScanCount?: number;
      lastScanDate?: string;
      bonusScanBalance?: number;
    };
    const beforeDailyScanCount =
      typeof currentUserState.dailyScanCount === "number"
        ? currentUserState.dailyScanCount
        : 0;
    const beforeLastScanDate = currentUserState.lastScanDate ?? "";
    const beforeBonusScanBalance =
      typeof currentUserState.bonusScanBalance === "number"
        ? currentUserState.bonusScanBalance
        : 0;
    const afterBonusScanBalance = beforeBonusScanBalance + bonusAmount;

    await userRef.set(
      {
        userState: {
          bonusScanBalance: afterBonusScanBalance,
        },
        adminOps: {
          lastScanGrant: {
            uid,
            at: new Date().toISOString(),
            note: note ?? "",
            beforeDailyScanCount,
            beforeLastScanDate,
            beforeBonusScanBalance,
            afterBonusScanBalance,
            bonusAmount,
          },
        },
      },
      { merge: true }
    );

    // 監査ログ（失敗しても本処理は成功扱い）
    try {
      await adminDb.collection("admin_actions").add({
        action: "grant_scan",
        uid,
        note: note ?? "",
        beforeDailyScanCount,
        beforeLastScanDate,
        beforeBonusScanBalance,
        afterBonusScanBalance,
        bonusAmount,
        createdAt: FieldValue.serverTimestamp(),
      });
    } catch (auditErr) {
      console.warn("[grant-scan] failed to write admin_actions:", auditErr);
    }

    return NextResponse.json({
      success: true,
      uid,
      applied: {
        before: {
          dailyScanCount: beforeDailyScanCount,
          lastScanDate: beforeLastScanDate,
          bonusScanBalance: beforeBonusScanBalance,
        },
        after: {
          dailyScanCount: beforeDailyScanCount,
          lastScanDate: beforeLastScanDate,
          bonusScanBalance: afterBonusScanBalance,
        },
        bonusAmount,
        grantedAt: today,
      },
    });
  } catch (error) {
    console.error("[grant-scan] error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
