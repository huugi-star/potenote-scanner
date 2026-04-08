import { loadEnvConfig } from '@next/env';
import type { QueryDocumentSnapshot } from 'firebase-admin/firestore';

const COLLECTION = 'academy_questions';
const OFFICIAL_AUTHOR_NAME = '公式問題';
const OFFICIAL_AUTHOR_UID = 'official_seed';
const BATCH_SIZE = 450;

const run = async () => {
  loadEnvConfig(process.cwd());
  const dryRun = process.argv.includes('--dry-run');
  const { adminDb } = await import('../src/lib/firebaseAdmin');

  const [nameSnap, uidSnap] = await Promise.all([
    adminDb.collection(COLLECTION).where('authorName', '==', OFFICIAL_AUTHOR_NAME).get(),
    adminDb.collection(COLLECTION).where('authorUid', '==', OFFICIAL_AUTHOR_UID).get(),
  ]);

  const byId = new Map<string, QueryDocumentSnapshot>();
  for (const d of nameSnap.docs) byId.set(d.id, d);
  for (const d of uidSnap.docs) byId.set(d.id, d);

  const docs = [...byId.values()];
  console.log(`[${COLLECTION}] matched ${docs.length} document(s) (authorName="${OFFICIAL_AUTHOR_NAME}" OR authorUid="${OFFICIAL_AUTHOR_UID}").`);

  for (const d of docs) {
    const data = d.data();
    const uid = data.authorUid ?? '(missing)';
    const name = data.authorName ?? '(missing)';
    if (dryRun) {
      console.log(`[dry-run] would delete id=${d.id} authorUid=${uid} authorName=${name}`);
    }
  }

  if (dryRun) {
    console.log('[dry-run] no documents were deleted. Run without --dry-run to delete.');
    return;
  }

  for (let i = 0; i < docs.length; i += BATCH_SIZE) {
    const chunk = docs.slice(i, i + BATCH_SIZE);
    const batch = adminDb.batch();
    for (const d of chunk) {
      batch.delete(d.ref);
    }
    await batch.commit();
    console.log(`[${COLLECTION}] deleted chunk: ${Math.min(i + chunk.length, docs.length)} / ${docs.length}`);
  }

  console.log(`[${COLLECTION}] delete completed: ${docs.length} document(s).`);
};

run().catch((error) => {
  console.error(`[${COLLECTION}] delete failed:`, error);
  process.exitCode = 1;
});
