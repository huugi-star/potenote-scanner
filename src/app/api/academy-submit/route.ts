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
  const explicitToken = req.headers.get('x-firebase-id-token');
  if (explicitToken && explicitToken.trim()) {
    return explicitToken.trim().replace(/^"|"$/g, '');
  }

  const auth = req.headers.get('authorization');
  if (!auth) return null;
  const normalized = auth.trim().replace(/^"|"$/g, '');
  const [scheme, token] = normalized.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) return null;
  return token.trim().replace(/^"|"$/g, '');
};

export async function POST(req: Request) {
  try {
    const hasProjectId = !!process.env.FIREBASE_PROJECT_ID?.trim();
    const hasClientEmail = !!process.env.FIREBASE_CLIENT_EMAIL?.trim();
    const hasPrivateKey = !!process.env.FIREBASE_PRIVATE_KEY?.trim();
    const privateKeyHasPem = (process.env.FIREBASE_PRIVATE_KEY ?? '').includes('BEGIN');
    if (!hasProjectId || !hasClientEmail || !hasPrivateKey) {
      return NextResponse.json(
        { error: `FIREBASE_ADMIN_NOT_CONFIGURED:pid=${hasProjectId},email=${hasClientEmail},key=${hasPrivateKey},pem=${privateKeyHasPem}` },
        { status: 500 }
      );
    }
    if (!privateKeyHasPem) {
      return NextResponse.json(
        { error: `FIREBASE_PRIVATE_KEY_INVALID:pem_header_missing,len=${process.env.FIREBASE_PRIVATE_KEY?.length ?? 0}` },
        { status: 500 }
      );
    }

    const idToken = getBearerToken(req);
    if (!idToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const looksLikeJwt = idToken.split('.').length === 3;
    if (!looksLikeJwt || idToken.includes('undefined') || idToken.length < 100) {
      return NextResponse.json({ error: 'ID_TOKEN_MALFORMED' }, { status: 401 });
    }
    let decoded: { uid: string; name?: string };
    try {
      const verified = await adminAuth.verifyIdToken(idToken);
      decoded = { uid: verified.uid, name: verified.name };
    } catch (error) {
      const code = String((error as { code?: string } | undefined)?.code ?? 'verify_failed');
      return NextResponse.json({ error: `ID_TOKEN_VERIFY_FAILED:${code}` }, { status: 401 });
    }

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
    try {
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
    } catch (error) {
      const code = String((error as { code?: string } | undefined)?.code ?? 'write_failed');
      const message = String((error as { message?: string } | undefined)?.message ?? '');
      return NextResponse.json(
        { error: `ACADEMY_WRITE_FAILED:${code}${message ? `:${message.slice(0, 160)}` : ''}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, id: docRef.id });
  } catch (error) {
    const code = String((error as { code?: string } | undefined)?.code ?? 'unknown');
    const message = String((error as { message?: string } | undefined)?.message ?? '');
    console.error('[academy-submit] failed:', error);
    return NextResponse.json(
      { error: `INTERNAL_ERROR:${code}${message ? `:${message.slice(0, 160)}` : ''}` },
      { status: 500 }
    );
  }
}
