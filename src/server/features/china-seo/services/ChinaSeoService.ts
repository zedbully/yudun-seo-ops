import { z } from "zod";
import type { BillingCustomerContext } from "@/server/billing/subscription";
import type { EnsuredProject } from "@/middleware/ensure-user/types";
import { ChinaSeoRepository } from "@/server/features/china-seo/repositories/ChinaSeoRepository";
import { createDataforseoClient } from "@/server/lib/dataforseo";
import { AppError } from "@/server/lib/errors";
import {
  getOptionalEnvValue,
  getRequiredEnvValue,
} from "@/server/lib/runtime-env";

const CHINA_LOCATION_CODE = 2156;
const CHINA_LANGUAGE_CODE = "zh_CN";

async function sha256(value: unknown) {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function requireProjectDomain(project: EnsuredProject) {
  if (!project.domain) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Set the project domain before using China SEO operations.",
    );
  }
  return project.domain.toLowerCase();
}

async function runBaiduRankCheck(input: {
  project: EnsuredProject;
  billingCustomer: BillingCustomerContext;
  keyword: string;
  device: "desktop" | "mobile";
}) {
  const targetDomain = requireProjectDomain(input.project);
  const result = await createDataforseoClient(
    input.billingCustomer,
  ).serp.baiduRankCheck({
    keyword: input.keyword,
    locationCode: CHINA_LOCATION_CODE,
    languageCode: CHINA_LANGUAGE_CODE,
    device: input.device,
    targetDomain,
    depth: 100,
  });
  const responseSha256 = await sha256(result);
  const checkedAt = new Date().toISOString();
  const row = {
    id: crypto.randomUUID(),
    projectId: input.project.id,
    keyword: input.keyword,
    targetDomain,
    locationCode: CHINA_LOCATION_CODE,
    languageCode: CHINA_LANGUAGE_CODE,
    device: input.device,
    position: result.position,
    rankingUrl: result.url,
    serpFeatures:
      result.serpFeatures.length > 0
        ? JSON.stringify(result.serpFeatures)
        : null,
    upstreamTaskId: result.upstreamTaskId,
    responseSha256,
    checkedAt,
  } as const;
  await ChinaSeoRepository.insertRankCheck(row);
  return row;
}

const baiduResponseSchema = z
  .object({
    remain: z.number().int().optional(),
    success: z.number().int().optional(),
    not_same_site: z.array(z.string()).optional(),
    not_valid: z.array(z.string()).optional(),
    error: z.number().int().optional(),
    message: z.string().optional(),
  })
  .passthrough();

function assertUrlsBelongToDomain(urls: string[], domain: string) {
  for (const value of urls) {
    const host = new URL(value).hostname.toLowerCase();
    if (host !== domain && !host.endsWith(`.${domain}`)) {
      throw new AppError(
        "VALIDATION_ERROR",
        `URL must belong to ${domain}: ${value}`,
      );
    }
  }
}

async function submitBaiduUrls(input: {
  project: EnsuredProject;
  urls: string[];
}) {
  const domain = requireProjectDomain(input.project);
  assertUrlsBelongToDomain(input.urls, domain);
  const site = await getRequiredEnvValue("BAIDU_SEARCH_SITE");
  const token = await getRequiredEnvValue("BAIDU_SEARCH_TOKEN");
  let siteDomain: string;
  try {
    siteDomain = new URL(site).hostname.toLowerCase();
  } catch {
    throw new AppError("VALIDATION_ERROR", "BAIDU_SEARCH_SITE must be a URL");
  }
  if (siteDomain !== domain && !siteDomain.endsWith(`.${domain}`)) {
    throw new AppError(
      "VALIDATION_ERROR",
      "BAIDU_SEARCH_SITE does not match the active project domain",
    );
  }

  const submittedAt = new Date().toISOString();
  const batchId = crypto.randomUUID();
  const endpoint = new URL("https://data.zz.baidu.com/urls");
  endpoint.searchParams.set("site", site);
  endpoint.searchParams.set("token", token);
  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "text/plain; charset=utf-8" },
      body: input.urls.join("\n"),
      signal: AbortSignal.timeout(30_000),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    await ChinaSeoRepository.insertSubmission({
      batch: {
        id: batchId,
        projectId: input.project.id,
        site,
        status: "error",
        succeeded: 0,
        responseSha256: await sha256({ error: message }),
        errorMessage: message,
        submittedAt,
      },
      urls: input.urls,
    });
    throw error;
  }

  const responseText = await response.text();
  let raw: unknown;
  try {
    raw = JSON.parse(responseText);
  } catch {
    raw = { text: responseText, httpStatus: response.status };
  }
  const parsed = baiduResponseSchema.safeParse(raw);
  const result = parsed.success ? parsed.data : {};
  const succeeded = result.success ?? 0;
  const status = response.ok && succeeded > 0 ? "accepted" : "rejected";
  const errorMessage =
    result.message ??
    (result.not_valid?.length || result.not_same_site?.length
      ? `${result.not_valid?.length ?? 0} invalid, ${result.not_same_site?.length ?? 0} outside site`
      : response.ok
        ? null
        : `Baidu HTTP ${response.status}`);
  await ChinaSeoRepository.insertSubmission({
    batch: {
      id: batchId,
      projectId: input.project.id,
      site,
      status,
      remaining: result.remain ?? null,
      succeeded,
      responseSha256: await sha256(raw),
      errorMessage,
      submittedAt,
    },
    urls: input.urls,
  });
  return { id: batchId, status, succeeded, remaining: result.remain ?? null };
}

const geoReceiptSchema = z.object({
  id: z.string().uuid(),
  provider: z.string(),
  evidence_class: z.string(),
  channel: z.string(),
  prompt: z.string(),
  answer: z.string(),
  sources: z.array(z.string()),
  site_domain: z.string().nullable().optional(),
  content_sha256: z.string().length(64),
  captured_at: z.string(),
});

const geoExportSchema = z.object({
  schema: z.literal("yudun.geo.evidence.v1"),
  readOnly: z.literal(true),
  receipts: z.array(geoReceiptSchema).max(500),
});

async function syncGeoEvidence(
  projectId: string,
  projectDomain: string | null,
) {
  if (!projectDomain) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Set the project domain before importing GEO evidence.",
    );
  }
  const normalizedDomain = projectDomain.toLowerCase();
  const exportUrl = await getRequiredEnvValue("GEOFLOW_EVIDENCE_EXPORT_URL");
  const secret = await getRequiredEnvValue("GEOFLOW_EVIDENCE_EXPORT_SECRET");
  const response = await fetch(exportUrl, {
    headers: { Authorization: `Bearer ${secret}` },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) {
    throw new AppError(
      "UPSTREAM_UNAVAILABLE",
      `GEO evidence export failed (${response.status})`,
    );
  }
  const parsed = geoExportSchema.safeParse(await response.json());
  if (!parsed.success) {
    throw new AppError("INTERNAL_ERROR", "Invalid GEO evidence export payload");
  }
  const rows = parsed.data.receipts
    .filter(
      (receipt) => receipt.site_domain?.toLowerCase() === normalizedDomain,
    )
    .map((receipt) => ({
      id: crypto.randomUUID(),
      projectId,
      evidenceId: receipt.id,
      provider: receipt.provider,
      evidenceClass: receipt.evidence_class,
      channel: receipt.channel,
      prompt: receipt.prompt,
      answer: receipt.answer,
      sourceCount: receipt.sources.length,
      contentSha256: receipt.content_sha256,
      capturedAt: receipt.captured_at,
    }));
  const added = await ChinaSeoRepository.importGeoEvidence(rows);
  return { received: rows.length, added };
}

async function getSnapshot(projectId: string, projectDomain: string | null) {
  const [rankChecks, submissions, geoEvidence, geoConfigured] =
    await Promise.all([
      ChinaSeoRepository.listRankChecks(projectId),
      ChinaSeoRepository.listSubmissions(projectId),
      ChinaSeoRepository.listGeoEvidence(projectId),
      getOptionalEnvValue("GEOFLOW_EVIDENCE_EXPORT_URL"),
    ]);
  return {
    projectDomain,
    rankChecks,
    submissions,
    geoEvidence,
    geoConfigured: Boolean(geoConfigured),
  };
}

export const ChinaSeoService = {
  runBaiduRankCheck,
  submitBaiduUrls,
  syncGeoEvidence,
  getSnapshot,
} as const;
