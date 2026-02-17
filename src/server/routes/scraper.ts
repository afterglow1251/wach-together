import { Elysia, t } from "elysia"
import { parseUakinoPage, extractStreamUrl, searchUakino, browseUakino, withTimeout } from "../scraper"

const errMsg = (e: unknown): string => (e instanceof Error ? e.message : "Unknown error")

export default new Elysia()
  // Parse uakino URL
  .post(
    "/api/parse",
    async ({ body }) => {
      try {
        const show = await withTimeout(parseUakinoPage(body.url), 30000, "Timed out loading page (30s)")
        return { ok: true, show }
      } catch (e) {
        return { ok: false, error: errMsg(e) }
      }
    },
    { body: t.Object({ url: t.String() }) },
  )

  // Extract stream URL from player page
  .post(
    "/api/stream",
    async ({ body }) => {
      try {
        const streamUrl = await withTimeout(extractStreamUrl(body.url), 30000, "Timed out extracting stream (30s)")
        return { ok: true, streamUrl }
      } catch (e) {
        return { ok: false, error: errMsg(e) }
      }
    },
    { body: t.Object({ url: t.String() }) },
  )

  // Search uakino
  .get("/api/search", async ({ query }) => {
    const q = ((query.q as string) || "").trim()
    const page = parseInt(query.page as string) || 1
    if (!q) return { ok: false, error: "Missing query" }

    try {
      const results = await withTimeout(searchUakino(q, page), 15000, "Search timed out (15s)")
      return { ok: true, results }
    } catch (e) {
      return { ok: false, error: errMsg(e) }
    }
  })

  // Browse uakino by category
  .get("/api/browse", async ({ query }) => {
    const category = ((query.category as string) || "").trim()
    const page = parseInt(query.page as string) || 1
    if (!category) return { ok: false, error: "Missing category" }

    try {
      const results = await withTimeout(browseUakino(category, page), 15000, "Browse timed out (15s)")
      return { ok: true, results }
    } catch (e) {
      return { ok: false, error: errMsg(e) }
    }
  })
