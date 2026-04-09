import { NextResponse } from 'next/server';
import { z } from 'zod';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebaseAdmin';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const USER_COLLECTION = 'academy_questions';
const OFFICIAL_COLLECTION = 'academy_official_questions';
const STATS_COLLECTION = 'academy_question_stats';
const REACTIONS_COLLECTION = 'academy_question_reactions';

const ReactionSchema = z.union([z.literal('good'), z.literal('bad'), z.null()]);
const BodySchema = z.object({
  questionId: z.string().min(1).max(200),
  voterKey: z.string().min(3).max(200),
  nextReaction: ReactionSchema,
});

const toCount = (value: unknown): number => Math.max(0, Number(value ?? 0));
const toReaction = (value: unknown): 'good' | 'bad' | null =>
  value === 'good' || value === 'bad' ? value : null;
const buildReactionDocId = (questionId: string, voterKey: string): string =>
  `${questionId}__${encodeURIComponent(voterKey)}`;

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

    const { questionId, voterKey, nextReaction } = parsed.data;

    const userRef = adminDb.collection(USER_COLLECTION).doc(questionId);
    const officialRef = adminDb.collection(OFFICIAL_COLLECTION).doc(questionId);
    const userSnap = await userRef.get();
    const officialSnap = userSnap.exists ? null : await officialRef.get();
    const exists = userSnap.exists || !!officialSnap?.exists;
    if (!exists) {
      return NextResponse.json({ success: true, persisted: false, reason: 'not_found' });
    }

    const statsRef = adminDb.collection(STATS_COLLECTION).doc(questionId);
    const reactionRef = adminDb
      .collection(REACTIONS_COLLECTION)
      .doc(buildReactionDocId(questionId, voterKey));
    let finalPreviousReaction: 'good' | 'bad' | null = null;
    let finalNextReaction: 'good' | 'bad' | null = nextReaction;
    let persisted = false;

    await adminDb.runTransaction(async (tx) => {
      const reactionSnap = await tx.get(reactionRef);
      const previousReaction = toReaction(reactionSnap.data()?.reaction);
      finalPreviousReaction = previousReaction;
      finalNextReaction = nextReaction;
      const goodDelta = (nextReaction === 'good' ? 1 : 0) - (previousReaction === 'good' ? 1 : 0);
      const badDelta = (nextReaction === 'bad' ? 1 : 0) - (previousReaction === 'bad' ? 1 : 0);
      if (goodDelta === 0 && badDelta === 0) {
        persisted = false;
        return;
      }

      const statsSnap = await tx.get(statsRef);
      const raw = statsSnap.exists ? statsSnap.data() : {};
      const nextGoodCount = Math.max(0, toCount(raw?.goodCount) + goodDelta);
      const nextBadCount = Math.max(0, toCount(raw?.badCount) + badDelta);
      persisted = true;

      if (nextReaction === null) {
        tx.delete(reactionRef);
      } else {
        tx.set(
          reactionRef,
          {
            questionId,
            voterKey,
            reaction: nextReaction,
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
      }

      tx.set(
        statsRef,
        {
          goodCount: nextGoodCount,
          badCount: nextBadCount,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    });

    if (!persisted) {
      return NextResponse.json({
        success: true,
        persisted: false,
        reason: 'unchanged',
        previousReaction: finalPreviousReaction,
        nextReaction: finalNextReaction,
      });
    }
    return NextResponse.json({
      success: true,
      persisted: true,
      previousReaction: finalPreviousReaction,
      nextReaction: finalNextReaction,
    });
  } catch (error) {
    const code = String((error as { code?: string } | undefined)?.code ?? 'unknown');
    const message = String((error as { message?: string } | undefined)?.message ?? '');
    console.error('[academy-reaction] failed:', error);
    return NextResponse.json(
      { error: `INTERNAL_ERROR:${code}${message ? `:${message.slice(0, 160)}` : ''}` },
      { status: 500 }
    );
  }
}

