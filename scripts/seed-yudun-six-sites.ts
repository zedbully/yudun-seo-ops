import { getPlatformProxy } from "wrangler";
import { drizzle } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";
import * as appSchema from "../src/db/app.schema";
import { organization, user } from "../src/db/better-auth-schema";

const schema = { ...appSchema, organization, user };
const USER_ID = "local-admin";
const USER_EMAIL = "admin@localhost";
const ORGANIZATION_ID = "delegated-local-admin";
const ORGANIZATION_SLUG = `delegated-admin-${Array.from(
  new TextEncoder().encode(USER_ID),
)
  .map((byte) => byte.toString(16).padStart(2, "0"))
  .join("")}`;
const SITES = [
  ["御盾 App 软件加固", "appvmp.com"],
  ["御盾 Android APK VMP", "apkvmp.com"],
  ["御盾 Native SO VMP", "sovmp.com"],
  ["御盾 AI App 保护", "aivmp.cn"],
  ["御盾移动应用攻防", "dunvmp.com"],
  ["御盾软件加固选型", "ydvmp.com"],
] as const;

async function main() {
  const { env, dispose } = await getPlatformProxy<{ DB: D1Database }>();
  const db = drizzle(env.DB, { schema });
  try {
    await db
      .insert(schema.user)
      .values({
        id: USER_ID,
        name: "admin",
        email: USER_EMAIL,
        emailVerified: true,
      })
      .onConflictDoNothing({ target: schema.user.id });
    await db
      .insert(schema.organization)
      .values({
        id: ORGANIZATION_ID,
        name: "御盾搜索运营",
        slug: ORGANIZATION_SLUG,
        createdAt: new Date(),
      })
      .onConflictDoNothing({ target: schema.organization.id });

    const existing = await db
      .select({ domain: schema.projects.domain })
      .from(schema.projects)
      .where(eq(schema.projects.organizationId, ORGANIZATION_ID));
    const domains = new Set(existing.map((row) => row.domain));
    let created = 0;
    for (const [name, domain] of SITES) {
      if (domains.has(domain)) continue;
      await db.insert(schema.projects).values({
        id: crypto.randomUUID(),
        organizationId: ORGANIZATION_ID,
        name,
        domain,
        locationCode: 2156,
        languageCode: "zh_CN",
      });
      created += 1;
    }
    console.log(
      `Yudun six-site seed complete: ${created} created, ${SITES.length - created} existing.`,
    );
  } finally {
    await dispose();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
