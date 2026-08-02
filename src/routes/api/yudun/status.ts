import { createFileRoute } from "@tanstack/react-router";
import { env } from "cloudflare:workers";
import { timingSafeEqual } from "node:crypto";
import { AuditService } from "@/server/features/audit/services/AuditService";
import { ChinaSeoService } from "@/server/features/china-seo/services/ChinaSeoService";
import { ProjectRepository } from "@/server/features/projects/repositories/ProjectRepository";
import { getEnvValueSync, getOptionalEnvValue } from "@/server/lib/runtime-env";
import { resolveLocalNoAuthContext } from "@/middleware/ensure-user/delegated";

const YUDUN_DOMAINS = new Set([
  "appvmp.com",
  "apkvmp.com",
  "sovmp.com",
  "aivmp.cn",
  "dunvmp.com",
  "ydvmp.com",
]);

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

async function status(request: Request) {
  if (!authorized(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const context = await resolveLocalNoAuthContext();
  const projects = (
    await ProjectRepository.listProjects(context.organizationId)
  ).filter((project) => project.domain && YUDUN_DOMAINS.has(project.domain));
  const sites = [];
  for (const project of projects) {
    const [snapshot, audits] = await Promise.all([
      ChinaSeoService.getSnapshot(project.id, project.domain),
      AuditService.getHistory(project.id),
    ]);
    sites.push({
      domain: project.domain,
      projectId: project.id,
      latestAudit: audits[0] ?? null,
      auditCount: audits.length,
      latestRankCheck: snapshot.rankChecks[0]
        ? {
            keyword: snapshot.rankChecks[0].keyword,
            position: snapshot.rankChecks[0].position,
            checkedAt: snapshot.rankChecks[0].checkedAt,
          }
        : null,
      rankCheckCount: snapshot.rankChecks.length,
      geoEvidenceCount: snapshot.geoEvidence.length,
      latestGeoEvidenceAt: snapshot.geoEvidence[0]?.capturedAt ?? null,
      baiduSubmissionCount: snapshot.submissions.length,
    });
  }
  return Response.json({
    schema: "yudun.seo.operations.status.v1",
    generatedAt: new Date().toISOString(),
    projectCount: projects.length,
    dataforseoConfigured: Boolean(
      await getOptionalEnvValue("DATAFORSEO_API_KEY"),
    ),
    geoEvidenceConfigured: Boolean(
      await getOptionalEnvValue("GEOFLOW_EVIDENCE_EXPORT_URL"),
    ),
    sites,
  });
}

export const Route = createFileRoute("/api/yudun/status")({
  server: { handlers: { GET: ({ request }) => status(request) } },
});
