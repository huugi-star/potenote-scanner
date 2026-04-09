import { NextResponse } from 'next/server';
import { z } from 'zod';
import { adminDb } from '@/lib/firebaseAdmin';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const REACTIONS_COLLECTION = 'academy_question_reactions';
const ReactionSchema = z.union([z.literal('good'), z.literal('bad'), z.null()]);

const BodySchema = z.object({
  voterKey: z.string().min(3).max(200),
  questionIds: z.array(z.string().min(1).max(200)).max(120),
});

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

    const { voterKey, questionIds } = parsed.data;
    if (questionIds.length === 0) {
      return NextResponse.json({ success: true, reactions: {} });
    }

    const uniqueIds = Array.from(new Set(questionIds));
    const refs = uniqueIds.map((questionId) =>
      adminDb.collection(REACTIONS_COLLECTION).doc(buildReactionDocId(questionId, voterKey))
    );
    const snaps = await Promise.all(refs.map((ref) => ref.get()));

    const reactions: Record<string, 'good' | 'bad' | null> = {};
    for (let i = 0; i < uniqueIds.length; i += 1) {
      const snap = snaps[i];
      const reactionRaw = snap.exists ? snap.data()?.reaction : null;
      const parsedReaction = ReactionSchema.safeParse(reactionRaw);
      reactions[uniqueIds[i]] = parsedReaction.success ? parsedReaction.data : null;
    }

    return NextResponse.json({ success: true, reactions });
  } catch (error) {
    const code = String((error as { code?: string } | undefined)?.code ?? 'unknown');
    const message = String((error as { message?: string } | undefined)?.message ?? '');
    console.error('[academy-reaction-state] failed:', error);
    return NextResponse.json(
      { error: `INTERNAL_ERROR:${code}${message ? `:${message.slice(0, 160)}` : ''}` },
      { status: 500 }
    );
  }
}

