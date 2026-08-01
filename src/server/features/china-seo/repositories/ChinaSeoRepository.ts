import { desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { runBatch } from "@/db/runBatch";
import {
  baiduSubmissionBatches,
  baiduSubmissionUrls,
  chinaSeoRankChecks,
  geoEvidenceImports,
} from "@/db/schema";

async function insertRankCheck(row: typeof chinaSeoRankChecks.$inferInsert) {
  await db.insert(chinaSeoRankChecks).values(row);
}

async function listRankChecks(projectId: string) {
  return db
    .select()
    .from(chinaSeoRankChecks)
    .where(eq(chinaSeoRankChecks.projectId, projectId))
    .orderBy(desc(chinaSeoRankChecks.checkedAt))
    .limit(100);
}

async function insertSubmission(input: {
  batch: typeof baiduSubmissionBatches.$inferInsert;
  urls: string[];
}) {
  await runBatch((tx) => [
    tx.insert(baiduSubmissionBatches).values(input.batch),
    ...input.urls.map((url) =>
      tx.insert(baiduSubmissionUrls).values({
        id: crypto.randomUUID(),
        batchId: input.batch.id,
        url,
      }),
    ),
  ]);
}

async function listSubmissions(projectId: string) {
  const batches = await db
    .select()
    .from(baiduSubmissionBatches)
    .where(eq(baiduSubmissionBatches.projectId, projectId))
    .orderBy(desc(baiduSubmissionBatches.submittedAt))
    .limit(50);
  if (batches.length === 0) return [];
  const urls = await db
    .select()
    .from(baiduSubmissionUrls)
    .where(
      inArray(
        baiduSubmissionUrls.batchId,
        batches.map((batch) => batch.id),
      ),
    );
  const byBatch = new Map<string, string[]>();
  for (const row of urls) {
    const values = byBatch.get(row.batchId) ?? [];
    values.push(row.url);
    byBatch.set(row.batchId, values);
  }
  return batches.map((batch) => ({
    ...batch,
    urls: byBatch.get(batch.id) ?? [],
  }));
}

async function importGeoEvidence(
  rows: Array<typeof geoEvidenceImports.$inferInsert>,
) {
  let added = 0;
  for (const row of rows) {
    const inserted = await db
      .insert(geoEvidenceImports)
      .values(row)
      .onConflictDoNothing()
      .returning({ id: geoEvidenceImports.id });
    added += inserted.length;
  }
  return added;
}

async function listGeoEvidence(projectId: string) {
  return db
    .select()
    .from(geoEvidenceImports)
    .where(eq(geoEvidenceImports.projectId, projectId))
    .orderBy(desc(geoEvidenceImports.capturedAt))
    .limit(100);
}

export const ChinaSeoRepository = {
  insertRankCheck,
  listRankChecks,
  insertSubmission,
  listSubmissions,
  importGeoEvidence,
  listGeoEvidence,
} as const;
