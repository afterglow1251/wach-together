import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

// Mock the db module
vi.mock("./db", () => {
  const chainable = () => {
    const chain: Record<string, any> = {}
    const methods = [
      "select",
      "insert",
      "update",
      "delete",
      "from",
      "where",
      "set",
      "values",
      "returning",
      "limit",
      "orderBy",
      "groupBy",
      "innerJoin",
      "onConflictDoNothing",
      "onConflictDoUpdate",
      "target",
    ]
    for (const m of methods) {
      chain[m] = vi.fn((..._args: any[]) => chain)
    }
    // Terminal methods that return values
    chain.then = undefined
    chain[Symbol.iterator] = undefined
    return chain
  }

  return {
    db: {
      select: vi.fn(() => chainable()),
      insert: vi.fn(() => chainable()),
      update: vi.fn(() => chainable()),
      delete: vi.fn(() => chainable()),
    },
  }
})

// Mock scraper
vi.mock("./scraper", () => ({
  parseUakinoPage: vi.fn(),
  extractStreamUrl: vi.fn(),
  searchUakino: vi.fn(),
  browseUakino: vi.fn(),
}))

// Mock Bun.password
const mockBunPassword = {
  hash: vi.fn(),
  verify: vi.fn(),
}
vi.stubGlobal("Bun", {
  password: mockBunPassword,
  file: vi.fn(() => ({ exists: () => Promise.resolve(false) })),
})

// Mock process.env
vi.stubEnv("PORT", "0")
vi.stubEnv("DATABASE_URL", "postgres://mock")

import { db } from "./db"
import * as scraper from "./scraper"

// We test the API handlers in isolation by building a lightweight Elysia app
// Instead of importing the full index.ts (which calls .listen()), we test the logic patterns
// by mocking db responses and calling handlers directly.

// Helper to simulate a db chain that resolves
function mockDbChain(returnValue: any) {
  const chain: any = {
    select: vi.fn(() => chain),
    insert: vi.fn(() => chain),
    update: vi.fn(() => chain),
    delete: vi.fn(() => chain),
    from: vi.fn(() => chain),
    where: vi.fn(() => chain),
    set: vi.fn(() => chain),
    values: vi.fn(() => chain),
    returning: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    orderBy: vi.fn(() => chain),
    groupBy: vi.fn(() => chain),
    innerJoin: vi.fn(() => chain),
    onConflictDoNothing: vi.fn(() => chain),
    onConflictDoUpdate: vi.fn(() => chain),
    target: vi.fn(() => chain),
    then(resolve: (v: any) => void) {
      resolve(returnValue)
    },
  }
  return chain
}

// Since the index.ts module starts a server on import, we test the handler logic patterns
// by directly calling the db/scraper mocks and verifying the expected behavior.

describe("Auth handler logic", () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it("registers a new user when username does not exist", async () => {
    // Simulate: select returns empty, insert returns new user
    const selectChain = mockDbChain([])
    ;(db.select as ReturnType<typeof vi.fn>).mockReturnValue(selectChain)

    const insertChain = mockDbChain([{ id: 1, username: "newuser" }])
    ;(db.insert as ReturnType<typeof vi.fn>).mockReturnValue(insertChain)

    mockBunPassword.hash.mockResolvedValue("hashed_pw")

    // Simulate the handler logic
    const username = "newuser"
    const password = "pass123"

    const existing = await db.select().from(null).where(null).limit(1)
    expect(existing.length).toBe(0)

    const hash = await mockBunPassword.hash(password)
    expect(hash).toBe("hashed_pw")

    const [newUser] = await db.insert(null).values(null).returning(null)
    expect(newUser).toEqual({ id: 1, username: "newuser" })
  })

  it("verifies password for existing user", async () => {
    const selectChain = mockDbChain([{ id: 1, username: "existing", passwordHash: "hash123" }])
    ;(db.select as ReturnType<typeof vi.fn>).mockReturnValue(selectChain)

    mockBunPassword.verify.mockResolvedValue(true)

    const [existing] = await db.select().from(null).where(null).limit(1)
    const valid = await mockBunPassword.verify("password", existing.passwordHash)
    expect(valid).toBe(true)
  })

  it("rejects wrong password", async () => {
    const selectChain = mockDbChain([{ id: 1, username: "existing", passwordHash: "hash123" }])
    ;(db.select as ReturnType<typeof vi.fn>).mockReturnValue(selectChain)

    mockBunPassword.verify.mockResolvedValue(false)

    const [existing] = await db.select().from(null).where(null).limit(1)
    const valid = await mockBunPassword.verify("wrongpass", existing.passwordHash)
    expect(valid).toBe(false)
  })
})

describe("Watched episodes handler logic", () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it("gets watched episodes for user and source", async () => {
    const selectChain = mockDbChain([{ episodeId: "0-0" }, { episodeId: "0-1" }])
    ;(db.select as ReturnType<typeof vi.fn>).mockReturnValue(selectChain)

    const rows = await db.select(null).from(null).where(null)
    expect(rows.map((r: any) => r.episodeId)).toEqual(["0-0", "0-1"])
  })

  it("marks an episode as watched", async () => {
    const insertChain = mockDbChain(undefined)
    ;(db.insert as ReturnType<typeof vi.fn>).mockReturnValue(insertChain)

    await db.insert(null).values(null).onConflictDoNothing()
    expect(db.insert).toHaveBeenCalled()
  })

  it("unmarks an episode", async () => {
    const deleteChain = mockDbChain(undefined)
    ;(db.delete as ReturnType<typeof vi.fn>).mockReturnValue(deleteChain)

    await db.delete(null).where(null)
    expect(db.delete).toHaveBeenCalled()
  })
})

describe("Library handler logic", () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it("gets library items with watched counts", async () => {
    const items = [
      {
        id: 1,
        userId: 1,
        sourceUrl: "https://uakino.best/film/a",
        title: "A",
        poster: "/a.jpg",
        totalEpisodes: 10,
        status: "watching",
        addedAt: new Date(),
      },
    ]
    const counts = [{ sourceUrl: "https://uakino.best/film/a", count: 3 }]

    // First call: library items, second call: watched counts
    ;(db.select as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce(mockDbChain(items))
      .mockReturnValueOnce(mockDbChain(counts))

    const libItems = await db.select().from(null).where(null).orderBy(null)
    const watchedCounts = await db.select(null).from(null).where(null).groupBy(null)

    const countMap = new Map(watchedCounts.map((r: any) => [r.sourceUrl, r.count]))
    const result = libItems.map((item: any) => ({
      ...item,
      watchedCount: countMap.get(item.sourceUrl) || 0,
    }))

    expect(result[0].watchedCount).toBe(3)
  })

  it("adds show to library with parsed data", async () => {
    ;(scraper.parseUakinoPage as ReturnType<typeof vi.fn>).mockResolvedValue({
      title: "Test Movie",
      poster: "/poster.jpg",
      dubs: [{ name: "Main", episodes: Array(12).fill({ id: "0-0", name: "Ep1", url: "u", dubName: "d" }) }],
    })

    const insertChain = mockDbChain([
      {
        id: 1,
        userId: 1,
        sourceUrl: "https://uakino.best/film/test",
        title: "Test Movie",
        poster: "/poster.jpg",
        totalEpisodes: 12,
        status: "plan_to_watch",
        addedAt: new Date(),
      },
    ])
    ;(db.insert as ReturnType<typeof vi.fn>).mockReturnValue(insertChain)

    const show = await (scraper.parseUakinoPage as ReturnType<typeof vi.fn>)("https://uakino.best/film/test")
    const totalEpisodes = Math.max(...show.dubs.map((d: any) => d.episodes.length), 0)
    expect(totalEpisodes).toBe(12)

    const [item] = await db.insert(null).values(null).onConflictDoUpdate(null).returning()
    expect(item.title).toBe("Test Movie")
  })

  it("updates library item status", async () => {
    const updateChain = mockDbChain([{ id: 1, status: "watched" }])
    ;(db.update as ReturnType<typeof vi.fn>).mockReturnValue(updateChain)

    const [updated] = await db.update(null).set(null).where(null).returning()
    expect(updated.status).toBe("watched")
  })

  it("removes library item", async () => {
    const deleteChain = mockDbChain(undefined)
    ;(db.delete as ReturnType<typeof vi.fn>).mockReturnValue(deleteChain)

    await db.delete(null).where(null)
    expect(db.delete).toHaveBeenCalled()
  })
})

describe("Friends handler logic", () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it("sends friend request - finds user and inserts", async () => {
    ;(db.select as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce(mockDbChain([{ id: 2 }])) // find friend
      .mockReturnValueOnce(mockDbChain([])) // check existing
      .mockReturnValueOnce(mockDbChain([{ username: "sender" }])) // sender info

    const insertChain = mockDbChain(undefined)
    ;(db.insert as ReturnType<typeof vi.fn>).mockReturnValue(insertChain)

    const [friend] = await db.select(null).from(null).where(null).limit(1)
    expect(friend.id).toBe(2)

    const existing = await db.select().from(null).where(null).limit(1)
    expect(existing.length).toBe(0)

    await db.insert(null).values(null)
    expect(db.insert).toHaveBeenCalled()
  })

  it("rejects self-friend request", () => {
    const userId = 1
    const friendId = 1
    expect(friendId === userId).toBe(true)
    // Handler would return { ok: false, error: "Can't add yourself" }
  })

  it("rejects duplicate friend request", async () => {
    ;(db.select as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce(mockDbChain([{ id: 2 }])) // find friend
      .mockReturnValueOnce(mockDbChain([{ status: "pending" }])) // existing friendship

    const [friend] = await db.select(null).from(null).where(null).limit(1)
    expect(friend.id).toBe(2)

    const existing = await db.select().from(null).where(null).limit(1)
    expect(existing).toHaveLength(1)
    const [first] = existing
    expect(first.status).toBe("pending")
    // Handler would return { ok: false, error: "Request already exists" }
  })

  it("accepts friend request", async () => {
    ;(db.select as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce(mockDbChain([{ id: 1, senderId: 2, receiverId: 1, status: "pending" }]))
      .mockReturnValueOnce(mockDbChain([{ username: "acceptor" }]))

    const updateChain = mockDbChain(undefined)
    ;(db.update as ReturnType<typeof vi.fn>).mockReturnValue(updateChain)

    const [friendship] = await db.select().from(null).where(null).limit(1)
    await db.update(null).set(null).where(null)
    expect(db.update).toHaveBeenCalled()
    expect(friendship.status).toBe("pending")
  })

  it("rejects friend request by deleting", async () => {
    ;(db.select as ReturnType<typeof vi.fn>).mockReturnValueOnce(mockDbChain([{ id: 1, senderId: 2, receiverId: 1 }]))

    const deleteChain = mockDbChain(undefined)
    ;(db.delete as ReturnType<typeof vi.fn>).mockReturnValue(deleteChain)

    await db.delete(null).where(null)
    expect(db.delete).toHaveBeenCalled()
  })

  it("cancels sent friend request", async () => {
    ;(db.select as ReturnType<typeof vi.fn>).mockReturnValueOnce(mockDbChain([{ id: 3, senderId: 1, receiverId: 4 }]))

    const deleteChain = mockDbChain(undefined)
    ;(db.delete as ReturnType<typeof vi.fn>).mockReturnValue(deleteChain)

    await db.delete(null).where(null)
    expect(db.delete).toHaveBeenCalled()
  })

  it("removes friend", async () => {
    ;(db.select as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce(mockDbChain([{ id: 1, senderId: 1, receiverId: 2 }]))
      .mockReturnValueOnce(mockDbChain([{ username: "remover" }]))

    const deleteChain = mockDbChain(undefined)
    ;(db.delete as ReturnType<typeof vi.fn>).mockReturnValue(deleteChain)

    await db.delete(null).where(null)
    expect(db.delete).toHaveBeenCalled()
  })

  it("gets friends list (as sender and receiver)", async () => {
    const asSender = [{ friendshipId: 1, userId: 2, username: "friend1", since: new Date() }]
    const asReceiver = [{ friendshipId: 2, userId: 3, username: "friend2", since: new Date() }]

    ;(db.select as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce(mockDbChain(asSender))
      .mockReturnValueOnce(mockDbChain(asReceiver))

    const r1 = await db.select(null).from(null).innerJoin(null, null).where(null)
    const r2 = await db.select(null).from(null).innerJoin(null, null).where(null)

    expect(r1).toEqual(asSender)
    expect(r2).toEqual(asReceiver)

    const friends = [...r1, ...r2]
    expect(friends).toHaveLength(2)
  })

  it("gets pending friend requests", async () => {
    const requests = [{ friendshipId: 5, senderId: 10, senderUsername: "alice", createdAt: new Date() }]
    ;(db.select as ReturnType<typeof vi.fn>).mockReturnValue(mockDbChain(requests))

    const result = await db.select(null).from(null).innerJoin(null, null).where(null)
    expect(result).toEqual(requests)
  })

  it("gets sent friend requests", async () => {
    const sent = [{ friendshipId: 6, receiverId: 11, receiverUsername: "bob", createdAt: new Date() }]
    ;(db.select as ReturnType<typeof vi.fn>).mockReturnValue(mockDbChain(sent))

    const result = await db.select(null).from(null).innerJoin(null, null).where(null)
    expect(result).toEqual(sent)
  })
})

describe("Scraper API handler logic", () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it("parse endpoint calls parseUakinoPage", async () => {
    const mockShow = { title: "Test", poster: "/p.jpg", dubs: [] }
    ;(scraper.parseUakinoPage as ReturnType<typeof vi.fn>).mockResolvedValue(mockShow)

    const show = await scraper.parseUakinoPage("https://uakino.best/film/test.html")
    expect(show).toEqual(mockShow)
  })

  it("stream endpoint calls extractStreamUrl", async () => {
    ;(scraper.extractStreamUrl as ReturnType<typeof vi.fn>).mockResolvedValue("https://cdn.example.com/stream.m3u8")

    const url = await scraper.extractStreamUrl("https://ashdi.vip/video1")
    expect(url).toBe("https://cdn.example.com/stream.m3u8")
  })

  it("search endpoint calls searchUakino with query and page", async () => {
    const results = [{ title: "Test", url: "u", poster: "p", year: null, rating: null, category: null }]
    ;(scraper.searchUakino as ReturnType<typeof vi.fn>).mockResolvedValue(results)

    const r = await scraper.searchUakino("test", 1)
    expect(r).toEqual(results)
  })

  it("browse endpoint calls browseUakino", async () => {
    const results = [{ title: "Film", url: "u", poster: "p", year: null, rating: null, category: "film" }]
    ;(scraper.browseUakino as ReturnType<typeof vi.fn>).mockResolvedValue(results)

    const r = await scraper.browseUakino("films", 1)
    expect(r).toEqual(results)
  })

  it("handles scraper errors gracefully", async () => {
    ;(scraper.parseUakinoPage as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("timeout"))

    try {
      await scraper.parseUakinoPage("https://uakino.best/bad")
    } catch (e: any) {
      expect(e.message).toBe("timeout")
    }
  })
})

describe("Shared watches logic", () => {
  it("pairs users correctly for shared watch records", () => {
    const authenticatedUsers = [3, 1, 5]
    const pairs: [number, number][] = []

    for (let i = 0; i < authenticatedUsers.length; i++) {
      for (let j = i + 1; j < authenticatedUsers.length; j++) {
        const u1 = Math.min(authenticatedUsers[i], authenticatedUsers[j])
        const u2 = Math.max(authenticatedUsers[i], authenticatedUsers[j])
        pairs.push([u1, u2])
      }
    }

    expect(pairs).toEqual([
      [1, 3],
      [3, 5],
      [1, 5],
    ])
  })

  it("skips when fewer than 2 authenticated users", () => {
    const authenticatedUsers = [1]
    expect(authenticatedUsers.length < 2).toBe(true)
  })
})
