import { createServerFn } from "@tanstack/react-start";
import { ChinaSeoService } from "@/server/features/china-seo/services/ChinaSeoService";
import { requireProjectContext } from "@/serverFunctions/middleware";
import {
  chinaSeoSnapshotSchema,
  runBaiduRankCheckSchema,
  submitBaiduUrlsSchema,
  syncGeoEvidenceSchema,
} from "@/types/schemas/china-seo";

export const getChinaSeoSnapshot = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(chinaSeoSnapshotSchema)
  .handler(({ context }) =>
    ChinaSeoService.getSnapshot(context.projectId, context.project.domain),
  );

export const runBaiduRankCheck = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(runBaiduRankCheckSchema)
  .handler(({ data, context }) =>
    ChinaSeoService.runBaiduRankCheck({
      project: context.project,
      billingCustomer: context,
      keyword: data.keyword,
      device: data.device,
    }),
  );

export const submitBaiduUrls = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(submitBaiduUrlsSchema)
  .handler(({ data, context }) =>
    ChinaSeoService.submitBaiduUrls({
      project: context.project,
      urls: data.urls,
    }),
  );

export const syncGeoEvidence = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(syncGeoEvidenceSchema)
  .handler(({ context }) =>
    ChinaSeoService.syncGeoEvidence(context.projectId, context.project.domain),
  );
