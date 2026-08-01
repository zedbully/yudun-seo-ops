import { z } from "zod";
import { AppError } from "@/server/lib/errors";
import { getRequiredEnvValue } from "@/server/lib/runtime-env";
import {
  assertOk,
  buildTaskBilling,
  parseTaskItems,
  type DataforseoApiResponse,
} from "@/server/lib/dataforseo/envelope";

const BAIDU_LIVE_ADVANCED_URL =
  "https://api.dataforseo.com/v3/serp/baidu/organic/live/advanced";

const itemSchema = z
  .object({
    type: z.string(),
    rank_group: z.number().nullable().optional(),
    rank_absolute: z.number().nullable().optional(),
    domain: z.string().nullable().optional(),
    url: z.string().nullable().optional(),
  })
  .passthrough();

const responseSchema = z
  .object({
    status_code: z.number(),
    status_message: z.string().optional(),
    tasks: z.array(z.record(z.string(), z.unknown())).optional(),
  })
  .passthrough();

export type BaiduRankCheckResult = {
  keyword: string;
  position: number | null;
  url: string | null;
  serpFeatures: string[];
  upstreamTaskId: string | null;
};

export async function fetchBaiduRankCheck(input: {
  keyword: string;
  locationCode: number;
  languageCode: string;
  device: "desktop" | "mobile";
  targetDomain: string;
  depth: number;
}): Promise<DataforseoApiResponse<BaiduRankCheckResult>> {
  const apiKey = await getRequiredEnvValue("DATAFORSEO_API_KEY");
  const response = await fetch(BAIDU_LIVE_ADVANCED_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify([
      {
        keyword: input.keyword,
        location_code: input.locationCode,
        language_code: input.languageCode,
        device: input.device,
        os: input.device === "desktop" ? "windows" : "android",
        depth: Math.min(100, Math.max(10, input.depth)),
      },
    ]),
    signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok) {
    throw new AppError(
      response.status >= 500 ? "UPSTREAM_UNAVAILABLE" : "INTERNAL_ERROR",
      `DataForSEO Baidu HTTP ${response.status}`,
    );
  }

  const parsed = responseSchema.safeParse(await response.json());
  if (!parsed.success) {
    throw new AppError(
      "INTERNAL_ERROR",
      "DataForSEO Baidu returned an invalid response shape",
    );
  }
  const task = assertOk(parsed.data, { treatNoResultsAsEmpty: true });
  const items = parseTaskItems("baidu-organic-live-advanced", task, itemSchema);
  const target = input.targetDomain.toLowerCase();
  const match = items.find((item) => {
    if (item.type !== "organic" || !item.domain) return false;
    const domain = item.domain.toLowerCase();
    return domain === target || domain.endsWith(`.${target}`);
  });

  return {
    data: {
      keyword: input.keyword,
      position: match
        ? (match.rank_group ?? match.rank_absolute ?? null)
        : null,
      url: match?.url ?? null,
      serpFeatures: [
        ...new Set(items.map((item) => item.type).filter(Boolean)),
      ],
      upstreamTaskId: typeof task.id === "string" ? task.id : null,
    },
    billing: buildTaskBilling(task),
  };
}
