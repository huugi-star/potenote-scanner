import { NextResponse } from 'next/server';
import { z } from 'zod';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebaseAdmin';

/**
 * academy_reports — 運営確認用の通報キュー
 *
 * ドキュメント ID = f(questionId, reporterKey) で同一ユーザー・同一問題は常に1件。
 * 再送: reasons を和集合マージ、updatedAt 更新、submissionCount 加算。
 * createdAt は初回のみ（set）。closed 後の再送は 409。
 *
 * 運営が書き込む想定のフィールド（API では未設定・コンソール / 将来の管理 API 用）:
 * - resolvedAt: Timestamp | null
 * - moderatorUid: string | null
 * - moderatorNote: string | null
 *
 * 書き込みはこの API のみ（Admin SDK）。クライアント rules は deny。
 */

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const USER_COLLECTION = 'academy_questions';
const OFFICIAL_COLLECTION = 'academy_official_questions';
const REPORTS_COLLECTION = 'academy_reports';

/** 問題が存在する Firestore コレクション（コンソールでフィルタしやすいようフル名） */
export type AcademyReportQuestionCollection =
  | typeof USER_COLLECTION
  | typeof OFFICIAL_COLLECTION;

const ReasonIdSchema = z.enum(['copyright', 'morals', 'wrong', 'spam']);
const BodySchema = z.object({
  questionId: z.string().min(1).max(200),
  reasons: z.array(ReasonIdSchema).min(1).max(8),
  reporterKey: z.string().min(3).max(320),
});

const buildReportDocId = (questionId: string, reporterKey: string): string =>
  `${questionId}__${encodeURIComponent(reporterKey)}`;

const mergeReasons = (existing: unknown, incoming: string[]): string[] => {
  const prev = Array.isArray(existing)
    ? existing.filter((r): r is string => typeof r === 'string')
    : [];
  return [...new Set([...prev, ...incoming])].sort();
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

    const { questionId, reasons, reporterKey } = parsed.data;
    const uniqueReasons = [...new Set(reasons)];

    const userRef = adminDb.collection(USER_COLLECTION).doc(questionId);
    const officialRef = adminDb.collection(OFFICIAL_COLLECTION).doc(questionId);
    const userSnap = await userRef.get();
    const officialSnap = userSnap.exists ? null : await officialRef.get();
    const exists = userSnap.exists || !!officialSnap?.exists;
    if (!exists) {
      return NextResponse.json({ error: 'QUESTION_NOT_FOUND' }, { status: 404 });
    }

    const questionCollection: AcademyReportQuestionCollection = userSnap.exists
      ? USER_COLLECTION
      : OFFICIAL_COLLECTION;

    const reportId = buildReportDocId(questionId, reporterKey);
    const reportRef = adminDb.collection(REPORTS_COLLECTION).doc(reportId);

    let created = false;
    await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(reportRef);
      const data = snap.data();
      const status = data?.status;

      if (snap.exists && status != null && status !== 'open') {
        throw Object.assign(new Error('REPORT_ALREADY_CLOSED'), { code: 'REPORT_ALREADY_CLOSED' });
      }

      const ts = FieldValue.serverTimestamp();

      if (!snap.exists) {
        created = true;
        tx.set(reportRef, {
          questionId,
          reasons: mergeReasons([], uniqueReasons),
          reporterKey,
          questionCollection,
          createdAt: ts,
          updatedAt: ts,
          submissionCount: 1,
          status: 'open',
        });
        return;
      }

      const merged = mergeReasons(data?.reasons, uniqueReasons);
      tx.update(reportRef, {
        reasons: merged,
        questionCollection,
        updatedAt: ts,
        submissionCount: FieldValue.increment(1),
      });
    });

    return NextResponse.json({ success: true, reportId, created, merged: !created });
  } catch (error) {
    if (error instanceof Error && error.message === 'REPORT_ALREADY_CLOSED') {
      return NextResponse.json(
        { error: 'REPORT_ALREADY_CLOSED', message: 'この通報は対応済みです。新たな問題がある場合はサポートへご連絡ください。' },
        { status: 409 }
      );
    }
    const code = String((error as { code?: string } | undefined)?.code ?? 'unknown');
    const message = String((error as { message?: string } | undefined)?.message ?? '');
    console.error('[academy-report] failed:', error);
    return NextResponse.json(
      { error: `INTERNAL_ERROR:${code}${message ? `:${message.slice(0, 160)}` : ''}` },
      { status: 500 }
    );
  }
}
