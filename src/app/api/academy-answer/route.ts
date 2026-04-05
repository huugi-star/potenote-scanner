import { NextResponse } from 'next/server';
import { z } from 'zod';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebaseAdmin';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

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
    const ref = adminDb.collection('academy_questions').doc(questionId);
    const snap = await ref.get();

    // 公式seed由来の問題でも、Firestoreに同一idがある場合のみ集計を永続化する
    if (!snap.exists) {
      return NextResponse.json({ success: true, persisted: false, reason: 'not_found' });
    }

    const updatePayload: Record<string, unknown> = {
      playCount: FieldValue.increment(1),
      updatedAt: FieldValue.serverTimestamp(),
    };
    if (isCorrect) {
      updatePayload.correctCount = FieldValue.increment(1);
    }

    await ref.set(updatePayload, { merge: true });
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

