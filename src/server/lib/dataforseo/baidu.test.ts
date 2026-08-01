import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchBaiduRankCheck } from "./baidu";

afterEach(() => {
  vi.unstubAllGlobals();
  process.env.DATAFORSEO_API_KEY = "";
});

describe("fetchBaiduRankCheck", () => {
  it("normalizes the matching organic result and preserves billing metadata", async () => {
    process.env.DATAFORSEO_API_KEY = "encoded-login-password";
    let capturedInit: RequestInit | undefined;
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL, init?: RequestInit) => {
        capturedInit = init;
        return new Response(
          JSON.stringify({
            status_code: 20000,
            tasks: [
              {
                id: "baidu-task-1",
                status_code: 20000,
                status_message: "Ok.",
                path: ["v3", "serp", "baidu", "organic", "live", "advanced"],
                cost: 0.002,
                result_count: 1,
                result: [
                  {
                    items: [
                      {
                        type: "organic",
                        rank_group: 3,
                        rank_absolute: 5,
                        domain: "www.yudun.example",
                        url: "https://www.yudun.example/android-hardening",
                      },
                      { type: "people_also_search" },
                    ],
                  },
                ],
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      },
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchBaiduRankCheck({
      keyword: "App 加固",
      locationCode: 2156,
      languageCode: "zh_CN",
      device: "mobile",
      targetDomain: "yudun.example",
      depth: 100,
    });

    expect(result.data).toEqual({
      keyword: "App 加固",
      position: 3,
      url: "https://www.yudun.example/android-hardening",
      serpFeatures: ["organic", "people_also_search"],
      upstreamTaskId: "baidu-task-1",
    });
    expect(result.billing).toEqual({
      path: ["v3", "serp", "baidu", "organic", "live", "advanced"],
      costUsd: 0.002,
    });
    const headers = new Headers(capturedInit?.headers);
    if (typeof capturedInit?.body !== "string")
      throw new Error("Missing request body");
    expect(headers.get("Authorization")).toBe("Basic encoded-login-password");
    expect(JSON.parse(capturedInit.body)).toEqual([
      {
        keyword: "App 加固",
        location_code: 2156,
        language_code: "zh_CN",
        device: "mobile",
        os: "android",
        depth: 100,
      },
    ]);
  });
});
