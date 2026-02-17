import { Elysia, t } from "elysia"
import { db } from "../db"
import { library, watchedEpisodes } from "../db/schema"
import { eq, sql } from "drizzle-orm"
import { parseUakinoPage, withTimeout } from "../scraper"
import type { LibraryStatus } from "../../shared/types"

const errMsg = (e: unknown): string => (e instanceof Error ? e.message : "Unknown error")

export default new Elysia()
  // Get user's library
  .get("/api/library", async ({ query }) => {
    const userId = parseInt(query.userId as string)
    if (!userId) return { ok: false, error: "Missing userId" }

    const items = await db.select().from(library).where(eq(library.userId, userId)).orderBy(library.addedAt)

    const watchedCounts = await db
      .select({
        sourceUrl: watchedEpisodes.sourceUrl,
        count: sql<number>`count(*)::int`,
      })
      .from(watchedEpisodes)
      .where(eq(watchedEpisodes.userId, userId))
      .groupBy(watchedEpisodes.sourceUrl)

    const countMap = new Map(watchedCounts.map((r) => [r.sourceUrl, r.count]))

    return {
      ok: true,
      items: items.map((item) => ({
        ...item,
        watchedCount: countMap.get(item.sourceUrl) || 0,
      })),
    }
  })

  // Add show to library
  .post(
    "/api/library",
    async ({ body }) => {
      try {
        const { userId, sourceUrl, status } = body

        const show = await withTimeout(parseUakinoPage(sourceUrl), 30000, "Timed out loading page (30s)")

        const totalEpisodes = Math.max(...show.dubs.map((d) => d.episodes.length), 0)

        const [item] = await db
          .insert(library)
          .values({
            userId,
            sourceUrl,
            title: show.title,
            poster: show.poster,
            totalEpisodes,
            status: (status || "plan_to_watch") as LibraryStatus,
          })
          .onConflictDoUpdate({
            target: [library.userId, library.sourceUrl],
            set: {
              title: show.title,
              poster: show.poster,
              totalEpisodes,
              ...(status ? { status: status as LibraryStatus } : {}),
            },
          })
          .returning()

        return { ok: true, item }
      } catch (e) {
        return { ok: false, error: errMsg(e) }
      }
    },
    {
      body: t.Object({
        userId: t.Number(),
        sourceUrl: t.String(),
        status: t.Optional(t.String()),
      }),
    },
  )

  // Update library item status
  .patch(
    "/api/library",
    async ({ body }) => {
      try {
        const [updated] = await db
          .update(library)
          .set({ status: body.status as typeof library.$inferInsert.status })
          .where(eq(library.id, body.id))
          .returning()

        return { ok: true, item: updated }
      } catch (e) {
        return { ok: false, error: errMsg(e) }
      }
    },
    {
      body: t.Object({
        id: t.Number(),
        status: t.String(),
      }),
    },
  )

  // Remove from library
  .delete(
    "/api/library",
    async ({ body }) => {
      try {
        await db.delete(library).where(eq(library.id, body.id))
        return { ok: true }
      } catch (e) {
        return { ok: false, error: errMsg(e) }
      }
    },
    {
      body: t.Object({ id: t.Number() }),
    },
  )
