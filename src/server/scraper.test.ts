import { describe, it, expect, vi, beforeEach } from "vitest"
import {
  PLAYLIST_AJAX_PAGE,
  PLAYLIST_RESPONSE_SUCCESS,
  INLINE_DATA_FILE_PAGE,
  IFRAME_FALLBACK_PAGE,
  NO_PLAYER_PAGE,
  PLAYER_PAGE_DIRECT_M3U8,
  PLAYER_PAGE_BASE64,
  PLAYER_PAGE_FILE_VAR,
  PLAYER_PAGE_NO_STREAM,
  SEARCH_RESULTS_HTML,
  SEARCH_RESULTS_EMPTY,
} from "../../tests/fixtures/html-fixtures"

// Mock globalThis.fetch
const mockFetch = vi.fn()
vi.stubGlobal("fetch", mockFetch)

// Need to import after mocking
let scraper: typeof import("./scraper")

beforeEach(async () => {
  vi.resetModules()
  mockFetch.mockReset()
  scraper = await import("./scraper")
})

function mockResponse(body: string, ok = true, status = 200) {
  return {
    ok,
    status,
    text: () => Promise.resolve(body),
    json: () => Promise.resolve(JSON.parse(body)),
  }
}

function mockJsonResponse(data: object, ok = true) {
  return {
    ok,
    status: ok ? 200 : 500,
    text: () => Promise.resolve(JSON.stringify(data)),
    json: () => Promise.resolve(data),
  }
}

describe("parseUakinoPage", () => {
  it("parses page with playlist-ajax (multi-dub)", async () => {
    mockFetch
      .mockResolvedValueOnce(mockResponse(PLAYLIST_AJAX_PAGE))
      .mockResolvedValueOnce(mockJsonResponse(PLAYLIST_RESPONSE_SUCCESS))

    const show = await scraper.parseUakinoPage("https://uakino.best/film/test.html")

    expect(show.title).toBe("Test Movie Title")
    expect(show.poster).toBe("/uploads/poster.jpg")
    expect(show.dubs.length).toBe(2)
    expect(show.dubs[0].name).toBe("Озвучення 1")
    expect(show.dubs[0].episodes.length).toBe(2)
    expect(show.dubs[0].episodes[0].url).toBe("https://ashdi.vip/video1")
    expect(show.dubs[0].episodes[1].url).toBe("https://ashdi.vip/video2")
    expect(show.dubs[1].name).toBe("Озвучення 2")
    expect(show.dubs[1].episodes.length).toBe(1)
  })

  it("parses inline data-file fallback", async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(INLINE_DATA_FILE_PAGE))

    const show = await scraper.parseUakinoPage("https://uakino.best/film/inline.html")

    expect(show.title).toBe("Inline Show")
    expect(show.poster).toBe("/uploads/inline-poster.jpg")
    expect(show.dubs.length).toBe(1)
    expect(show.dubs[0].name).toBe("Основне")
    expect(show.dubs[0].episodes.length).toBe(2)
    expect(show.dubs[0].episodes[0].url).toBe("https://ashdi.vip/inline1")
  })

  it("parses iframe fallback", async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(IFRAME_FALLBACK_PAGE))

    const show = await scraper.parseUakinoPage("https://uakino.best/film/iframe.html")

    expect(show.title).toBe("Iframe Movie")
    expect(show.poster).toBe("/uploads/iframe-poster.jpg")
    expect(show.dubs.length).toBe(1)
    expect(show.dubs[0].episodes[0].url).toBe("https://ashdi.vip/embed/movie123")
  })

  it("throws when no players found", async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(NO_PLAYER_PAGE))

    await expect(scraper.parseUakinoPage("https://uakino.best/film/empty.html")).rejects.toThrow(
      "Could not find any episodes/players on this page",
    )
  })

  it("throws on fetch failure", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 404 })

    await expect(scraper.parseUakinoPage("https://uakino.best/bad")).rejects.toThrow("Failed to fetch uakino page: 404")
  })

  it("throws on playlist fetch failure", async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(PLAYLIST_AJAX_PAGE)).mockResolvedValueOnce({ ok: false, status: 500 })

    await expect(scraper.parseUakinoPage("https://uakino.best/film/test.html")).rejects.toThrow(
      "Failed to fetch playlist: 500",
    )
  })

  it("throws when playlist response is not success", async () => {
    mockFetch
      .mockResolvedValueOnce(mockResponse(PLAYLIST_AJAX_PAGE))
      .mockResolvedValueOnce(mockJsonResponse({ success: false, message: "Not found" }))

    await expect(scraper.parseUakinoPage("https://uakino.best/film/test.html")).rejects.toThrow("Not found")
  })

  it("prepends https: to protocol-relative URLs", async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(INLINE_DATA_FILE_PAGE))

    const show = await scraper.parseUakinoPage("https://uakino.best/film/inline.html")
    expect(show.dubs[0].episodes[0].url).toMatch(/^https:/)
  })
})

describe("extractStreamUrl", () => {
  it("extracts direct m3u8 URL from page", async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(PLAYER_PAGE_DIRECT_M3U8))

    const url = await scraper.extractStreamUrl("https://ashdi.vip/video1")
    expect(url).toBe("https://cdn.example.com/stream/master.m3u8?token=abc123")
  })

  it("decodes base64-encoded stream URL", async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(PLAYER_PAGE_BASE64))

    const url = await scraper.extractStreamUrl("https://ashdi.vip/video2")
    expect(url).toBe("https://cdn.example.com/encoded/stream.m3u8")
  })

  it("extracts file variable with direct m3u8", async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(PLAYER_PAGE_FILE_VAR))

    const url = await scraper.extractStreamUrl("https://ashdi.vip/video3")
    expect(url).toBe("https://cdn.example.com/direct/stream.m3u8")
  })

  it("throws when no stream found", async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(PLAYER_PAGE_NO_STREAM))

    await expect(scraper.extractStreamUrl("https://ashdi.vip/novideo")).rejects.toThrow("Could not extract stream URL")
  })

  it("throws on fetch failure", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 403 })

    await expect(scraper.extractStreamUrl("https://ashdi.vip/bad")).rejects.toThrow("Failed to fetch player page: 403")
  })
})

describe("searchUakino", () => {
  it("returns parsed search results", async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(SEARCH_RESULTS_HTML))

    const results = await scraper.searchUakino("test")
    expect(results.length).toBe(2)
    expect(results[0].title).toBe("Test Film")
    expect(results[0].url).toBe("https://uakino.best/filmy/test-film.html")
    expect(results[0].category).toBe("film")
    expect(results[1].title).toBe("Test Series")
    expect(results[1].category).toBe("series")
  })

  it("returns empty array for no results", async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(SEARCH_RESULTS_EMPTY))

    const results = await scraper.searchUakino("nonexistent")
    expect(results).toEqual([])
  })

  it("sends correct POST body with page parameter", async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(SEARCH_RESULTS_EMPTY))

    await scraper.searchUakino("test query", 2)

    const callBody = mockFetch.mock.calls[0][1]?.body
    expect(callBody).toContain("story=test+query")
    expect(callBody).toContain("search_start=2")
    expect(callBody).toContain("result_from=21")
  })

  it("throws on fetch failure", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 })

    await expect(scraper.searchUakino("test")).rejects.toThrow("Search failed: 500")
  })
})

describe("browseUakino", () => {
  it("fetches correct category URL", async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(SEARCH_RESULTS_HTML))

    await scraper.browseUakino("films", 1)

    expect(mockFetch.mock.calls[0][0]).toBe("https://uakino.best/filmy/page/1/")
  })

  it("fetches series category", async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(SEARCH_RESULTS_EMPTY))

    await scraper.browseUakino("series", 2)

    expect(mockFetch.mock.calls[0][0]).toBe("https://uakino.best/seriesss/page/2/")
  })

  it("throws for unknown category", async () => {
    await expect(scraper.browseUakino("unknown")).rejects.toThrow("Unknown category: unknown")
  })

  it("throws on fetch failure", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 })

    await expect(scraper.browseUakino("films")).rejects.toThrow("Browse failed: 500")
  })
})
