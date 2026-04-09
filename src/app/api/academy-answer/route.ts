import { NextResponse } from 'next/server';
import { z } from 'zod';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebaseAdmin';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const USER_COLLECTION = 'academy_questions';
const OFFICIAL_COLLECTION = 'academy_official_questions';
const STATS_COLLECTION = 'academy_question_stats';

const AnswerItemSchema = z.object({
  questionId: z.string().min(1).max(200),
  isCorrect: z.boolean(),
  selectedChoiceIndex: z.number().int().min(0).max(3).nullable().optional(),
});

const BodySchema = z.union([
  z.object({
    questionId: z.string().min(1).max(200),
    isCorrect: z.boolean(),
  }),
  z.object({
    answers: z.array(AnswerItemSchema).min(1).max(200),
  }),
]);

type AggregatedAnswer = {
  playInc: number;
  correctInc: number;
  choicePickInc: [number, number, number, number];
};

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

    const answers =
      'answers' in parsed.data
        ? parsed.data.answers
        : [{ questionId: parsed.data.questionId, isCorrect: parsed.data.isCorrect }];

    const aggregated = new Map<string, AggregatedAnswer>();
    for (const answer of answers) {
      const current = aggregated.get(answer.questionId);
      if (current) {
        current.playInc += 1;
        if (answer.isCorrect) current.correctInc += 1;
      } else {
        aggregated.set(answer.questionId, {
          playInc: 1,
          correctInc: answer.isCorrect ? 1 : 0,
          choicePickInc: [0, 0, 0, 0],
        });
      }
      const selectedChoiceIndex =
        typeof answer.selectedChoiceIndex === 'number' ? answer.selectedChoiceIndex : null;
      if (selectedChoiceIndex !== null && selectedChoiceIndex >= 0 && selectedChoiceIndex <= 3) {
        const target = aggregated.get(answer.questionId);
        if (target) {
          target.choicePickInc[selectedChoiceIndex] += 1;
        }
      }
    }

    const notFoundIds: string[] = [];
    let persistedCount = 0;

    for (const [questionId, inc] of aggregated.entries()) {
      const userRef = adminDb.collection(USER_COLLECTION).doc(questionId);
      const officialRef = adminDb.collection(OFFICIAL_COLLECTION).doc(questionId);
      const userSnap = await userRef.get();
      const officialSnap = userSnap.exists ? null : await officialRef.get();
      const targetRef = userSnap.exists ? userRef : officialSnap?.exists ? officialRef : null;

      if (!targetRef) {
        notFoundIds.push(questionId);
        continue;
      }

      const statsRef = adminDb.collection(STATS_COLLECTION).doc(questionId);
      const updatePayload: Record<string, unknown> = {
        playCount: FieldValue.increment(inc.playInc),
        updatedAt: FieldValue.serverTimestamp(),
      };
      if (inc.correctInc > 0) {
        updatePayload.correctCount = FieldValue.increment(inc.correctInc);
      }
      if (inc.choicePickInc[0] > 0) updatePayload.choicePick0 = FieldValue.increment(inc.choicePickInc[0]);
      if (inc.choicePickInc[1] > 0) updatePayload.choicePick1 = FieldValue.increment(inc.choicePickInc[1]);
      if (inc.choicePickInc[2] > 0) updatePayload.choicePick2 = FieldValue.increment(inc.choicePickInc[2]);
      if (inc.choicePickInc[3] > 0) updatePayload.choicePick3 = FieldValue.increment(inc.choicePickInc[3]);

      await statsRef.set(updatePayload, { merge: true });
      persistedCount += 1;
    }

    return NextResponse.json({
      success: true,
      persisted: persistedCount > 0,
      persistedCount,
      total: aggregated.size,
      notFoundIds,
    });
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

