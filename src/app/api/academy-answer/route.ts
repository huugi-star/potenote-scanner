import { NextResponse } from 'next/server';
import { z } from 'zod';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebaseAdmin';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const USER_COLLECTION = 'academy_questions';
const OFFICIAL_COLLECTION = 'academy_official_questions';

const BodySchema = z.object({
  questionId: z.string().min(1).max(200),
  isCorrect: z.boolean(),
});

export async function POST(req: Request) {
  try {
    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'Invalid body',
          issues: parsed.error.issues.map((i) => ({
            path: i.path.join('.'),
            message: i.message,
          })),
        },
        { status: 400 }
      );
    }

    const { questionId, isCorrect } = parsed.data;
    const userRef = adminDb.collection(USER_COLLECTION).doc(questionId);
    const officialRef = adminDb.collection(OFFICIAL_COLLECTION).doc(questionId);
    const userSnap = await userRef.get();
    const officialSnap = userSnap.exists ? null : await officialRef.get();
    const targetRef = userSnap.exists ? userRef : officialSnap?.exists ? officialRef : null;

    if (!targetRef) {
      return NextResponse.json({ success: true, persisted: false, reason: 'not_found' });
    }

    const updatePayload: Record<string, unknown> = {
      playCount: FieldValue.increment(1),
      updatedAt: FieldValue.serverTimestamp(),
    };
    if (isCorrect) {
      updatePayload.correctCount = FieldValue.increment(1);
    }

    await targetRef.set(updatePayload, { merge: true });
    return NextResponse.json({ success: true, persisted: true });
  } catch (error) {
    const code = String((error as { code?: string } | undefined)?.code ?? 'unknown');
    const message = String((error as { message?: string } | undefined)?.message ?? '');
    console.error('[academy-answer] failed:', error);
    return NextResponse.json(
      { error: `INTERNAL_ERROR:${code}${message ? `:${message.slice(0, 160)}` : ''}` },
      { status: 500 }
    );
  }
}

