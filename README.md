# OpenSEO

## 御盾 SEO Operations Fork

本分支新增项目级“中国搜索运营台”，域名和服务器可在部署阶段再配置：

- 使用 DataForSEO 的百度自然搜索接口检查中国大陆、简体中文、移动端或桌面端 Top 100 排名，并保存上游任务号和响应 SHA-256。
- 通过百度搜索资源平台主动推送 URL，限制为当前项目域名，并保存接收、拒绝或网络错误回执。推送成功只代表百度收到发现信号，不代表收录或排名。
- 从独立 GEO 系统读取 `yudun.geo.evidence.v1` 回执摘要，用于选题研究；该接口只读，不会把 GEO 内容混入 SEO 正文，也不会自动发布。
- SQLite/D1 与 PostgreSQL 使用同构的规范化表结构，相关变量见 `.env.example`。

正式启用前仍需填写项目域名，以及 `BAIDU_SEARCH_SITE`、`BAIDU_SEARCH_TOKEN`；两套系统对接时再填写 `GEOFLOW_EVIDENCE_EXPORT_URL` 与独立密钥。

> Open source alternative to Semrush and Ahrefs

OpenSEO is an SEO tool for _the people_. If tools like Semrush or Ahrefs are too expensive or bloated, OpenSEO is a pay-as-you-go alternative that you actually control.

> All-in-one SEO tool for you and your AI agent.

Connect with any agent like Claude Code, OpenClaw or Hermes. We have pre-built skills, but you can build your own to tailor OpenSEO to your needs.

<img width="1385" height="794" alt="Image" src="https://github.com/user-attachments/assets/fd208249-44ea-4849-bb4b-5fc896aeab73" />

## Hosted Version

Try OpenSEO for free on our website. If you want to support the project, a hosted subscription is $10/month.

[openseo.so](https://openseo.so)

## Why use OpenSEO?

- Best in class MCP and AI Skills.
- Modern, simple UI.
  - Focused workflows instead of a bloated, complex SEO suite.
- No subscriptions.
  - Bring your own DataForSEO API key and pay only for what you use.
- Fork and vibe code your own custom tool.

## Main SEO Workflows

- Keyword research
- Rank tracking
- Competitor Insights
- Backlinks
- Site Audits
- AI Visibility

## OpenSEO MCP & Agent Skills

OpenSEO exposes an MCP server so AI agents like Claude Code, OpenClaw, and Hermes can use your SEO data directly. Agent Skills are reusable workflows that guide your agent through SEO tasks using the MCP.

- [Set up OpenSEO MCP](https://openseo.so/docs/mcp)
- [Set up OpenSEO Agent Skills](https://openseo.so/docs/skills/setup)

## Self-Hosting

OpenSEO supports two self-hosting paths:

- **Simple: Docker** for personal use on your own machine (recommended for getting started). See [`docs/SELF_HOSTING_DOCKER.md`](./docs/SELF_HOSTING_DOCKER.md).
- **Advanced: Cloudflare** for internet-facing self-hosting across multiple devices or with your team (works on the free plan). See [`docs/SELF_HOSTING_CLOUDFLARE.md`](./docs/SELF_HOSTING_CLOUDFLARE.md).

Either way, you need a DataForSEO API key to get SEO data. See [`docs/DATAFORSEO_API_KEY.md`](./docs/DATAFORSEO_API_KEY.md).

## Costs

OpenSEO needs a [DataForSEO](https://dataforseo.com/?aff=255379) API key so that you can get SEO data. You pay them directly when self hosting.

See [openseo.so/pricing](https://openseo.so/pricing)

When you self host, your costs will be slightly lower than the estimates on our website. The way the hosted service makes money is by charging 28% extra for every request we make to DataForSEO.

## Local Development

See [`docs/LOCAL_DEVELOPMENT.md`](./docs/LOCAL_DEVELOPMENT.md).

## Contributing

Contributions are very welcome. See [`docs/CONTRIBUTING.md`](./docs/CONTRIBUTING.md).

## Community

Join Discord to chat: [Discord](https://discord.gg/c9uGs3cFXr)

Follow along for updates:

- Follow on X: https://x.com/bensenescu
- Sign up for the mailing list on our website: [openseo.so](https://openseo.so)
