import { NextResponse } from 'next/server';
import { z } from 'zod';
import { FieldValue } from 'firebase-admin/firestore';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const BodySchema = z.object({
  question: z.string().min(1).max(1000),
  choices: z.array(z.string().min(1).max(300)).length(4),
  answerIndex: z.number().int().min(0).max(3),
  explanation: z.string().max(4000),
  keywords: z.array(z.string().min(1).max(80)).max(8).optional().default([]),
  bigCategory: z.string().max(100).optional(),
  subCategory: z.string().max(100).optional(),
  subjectText: z.string().max(200).optional(),
  detailText: z.string().max(1200).optional(),
});

const getBearerToken = (req: Request): string | null => {
  const auth = req.headers.get('authorization');
  if (!auth) return null;
  const [scheme, token] = auth.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) return null;
  return token.trim();
};

export async function POST(req: Request) {
  try {
    const idToken = getBearerToken(req);
    if (!idToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const decoded = await adminAuth.verifyIdToken(idToken);
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

    const uid = decoded.uid;
    const data = parsed.data;
    const docRef = adminDb.collection('academy_questions').doc();

    await docRef.set({
      id: docRef.id,
      status: 'published',
      authorUid: uid,
      authorName: decoded.name ?? '匿名ユーザー',
      question: data.question.trim(),
      choices: data.choices.map((c) => c.trim()),
      answerIndex: data.answerIndex,
      explanation: data.explanation.trim(),
      keywords: (data.keywords ?? []).map((k) => k.trim()).filter(Boolean).slice(0, 8),
      bigCategory: data.bigCategory?.trim() || null,
      subCategory: data.subCategory?.trim() || null,
      subjectText: data.subjectText?.trim() || null,
      detailText: data.detailText?.trim() || null,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ success: true, id: docRef.id });
  } catch (error) {
    console.error('[academy-submit] failed:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
