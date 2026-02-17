import { Elysia, t } from "elysia"
import { db } from "../db"
import { watchedEpisodes } from "../db/schema"
import { eq, and } from "drizzle-orm"

const errMsg = (e: unknown): string => (e instanceof Error ? e.message : "Unknown error")

export default new Elysia()
  // Get watched episodes
  .get("/api/watched", async ({ query }) => {
    const userId = parseInt(query.userId as string)
    const sourceUrl = query.sourceUrl as string
    if (!userId || !sourceUrl) return { ok: false, error: "Missing params" }

    const rows = await db
      .select({ episodeId: watchedEpisodes.episodeId })
      .from(watchedEpisodes)
      .where(and(eq(watchedEpisodes.userId, userId), eq(watchedEpisodes.sourceUrl, sourceUrl)))

    return { ok: true, episodeIds: rows.map((r) => r.episodeId) }
  })

  // Mark episode as watched
  .post(
    "/api/watched",
    async ({ body }) => {
      try {
        await db
          .insert(watchedEpisodes)
          .values({ userId: body.userId, sourceUrl: body.sourceUrl, episodeId: body.episodeId })
          .onConflictDoNothing()
        return { ok: true }
      } catch (e) {
        return { ok: false, error: errMsg(e) }
      }
    },
    {
      body: t.Object({
        userId: t.Number(),
        sourceUrl: t.String(),
        episodeId: t.String(),
      }),
    },
  )

  // Unmark episode
  .delete(
    "/api/watched",
    async ({ body }) => {
      try {
        await db
          .delete(watchedEpisodes)
          .where(
            and(
              eq(watchedEpisodes.userId, body.userId),
              eq(watchedEpisodes.sourceUrl, body.sourceUrl),
              eq(watchedEpisodes.episodeId, body.episodeId),
            ),
          )
        return { ok: true }
      } catch (e) {
        return { ok: false, error: errMsg(e) }
      }
    },
    {
      body: t.Object({
        userId: t.Number(),
        sourceUrl: t.String(),
        episodeId: t.String(),
      }),
    },
  )
