/* eslint-disable max-lines -- the route is one cohesive three-panel operations console. */
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowUpRight,
  CheckCircle2,
  Database,
  RefreshCw,
  SearchCheck,
  Send,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { getStandardErrorMessage } from "@/client/lib/error-messages";
import {
  getChinaSeoSnapshot,
  runBaiduRankCheck,
  submitBaiduUrls,
  syncGeoEvidence,
} from "@/serverFunctions/china-seo";

export const Route = createFileRoute("/_project/p/$projectId/china-seo")({
  component: ChinaSeoPage,
});

function ChinaSeoPage() {
  const { projectId } = Route.useParams();
  const queryClient = useQueryClient();
  const queryKey = ["chinaSeoSnapshot", projectId] as const;
  const snapshot = useQuery({
    queryKey,
    queryFn: () => getChinaSeoSnapshot({ data: { projectId } }),
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey });

  return (
    <div className="h-full overflow-auto bg-base-100 px-4 py-6 pb-24 md:px-6 md:py-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <header className="flex flex-col gap-3 border-b border-base-300 pb-5 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-primary">
              <ShieldCheck className="size-4" /> 御盾 SEO Operations
            </div>
            <h1 className="text-2xl font-bold tracking-tight">
              中国搜索运营台
            </h1>
            <p className="mt-1 max-w-3xl text-sm text-base-content/60">
              百度自然排名检查、主动推送回执和 GEO
              只读证据在同一项目中查看，但三者保持独立证据边界。
            </p>
          </div>
          <div className="rounded-lg border border-base-300 bg-base-200/50 px-3 py-2 text-xs text-base-content/60">
            当前域名：
            <span className="ml-1 font-mono font-medium text-base-content">
              {snapshot.data?.projectDomain ?? "等待配置"}
            </span>
          </div>
        </header>

        {!snapshot.data?.projectDomain && !snapshot.isLoading ? (
          <div role="alert" className="alert alert-warning text-sm">
            <span>
              请先在项目设置中填写域名；排名检查和百度推送会在域名缺失时拒绝执行。
            </span>
          </div>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-2">
          <BaiduRankPanel
            projectId={projectId}
            disabled={!snapshot.data?.projectDomain}
            onSuccess={refresh}
          />
          <BaiduSubmitPanel
            projectId={projectId}
            disabled={!snapshot.data?.projectDomain}
            onSuccess={refresh}
          />
        </div>

        <GeoEvidencePanel
          projectId={projectId}
          configured={snapshot.data?.geoConfigured ?? false}
          rows={snapshot.data?.geoEvidence ?? []}
          onSuccess={refresh}
        />

        <section className="rounded-xl border border-base-300 bg-base-100">
          <div className="flex items-center justify-between gap-3 border-b border-base-300 px-4 py-3">
            <div>
              <h2 className="font-semibold">百度自然排名历史</h2>
              <p className="text-xs text-base-content/50">
                每条记录包含 DataForSEO 任务号与规范化响应哈希。
              </p>
            </div>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => void refresh()}
            >
              <RefreshCw className="size-4" /> 刷新
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="table table-sm">
              <thead>
                <tr>
                  <th>关键词</th>
                  <th>设备</th>
                  <th>排名</th>
                  <th>排名 URL</th>
                  <th>时间 / 回执</th>
                </tr>
              </thead>
              <tbody>
                {(snapshot.data?.rankChecks ?? []).map((row) => (
                  <tr key={row.id}>
                    <td className="font-medium">{row.keyword}</td>
                    <td>{row.device === "mobile" ? "移动" : "桌面"}</td>
                    <td>
                      {row.position == null ? (
                        <span className="text-base-content/50">
                          Top 100 未发现
                        </span>
                      ) : (
                        <span className="font-mono font-semibold">
                          #{row.position}
                        </span>
                      )}
                    </td>
                    <td className="max-w-xs truncate">
                      {row.rankingUrl ? (
                        <a
                          className="link link-primary inline-flex items-center gap-1"
                          href={row.rankingUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {row.rankingUrl} <ArrowUpRight className="size-3" />
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="text-xs text-base-content/60">
                      <div>{new Date(row.checkedAt).toLocaleString()}</div>
                      <div className="font-mono" title={row.responseSha256}>
                        {row.upstreamTaskId ?? row.responseSha256.slice(0, 12)}
                      </div>
                    </td>
                  </tr>
                ))}
                {!snapshot.isLoading &&
                (snapshot.data?.rankChecks.length ?? 0) === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="py-8 text-center text-base-content/50"
                    >
                      尚无排名检查记录。
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>

        <SubmissionHistory rows={snapshot.data?.submissions ?? []} />
      </div>
    </div>
  );
}

function BaiduRankPanel({
  projectId,
  disabled,
  onSuccess,
}: {
  projectId: string;
  disabled: boolean;
  onSuccess: () => Promise<unknown>;
}) {
  const [keyword, setKeyword] = useState("App 加固");
  const [device, setDevice] = useState<"desktop" | "mobile">("mobile");
  const mutation = useMutation({
    mutationFn: () =>
      runBaiduRankCheck({ data: { projectId, keyword, device } }),
    onSuccess: async () => {
      await onSuccess();
      toast.success("百度排名检查已记录");
    },
    onError: (error) =>
      toast.error(getStandardErrorMessage(error, "百度排名检查失败")),
  });
  return (
    <section className="flex flex-col gap-4 rounded-xl border border-base-300 bg-base-100 p-4">
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-primary/10 p-2 text-primary">
          <SearchCheck className="size-5" />
        </div>
        <div>
          <h2 className="font-semibold">百度自然排名</h2>
          <p className="text-xs text-base-content/50">
            中国大陆 · 简体中文 · Top 100
          </p>
        </div>
      </div>
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium">关键词</span>
        <input
          className="input input-bordered w-full"
          value={keyword}
          maxLength={200}
          onChange={(event) => setKeyword(event.target.value)}
        />
      </label>
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium">设备</span>
        <select
          className="select select-bordered w-full"
          value={device}
          onChange={(event) =>
            setDevice(event.target.value === "desktop" ? "desktop" : "mobile")
          }
        >
          <option value="mobile">移动端</option>
          <option value="desktop">桌面端</option>
        </select>
      </label>
      <button
        type="button"
        className="btn btn-primary mt-auto"
        disabled={disabled || !keyword.trim() || mutation.isPending}
        onClick={() => mutation.mutate()}
      >
        {mutation.isPending ? (
          <span className="loading loading-spinner loading-sm" />
        ) : (
          <SearchCheck className="size-4" />
        )}
        执行并保存回执
      </button>
    </section>
  );
}

function BaiduSubmitPanel({
  projectId,
  disabled,
  onSuccess,
}: {
  projectId: string;
  disabled: boolean;
  onSuccess: () => Promise<unknown>;
}) {
  const [text, setText] = useState("");
  const urls = text
    .split(/\r?\n/)
    .map((value) => value.trim())
    .filter(Boolean);
  const mutation = useMutation({
    mutationFn: () => submitBaiduUrls({ data: { projectId, urls } }),
    onSuccess: async (result) => {
      await onSuccess();
      setText("");
      toast.success(`百度接收 ${result.succeeded} 条 URL`);
    },
    onError: (error) =>
      toast.error(getStandardErrorMessage(error, "百度 URL 提交失败")),
  });
  return (
    <section className="flex flex-col gap-4 rounded-xl border border-base-300 bg-base-100 p-4">
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-secondary/10 p-2 text-secondary">
          <Send className="size-5" />
        </div>
        <div>
          <h2 className="font-semibold">百度主动推送</h2>
          <p className="text-xs text-base-content/50">
            每次最多 10 条，仅允许当前项目域名。
          </p>
        </div>
      </div>
      <label className="flex flex-1 flex-col gap-1.5 text-sm">
        <span className="font-medium">URL，每行一条</span>
        <textarea
          className="textarea textarea-bordered min-h-28 w-full font-mono text-xs"
          value={text}
          placeholder="https://example.com/page"
          onChange={(event) => setText(event.target.value)}
        />
      </label>
      <div className="rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-base-content/70">
        推送成功只代表百度收到发现信号，不代表已收录，也不代表获得排名。
      </div>
      <button
        type="button"
        className="btn btn-secondary"
        disabled={
          disabled ||
          urls.length === 0 ||
          urls.length > 10 ||
          mutation.isPending
        }
        onClick={() => mutation.mutate()}
      >
        {mutation.isPending ? (
          <span className="loading loading-spinner loading-sm" />
        ) : (
          <Send className="size-4" />
        )}
        提交并保存原始响应哈希
      </button>
    </section>
  );
}

function GeoEvidencePanel({
  projectId,
  configured,
  rows,
  onSuccess,
}: {
  projectId: string;
  configured: boolean;
  rows: Array<{
    id: string;
    provider: string;
    evidenceClass: string;
    prompt: string;
    sourceCount: number;
    capturedAt: string;
    contentSha256: string;
  }>;
  onSuccess: () => Promise<unknown>;
}) {
  const mutation = useMutation({
    mutationFn: () => syncGeoEvidence({ data: { projectId } }),
    onSuccess: async (result) => {
      await onSuccess();
      toast.success(
        `收到 ${result.received} 条，新增 ${result.added} 条 GEO 证据`,
      );
    },
    onError: (error) =>
      toast.error(getStandardErrorMessage(error, "GEO 证据同步失败")),
  });
  return (
    <section className="rounded-xl border border-base-300 bg-base-100">
      <div className="flex flex-col gap-3 border-b border-base-300 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-accent/10 p-2 text-accent">
            <Database className="size-5" />
          </div>
          <div>
            <h2 className="font-semibold">GEO 证据只读输入</h2>
            <p className="text-xs text-base-content/50">
              仅导入回执摘要用于选题研究；不会写回 GEO，也不会自动生成或发布 SEO
              内容。
            </p>
          </div>
        </div>
        <button
          type="button"
          className="btn btn-outline btn-sm"
          disabled={!configured || mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          {mutation.isPending ? (
            <span className="loading loading-spinner loading-xs" />
          ) : (
            <RefreshCw className="size-4" />
          )}
          {configured ? "同步证据" : "等待配置"}
        </button>
      </div>
      <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
        {rows.slice(0, 6).map((row) => (
          <article
            key={row.id}
            className="rounded-lg border border-base-300 bg-base-200/30 p-3"
          >
            <div className="mb-2 flex items-center justify-between gap-2 text-xs">
              <span className="badge badge-outline">{row.provider}</span>
              <span className="text-base-content/50">{row.evidenceClass}</span>
            </div>
            <p className="line-clamp-2 text-sm font-medium">{row.prompt}</p>
            <div className="mt-3 flex items-center justify-between text-xs text-base-content/50">
              <span>{row.sourceCount} 个来源</span>
              <span className="font-mono" title={row.contentSha256}>
                {row.contentSha256.slice(0, 10)}…
              </span>
            </div>
          </article>
        ))}
        {rows.length === 0 ? (
          <div className="col-span-full py-5 text-center text-sm text-base-content/50">
            尚未导入 GEO 证据。
          </div>
        ) : null}
      </div>
    </section>
  );
}

function SubmissionHistory({
  rows,
}: {
  rows: Array<{
    id: string;
    status: "accepted" | "rejected" | "error";
    succeeded: number;
    remaining: number | null;
    submittedAt: string;
    responseSha256: string;
    errorMessage: string | null;
    urls: string[];
  }>;
}) {
  return (
    <section className="rounded-xl border border-base-300 bg-base-100">
      <div className="border-b border-base-300 px-4 py-3">
        <h2 className="font-semibold">百度推送回执</h2>
        <p className="text-xs text-base-content/50">
          接收、拒绝和网络错误均保留批次回执。
        </p>
      </div>
      <div className="divide-y divide-base-300">
        {rows.map((row) => (
          <div
            key={row.id}
            className="flex flex-col gap-2 px-4 py-3 md:flex-row md:items-center md:justify-between"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-sm font-medium">
                {row.status === "accepted" ? (
                  <CheckCircle2 className="size-4 text-success" />
                ) : null}
                <span>
                  {row.urls.length} 条 URL · 接收 {row.succeeded} 条
                </span>
                <span
                  className={`badge badge-sm ${row.status === "accepted" ? "badge-success" : "badge-error"}`}
                >
                  {row.status}
                </span>
              </div>
              <p className="mt-1 truncate text-xs text-base-content/50">
                {row.errorMessage ?? row.urls.join(" · ")}
              </p>
            </div>
            <div className="shrink-0 text-xs text-base-content/50 md:text-right">
              <div>{new Date(row.submittedAt).toLocaleString()}</div>
              <div className="font-mono" title={row.responseSha256}>
                {row.responseSha256.slice(0, 16)}…
              </div>
            </div>
          </div>
        ))}
        {rows.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-base-content/50">
            尚无推送回执。
          </div>
        ) : null}
      </div>
    </section>
  );
}
