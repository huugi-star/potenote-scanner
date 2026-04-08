import { loadEnvConfig } from '@next/env';
import { Timestamp } from 'firebase-admin/firestore';

const OFFICIAL_COLLECTION = 'academy_official_questions';

const toTimestamp = (iso: string): Timestamp => {
  const ms = Date.parse(iso);
  if (Number.isFinite(ms)) {
    return Timestamp.fromDate(new Date(ms));
  }
  return Timestamp.now();
};

const run = async () => {
  loadEnvConfig(process.cwd());
  const dryRun = process.argv.includes('--dry-run');
  const [{ adminDb }, { ACADEMY_SEED_QUESTIONS }] = await Promise.all([
    import('../src/lib/firebaseAdmin'),
    import('../src/data/academySeedQuestions'),
  ]);
  const questions = ACADEMY_SEED_QUESTIONS;

  if (questions.length === 0) {
    console.log('[academy_official_questions] no seed questions to import.');
    return;
  }

  if (dryRun) {
    console.log(`[academy_official_questions] dry-run: ${questions.length} documents will be upserted.`);
    return;
  }

  let created = 0;
  let skipped = 0;

  for (const q of questions) {
    const createdAt = toTimestamp(q.createdAt);
    const updatedAt = q.updatedAt ? toTimestamp(q.updatedAt) : createdAt;
    const ref = adminDb.collection(OFFICIAL_COLLECTION).doc(q.id);
    try {
      // 既存ドキュメントがある場合は更新せずスキップ（create は存在時に失敗する）
      await ref.create({
        id: q.id,
        status: q.status ?? 'published',
        authorUid: q.authorUid ?? 'official_seed',
        authorName: q.authorName ?? '公式問題',
        question: q.question,
        choices: q.choices,
        answerIndex: q.answerIndex,
        explanation: q.explanation,
        keywords: Array.isArray(q.keywords) ? q.keywords : [],
        bigCategory: q.bigCategory ?? null,
        subCategory: q.subCategory ?? null,
        subjectText: q.subjectText ?? null,
        detailText: q.detailText ?? null,
        createdAt,
        updatedAt,
      });
      created += 1;
    } catch (error) {
      const code = String((error as { code?: string } | undefined)?.code ?? '');
      // ALREADY_EXISTS(6) は正常系としてスキップ
      if (code === '6' || code === 'already-exists') {
        skipped += 1;
        continue;
      }
      throw error;
    }
  }

  console.log(`[academy_official_questions] import completed: created=${created}, skipped=${skipped}.`);
};

run().catch((error) => {
  console.error('[academy_official_questions] import failed:', error);
  process.exitCode = 1;
});
