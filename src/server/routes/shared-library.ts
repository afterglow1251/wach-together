import { Elysia, t } from "elysia"
import { db } from "../db"
import { sharedLibrary, sharedWatches, friendships } from "../db/schema"
import { eq, and, or, sql, desc } from "drizzle-orm"
import { parseUakinoPage, withTimeout } from "../scraper"

const errMsg = (e: unknown): string => (e instanceof Error ? e.message : "Unknown error")

export default new Elysia()
  // Get shared library for a friend pair
  .get("/api/shared-library", async ({ query }) => {
    const userId = parseInt(query.userId as string)
    const friendId = parseInt(query.friendId as string)
    if (!userId || !friendId) return { ok: false, error: "Missing params" }

    const u1 = Math.min(userId, friendId)
    const u2 = Math.max(userId, friendId)

    const items = await db
      .select()
      .from(sharedLibrary)
      .where(and(eq(sharedLibrary.user1Id, u1), eq(sharedLibrary.user2Id, u2)))
      .orderBy(desc(sharedLibrary.addedAt))

    // Count watched episodes per sourceUrl from shared_watches
    const watchedCounts = await db
      .select({
        sourceUrl: sharedWatches.sourceUrl,
        count: sql<number>`count(distinct ${sharedWatches.episodeId})::int`,
      })
      .from(sharedWatches)
      .where(and(eq(sharedWatches.user1Id, u1), eq(sharedWatches.user2Id, u2)))
      .groupBy(sharedWatches.sourceUrl)

    const countMap = new Map(watchedCounts.map((r) => [r.sourceUrl, r.count]))

    return {
      ok: true,
      items: items.map((item) => ({
        ...item,
        watchedCount: countMap.get(item.sourceUrl) || 0,
      })),
    }
  })

  // Add show to shared library
  .post(
    "/api/shared-library",
    async ({ body }) => {
      try {
        const { userId, friendId, sourceUrl, status } = body

        // Verify friendship exists
        const u1 = Math.min(userId, friendId)
        const u2 = Math.max(userId, friendId)
        const friendship = await db
          .select()
          .from(friendships)
          .where(
            and(
              eq(friendships.status, "accepted"),
              or(
                and(eq(friendships.senderId, userId), eq(friendships.receiverId, friendId)),
                and(eq(friendships.senderId, friendId), eq(friendships.receiverId, userId)),
              ),
            ),
          )
          .limit(1)

        if (friendship.length === 0) return { ok: false, error: "Not loved ones" }

        const show = await withTimeout(parseUakinoPage(sourceUrl), 30000, "Timed out loading page (30s)")

        const totalEpisodes = Math.max(...show.dubs.map((d) => d.episodes.length), 0)

        const [item] = await db
          .insert(sharedLibrary)
          .values({
            user1Id: u1,
            user2Id: u2,
            sourceUrl,
            title: show.title,
            poster: show.poster,
            totalEpisodes,
            status: (status || "plan_to_watch") as typeof sharedLibrary.$inferInsert.status,
          })
          .onConflictDoUpdate({
            target: [sharedLibrary.user1Id, sharedLibrary.user2Id, sharedLibrary.sourceUrl],
            set: {
              title: show.title,
              poster: show.poster,
              totalEpisodes,
              ...(status ? { status: status as typeof sharedLibrary.$inferInsert.status } : {}),
            },
          })
          .returning()

        return { ok: true, item: { ...item, watchedCount: 0 } }
      } catch (e) {
        return { ok: false, error: errMsg(e) }
      }
    },
    {
      body: t.Object({
        userId: t.Number(),
        friendId: t.Number(),
        sourceUrl: t.String(),
        status: t.Optional(t.String()),
      }),
    },
  )

  // Update shared library item status
  .patch(
    "/api/shared-library",
    async ({ body }) => {
      try {
        const [updated] = await db
          .update(sharedLibrary)
          .set({ status: body.status as typeof sharedLibrary.$inferInsert.status })
          .where(eq(sharedLibrary.id, body.id))
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

  // Remove from shared library
  .delete(
    "/api/shared-library",
    async ({ body }) => {
      try {
        await db.delete(sharedLibrary).where(eq(sharedLibrary.id, body.id))
        return { ok: true }
      } catch (e) {
        return { ok: false, error: errMsg(e) }
      }
    },
    {
      body: t.Object({ id: t.Number() }),
    },
  )
