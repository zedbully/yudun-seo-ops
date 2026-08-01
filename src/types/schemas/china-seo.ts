import { z } from "zod";

const projectId = z.string().uuid();

export const chinaSeoSnapshotSchema = z.object({ projectId });

export const runBaiduRankCheckSchema = z.object({
  projectId,
  keyword: z.string().trim().min(1).max(200),
  device: z.enum(["desktop", "mobile"]).default("mobile"),
});

export const submitBaiduUrlsSchema = z.object({
  projectId,
  urls: z.array(z.url()).min(1).max(10),
});

export const syncGeoEvidenceSchema = z.object({ projectId });
