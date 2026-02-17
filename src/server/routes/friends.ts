import { Elysia, t } from "elysia"
import { db } from "../db"
import { users, friendships, sharedWatches } from "../db/schema"
import { eq, and, or, ne, ilike, desc } from "drizzle-orm"
import { notifyUser } from "../ws/state"

const errMsg = (e: unknown): string => (e instanceof Error ? e.message : "Unknown error")

export default new Elysia()
  // Search users by username
  .get("/api/users/search", async ({ query }) => {
    const q = ((query.q as string) || "").trim()
    const userId = parseInt(query.userId as string)
    if (!q || !userId) return { ok: false, error: "Missing params" }

    const results = await db
      .select({ id: users.id, username: users.username })
      .from(users)
      .where(and(ilike(users.username, `%${q}%`), ne(users.id, userId)))
      .limit(10)

    return { ok: true, users: results }
  })

  // Send friend request
  .post(
    "/api/friends/request",
    async ({ body }) => {
      try {
        const { userId, friendUsername } = body

        const [friend] = await db
          .select({ id: users.id })
          .from(users)
          .where(eq(users.username, friendUsername))
          .limit(1)

        if (!friend) return { ok: false, error: "User not found" }
        if (friend.id === userId) return { ok: false, error: "Can't add yourself" }

        // Check if friendship already exists in either direction
        const existing = await db
          .select()
          .from(friendships)
          .where(
            or(
              and(eq(friendships.senderId, userId), eq(friendships.receiverId, friend.id)),
              and(eq(friendships.senderId, friend.id), eq(friendships.receiverId, userId)),
            ),
          )
          .limit(1)

        if (existing.length > 0) {
          if (existing[0].status === "accepted") return { ok: false, error: "Already friends" }
          return { ok: false, error: "Request already exists" }
        }

        await db.insert(friendships).values({ senderId: userId, receiverId: friend.id })

        // Get sender username for notification
        const [sender] = await db.select({ username: users.username }).from(users).where(eq(users.id, userId)).limit(1)
        if (sender) {
          notifyUser(friend.id, { type: "friend-request-received", from: { id: userId, username: sender.username } })
        }

        return { ok: true }
      } catch (e) {
        return { ok: false, error: errMsg(e) }
      }
    },
    { body: t.Object({ userId: t.Number(), friendUsername: t.String() }) },
  )

  // Accept friend request
  .post(
    "/api/friends/accept",
    async ({ body }) => {
      try {
        // Get the friendship before updating to know who to notify
        const [friendship] = await db.select().from(friendships).where(eq(friendships.id, body.friendshipId)).limit(1)

        await db
          .update(friendships)
          .set({ status: "accepted" })
          .where(and(eq(friendships.id, body.friendshipId), eq(friendships.status, "pending")))

        // Notify the original sender that their request was accepted
        if (friendship) {
          const [acceptor] = await db
            .select({ username: users.username })
            .from(users)
            .where(eq(users.id, friendship.receiverId))
            .limit(1)
          if (acceptor) {
            notifyUser(friendship.senderId, {
              type: "friend-accepted",
              by: { id: friendship.receiverId, username: acceptor.username },
            })
          }
        }

        return { ok: true }
      } catch (e) {
        return { ok: false, error: errMsg(e) }
      }
    },
    { body: t.Object({ friendshipId: t.Number() }) },
  )

  // Reject friend request
  .post(
    "/api/friends/reject",
    async ({ body }) => {
      try {
        const [friendship] = await db.select().from(friendships).where(eq(friendships.id, body.friendshipId)).limit(1)

        await db
          .delete(friendships)
          .where(and(eq(friendships.id, body.friendshipId), eq(friendships.status, "pending")))

        // Notify the sender that their request was rejected (remove from sent list)
        if (friendship) {
          notifyUser(friendship.senderId, { type: "friend-request-cancelled", by: friendship.receiverId })
        }

        return { ok: true }
      } catch (e) {
        return { ok: false, error: errMsg(e) }
      }
    },
    { body: t.Object({ friendshipId: t.Number() }) },
  )

  // Get friends list
  .get("/api/friends", async ({ query }) => {
    const userId = parseInt(query.userId as string)
    if (!userId) return { ok: false, error: "Missing userId" }

    // Friends where current user is sender
    const asSender = await db
      .select({
        friendshipId: friendships.id,
        userId: users.id,
        username: users.username,
        since: friendships.createdAt,
      })
      .from(friendships)
      .innerJoin(users, eq(users.id, friendships.receiverId))
      .where(and(eq(friendships.senderId, userId), eq(friendships.status, "accepted")))

    // Friends where current user is receiver
    const asReceiver = await db
      .select({
        friendshipId: friendships.id,
        userId: users.id,
        username: users.username,
        since: friendships.createdAt,
      })
      .from(friendships)
      .innerJoin(users, eq(users.id, friendships.senderId))
      .where(and(eq(friendships.receiverId, userId), eq(friendships.status, "accepted")))

    return { ok: true, friends: [...asSender, ...asReceiver] }
  })

  // Get pending friend requests (incoming)
  .get("/api/friends/requests", async ({ query }) => {
    const userId = parseInt(query.userId as string)
    if (!userId) return { ok: false, error: "Missing userId" }

    const requests = await db
      .select({
        friendshipId: friendships.id,
        senderId: users.id,
        senderUsername: users.username,
        createdAt: friendships.createdAt,
      })
      .from(friendships)
      .innerJoin(users, eq(users.id, friendships.senderId))
      .where(and(eq(friendships.receiverId, userId), eq(friendships.status, "pending")))

    return { ok: true, requests }
  })

  // Get sent friend requests (outgoing)
  .get("/api/friends/sent", async ({ query }) => {
    const userId = parseInt(query.userId as string)
    if (!userId) return { ok: false, error: "Missing userId" }

    const sent = await db
      .select({
        friendshipId: friendships.id,
        receiverId: users.id,
        receiverUsername: users.username,
        createdAt: friendships.createdAt,
      })
      .from(friendships)
      .innerJoin(users, eq(users.id, friendships.receiverId))
      .where(and(eq(friendships.senderId, userId), eq(friendships.status, "pending")))

    return { ok: true, sent }
  })

  // Cancel sent friend request
  .post(
    "/api/friends/cancel",
    async ({ body }) => {
      try {
        const [friendship] = await db.select().from(friendships).where(eq(friendships.id, body.friendshipId)).limit(1)

        await db
          .delete(friendships)
          .where(and(eq(friendships.id, body.friendshipId), eq(friendships.status, "pending")))

        if (friendship) {
          notifyUser(friendship.receiverId, { type: "friend-request-cancelled", by: friendship.senderId })
        }

        return { ok: true }
      } catch (e) {
        return { ok: false, error: errMsg(e) }
      }
    },
    { body: t.Object({ friendshipId: t.Number() }) },
  )

  // Remove friend
  .delete(
    "/api/friends",
    async ({ body }) => {
      try {
        // Get friendship before deleting to notify the other user
        const [friendship] = await db.select().from(friendships).where(eq(friendships.id, body.friendshipId)).limit(1)

        await db.delete(friendships).where(eq(friendships.id, body.friendshipId))

        if (friendship) {
          const removerId = body.userId
          const otherId = friendship.senderId === removerId ? friendship.receiverId : friendship.senderId
          const [remover] = await db
            .select({ username: users.username })
            .from(users)
            .where(eq(users.id, removerId))
            .limit(1)
          if (remover && otherId) {
            notifyUser(otherId, { type: "friend-removed", by: { id: removerId, username: remover.username } })
          }
        }

        return { ok: true }
      } catch (e) {
        return { ok: false, error: errMsg(e) }
      }
    },
    { body: t.Object({ friendshipId: t.Number(), userId: t.Number() }) },
  )

  // Get shared watches between two users
  .get("/api/friends/shared", async ({ query }) => {
    const userId = parseInt(query.userId as string)
    const friendId = parseInt(query.friendId as string)
    if (!userId || !friendId) return { ok: false, error: "Missing params" }

    const u1 = Math.min(userId, friendId)
    const u2 = Math.max(userId, friendId)

    const rows = await db
      .select()
      .from(sharedWatches)
      .where(and(eq(sharedWatches.user1Id, u1), eq(sharedWatches.user2Id, u2)))
      .orderBy(desc(sharedWatches.watchedAt))

    // Group by sourceUrl
    const grouped = new Map<
      string,
      {
        sourceUrl: string
        title: string
        poster: string
        episodes: { episodeId: string | null; episodeName: string | null; watchedAt: string | null }[]
        lastWatchedAt: string | null
      }
    >()

    for (const row of rows) {
      const key = row.sourceUrl
      if (!grouped.has(key)) {
        grouped.set(key, {
          sourceUrl: row.sourceUrl,
          title: row.title,
          poster: row.poster,
          episodes: [],
          lastWatchedAt: row.watchedAt?.toISOString() ?? null,
        })
      }
      const item = grouped.get(key)!
      if (row.episodeId) {
        item.episodes.push({
          episodeId: row.episodeId,
          episodeName: row.episodeName,
          watchedAt: row.watchedAt?.toISOString() ?? null,
        })
      }
    }

    return { ok: true, items: Array.from(grouped.values()) }
  })
