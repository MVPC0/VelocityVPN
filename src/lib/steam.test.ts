import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchSteamCounts, steamCount } from "@/lib/steam";

const json = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" }, ...init });

describe("fetchSteamCounts", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("returns counts and fetchedAt on success", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({ counts: { 730: 1270974, 3010850: 6161 }, fetchedAt: "2026-10-25T15:12:00Z" })));
    const r = await fetchSteamCounts([730, 3010850]);
    expect(r?.counts).toEqual({ 730: 1270974, 3010850: 6161 });
    expect(r?.fetchedAt.toISOString()).toBe("2026-10-25T15:12:00.000Z");
  });

  it.each([
    ["network error", () => Promise.reject(new TypeError("Failed to fetch"))],
    ["HTTP 500", async () => json({ error: "x" }, { status: 500 })],
    ["HTML 200", async () => new Response("<html></html>", { headers: { "content-type": "text/html" } })],
    ["bad JSON", async () => new Response("{", { headers: { "content-type": "application/json" } })],
    ["counts null", async () => json({ counts: null })],
    ["timeout/abort", () => Promise.reject(new DOMException("timed out", "TimeoutError"))],
  ])("returns null on %s", async (_name, impl) => {
    vi.stubGlobal("fetch", vi.fn(impl));
    expect(await fetchSteamCounts([730])).toBeNull();
  });

  it("only ever calls the same-origin function (no Steam/proxy fallbacks)", async () => {
    const f = vi.fn(() => Promise.reject(new TypeError("Failed to fetch")));
    vi.stubGlobal("fetch", f);
    await fetchSteamCounts([730, 570]);
    expect(f).toHaveBeenCalledTimes(1);
    expect(String((f.mock.calls[0] as unknown[])[0])).toMatch(/^\/\.netlify\/functions\/steam-players\?appids=730,570$/);
  });
});

describe("steamCount", () => {
  it("passes real numbers through", () => {
    expect(steamCount({ 730: 1270974 }, 730)).toBe(1270974);
  });
  it.each([
    ["no response", null],
    ["missing id", {}],
    ["null count", { 730: null }],
    ["string", { 730: "123" }],
    ["NaN", { 730: NaN }],
    ["negative", { 730: -5 }],
  ])("is null for %s", (_n, counts) => {
    expect(steamCount(counts as Record<string, unknown> | null, 730)).toBeNull();
  });
});
