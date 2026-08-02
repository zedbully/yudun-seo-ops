import { createFileRoute } from "@tanstack/react-router";
import { env } from "cloudflare:workers";
import { timingSafeEqual } from "node:crypto";
import { AuditService } from "@/server/features/audit/services/AuditService";
import { ChinaSeoService } from "@/server/features/china-seo/services/ChinaSeoService";
import { ProjectRepository } from "@/server/features/projects/repositories/ProjectRepository";
import { getOptionalEnvValue, getEnvValueSync } from "@/server/lib/runtime-env";
import { resolveLocalNoAuthContext } from "@/middleware/ensure-user/delegated";

const SITE_KEYWORDS: Record<string, string> = {
  "appvmp.com": "App 软件加固",
  "apkvmp.com": "APK VMP 加固",
  "sovmp.com": "SO VMP 保护",
  "aivmp.cn": "AI App 安全加固",
  "dunvmp.com": "移动应用安全加固",
  "ydvmp.com": "软件加固服务",
};

function authorized(request: Request) {
  const expected = getEnvValueSync(env, "YUDUN_OPS_SECRET");
  const supplied = request.headers
    .get("authorization")
    ?.replace(/^Bearer\s+/i, "");
  if (!expected || !supplied) return false;
  const left = new TextEncoder().encode(expected);
  const right = new TextEncoder().encode(supplied);
  return left.length === right.length && timingSafeEqual(left, right);
}

async function operate(request: Request) {
  if (!authorized(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const context = await resolveLocalNoAuthContext();
  const projects = (
    await ProjectRepository.listProjects(context.organizationId)
  ).filter((project) => project.domain && SITE_KEYWORDS[project.domain]);
  const dataforseoConfigured = Boolean(
    await getOptionalEnvValue("DATAFORSEO_API_KEY"),
  );
  const geoConfigured = Boolean(
    await getOptionalEnvValue("GEOFLOW_EVIDENCE_EXPORT_URL"),
  );
  const results = [];

  for (const project of projects) {
    const auditHistory = await AuditService.getHistory(project.id);
    const latestAudit = auditHistory[0];
    const latestStartedAt = latestAudit?.startedAt
      ? new Date(latestAudit.startedAt).getTime()
      : 0;
    const auditIsFresh = Date.now() - latestStartedAt < 20 * 60 * 60 * 1000;
    let audit: Record<string, unknown> = {
      status: auditIsFresh ? "skipped_fresh" : "not_started",
      auditId: latestAudit?.id ?? null,
    };
    if (!auditIsFresh) {
      try {
        const started = await AuditService.startAudit({
          actorUserId: context.userId,
          billingCustomer: { ...context, projectId: project.id },
          projectId: project.id,
          startUrl: `https://${project.domain}/zh-cn/`,
          maxPages: 100,
          lighthouseStrategy: "none",
          limitTier: "paid",
        });
        audit = { status: "started", auditId: started.auditId };
      } catch (error) {
        audit = {
          status: "failed",
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    }

    let geo: Record<string, unknown> = {
      status: geoConfigured ? "ready" : "blocked",
    };
    if (geoConfigured) {
      try {
        geo = {
          status: "completed",
          ...(await ChinaSeoService.syncGeoEvidence(
            project.id,
            project.domain,
          )),
        };
      } catch (error) {
        geo = {
          status: "failed",
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    }

    let rank: Record<string, unknown> = {
      status: dataforseoConfigured ? "ready" : "blocked",
      blocker: dataforseoConfigured
        ? null
        : "DATAFORSEO_API_KEY is not configured",
    };
    if (dataforseoConfigured) {
      const snapshot = await ChinaSeoService.getSnapshot(
        project.id,
        project.domain,
      );
      const keyword = SITE_KEYWORDS[project.domain!];
      const recent = snapshot.rankChecks.find(
        (row) =>
          row.keyword === keyword &&
          Date.now() - new Date(row.checkedAt).getTime() < 20 * 60 * 60 * 1000,
      );
      if (recent) {
        rank = { status: "skipped_fresh", checkedAt: recent.checkedAt };
      } else {
        try {
          const checked = await ChinaSeoService.runBaiduRankCheck({
            project,
            billingCustomer: { ...context, projectId: project.id },
            keyword,
            device: "mobile",
          });
          rank = { status: "completed", checkedAt: checked.checkedAt };
        } catch (error) {
          rank = {
            status: "failed",
            error: error instanceof Error ? error.message : "Unknown error",
          };
        }
      }
    }

    results.push({
      domain: project.domain,
      projectId: project.id,
      audit,
      geo,
      rank,
    });
  }

  return Response.json({
    schema: "yudun.seo.operations.v1",
    operatedAt: new Date().toISOString(),
    projectCount: projects.length,
    dataforseoConfigured,
    geoConfigured,
    results,
  });
}

export const Route = createFileRoute("/api/yudun/operate")({
  server: { handlers: { POST: ({ request }) => operate(request) } },
});
