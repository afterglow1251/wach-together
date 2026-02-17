import { Elysia, t } from "elysia"
import { db } from "../db"
import { playbackPositions } from "../db/schema"
import { eq, and, sql, desc } from "drizzle-orm"

const errMsg = (e: unknown): string => (e instanceof Error ? e.message : "Unknown error")

export default new Elysia()
  // Save playback position (upsert)
  .post(
    "/api/playback-position",
    async ({ body }) => {
      try {
        await db
          .insert(playbackPositions)
          .values({
            userId: body.userId,
            sourceUrl: body.sourceUrl,
            episodeId: body.episodeId ?? null,
            episodeUrl: body.episodeUrl,
            title: body.title,
            poster: body.poster,
            episodeName: body.episodeName ?? null,
            position: body.position,
            duration: body.duration,
          })
          .onConflictDoUpdate({
            target: [playbackPositions.userId, playbackPositions.sourceUrl, playbackPositions.episodeId],
            set: {
              episodeUrl: body.episodeUrl,
              title: body.title,
              poster: body.poster,
              episodeName: body.episodeName ?? null,
              position: body.position,
              duration: body.duration,
              updatedAt: sql`now()`,
            },
          })
        return { ok: true }
      } catch (e) {
        return { ok: false, error: errMsg(e) }
      }
    },
    {
      body: t.Object({
        userId: t.Number(),
        sourceUrl: t.String(),
        episodeId: t.Optional(t.String()),
        episodeUrl: t.String(),
        title: t.String(),
        poster: t.String(),
        episodeName: t.Optional(t.String()),
        position: t.Number(),
        duration: t.Number(),
      }),
    },
  )

  // Get playback positions (continue watching)
  .get("/api/playback-position", async ({ query }) => {
    const userId = parseInt(query.userId as string)
    if (!userId) return { ok: false, error: "Missing userId" }

    const rows = await db
      .select()
      .from(playbackPositions)
      .where(
        and(
          eq(playbackPositions.userId, userId),
          sql`(${playbackPositions.position}::float / NULLIF(${playbackPositions.duration}, 0)) < 0.95`,
        ),
      )
      .orderBy(desc(playbackPositions.updatedAt))
      .limit(10)

    return {
      ok: true,
      positions: rows.map((r) => ({
        id: r.id,
        sourceUrl: r.sourceUrl,
        episodeId: r.episodeId,
        episodeUrl: r.episodeUrl,
        title: r.title,
        poster: r.poster,
        episodeName: r.episodeName,
        position: r.position,
        duration: r.duration,
        updatedAt: r.updatedAt?.toISOString() ?? null,
      })),
    }
  })
