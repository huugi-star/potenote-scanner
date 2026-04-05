import { NextResponse } from 'next/server';
import { z } from 'zod';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebaseAdmin';
import { ACADEMY_SEED_QUESTIONS } from '@/data/academySeedQuestions';

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

    // Firestore未作成でも seed に同一idがあれば初回作成して集計を永続化する
    if (!snap.exists) {
      const seed = ACADEMY_SEED_QUESTIONS.find((q) => q.id === questionId);
      if (!seed) {
        return NextResponse.json({ success: true, persisted: false, reason: 'not_found' });
      }

      await ref.set({
        id: questionId,
        status: 'published',
        authorUid: seed.authorUid ?? 'official_seed',
        authorName: String(seed.authorName ?? '').trim() || '公式問題',
        question: seed.question,
        choices: seed.choices,
        answerIndex: seed.answerIndex,
        explanation: seed.explanation,
        keywords: Array.isArray(seed.keywords) ? seed.keywords : [],
        bigCategory: seed.bigCategory ?? null,
        subCategory: seed.subCategory ?? null,
        subjectText: seed.subjectText ?? null,
        detailText: seed.detailText ?? null,
        playCount: 1,
        correctCount: isCorrect ? 1 : 0,
        goodCount: 0,
        badCount: 0,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      return NextResponse.json({ success: true, persisted: true, createdFromSeed: true });
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

