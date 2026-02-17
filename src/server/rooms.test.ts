import { describe, it, expect, beforeEach, vi } from "vitest"
import type { RoomClient } from "./types"

// We need to isolate the rooms module state between tests
let rooms: typeof import("./rooms")

beforeEach(async () => {
  vi.resetModules()
  rooms = await import("./rooms")
})

function makeMockClient(id: string, name = "User"): RoomClient {
  return { id, ws: { send: vi.fn() }, isHost: false, name, userId: null }
}

describe("rooms", () => {
  describe("createRoom", () => {
    it("creates a room with a 5-char code", () => {
      const room = rooms.createRoom("host1")
      expect(room.code).toHaveLength(5)
      expect(room.hostId).toBe("host1")
      expect(room.clients.size).toBe(0)
    })

    it("initializes room with default state", () => {
      const room = rooms.createRoom("host1")
      expect(room.show).toBeNull()
      expect(room.sourceUrl).toBeNull()
      expect(room.currentEpisode).toBeNull()
      expect(room.streamUrl).toBeNull()
      expect(room.isPlaying).toBe(false)
      expect(room.currentTime).toBe(0)
    })

    it("creates unique room codes", () => {
      const codes = new Set<string>()
      for (let i = 0; i < 20; i++) {
        const room = rooms.createRoom(`host_${i}`)
        codes.add(room.code)
      }
      expect(codes.size).toBe(20)
    })
  })

  describe("getRoom", () => {
    it("returns a room by code", () => {
      const room = rooms.createRoom("host1")
      const found = rooms.getRoom(room.code)
      expect(found).toBe(room)
    })

    it("is case-insensitive", () => {
      const room = rooms.createRoom("host1")
      const found = rooms.getRoom(room.code.toLowerCase())
      expect(found).toBe(room)
    })

    it("returns undefined for non-existent room", () => {
      expect(rooms.getRoom("ZZZZZ")).toBeUndefined()
    })
  })

  describe("addClient / removeClient", () => {
    it("adds a client to a room", () => {
      const room = rooms.createRoom("host1")
      const client = makeMockClient("c1", "Alice")
      rooms.addClient(room, client)
      expect(room.clients.size).toBe(1)
      expect(room.clients.get("c1")).toBe(client)
    })

    it("removes a client from a room", () => {
      const room = rooms.createRoom("host1")
      const client = makeMockClient("c1")
      rooms.addClient(room, client)
      rooms.removeClient(room, "c1")
      expect(room.clients.size).toBe(0)
    })

    it("cleans up room when last client leaves", () => {
      const room = rooms.createRoom("host1")
      const client = makeMockClient("host1")
      rooms.addClient(room, client)
      rooms.removeClient(room, "host1")
      expect(rooms.getRoom(room.code)).toBeUndefined()
    })
  })

  describe("host transition", () => {
    it("transfers host to next client when host leaves", () => {
      const room = rooms.createRoom("host1")
      const host = makeMockClient("host1", "Host")
      const guest = makeMockClient("guest1", "Guest")
      rooms.addClient(room, host)
      rooms.addClient(room, guest)

      rooms.removeClient(room, "host1")

      expect(room.hostId).toBe("guest1")
      expect(guest.isHost).toBe(true)
      expect(room.clients.size).toBe(1)
    })

    it("does not change host when non-host leaves", () => {
      const room = rooms.createRoom("host1")
      const host = makeMockClient("host1", "Host")
      const guest = makeMockClient("guest1", "Guest")
      rooms.addClient(room, host)
      rooms.addClient(room, guest)

      rooms.removeClient(room, "guest1")

      expect(room.hostId).toBe("host1")
      expect(room.clients.size).toBe(1)
    })
  })

  describe("broadcastToRoom", () => {
    it("sends message to all clients", () => {
      const room = rooms.createRoom("host1")
      const c1 = makeMockClient("c1")
      const c2 = makeMockClient("c2")
      rooms.addClient(room, c1)
      rooms.addClient(room, c2)

      rooms.broadcastToRoom(room, { type: "test", data: 1 })

      const expected = JSON.stringify({ type: "test", data: 1 })
      expect(c1.ws.send).toHaveBeenCalledWith(expected)
      expect(c2.ws.send).toHaveBeenCalledWith(expected)
    })

    it("excludes specified client", () => {
      const room = rooms.createRoom("host1")
      const c1 = makeMockClient("c1")
      const c2 = makeMockClient("c2")
      rooms.addClient(room, c1)
      rooms.addClient(room, c2)

      rooms.broadcastToRoom(room, { type: "test" }, "c1")

      expect(c1.ws.send).not.toHaveBeenCalled()
      expect(c2.ws.send).toHaveBeenCalled()
    })

    it("handles send errors gracefully", () => {
      const room = rooms.createRoom("host1")
      const c1 = makeMockClient("c1")
      ;(c1.ws.send as ReturnType<typeof vi.fn>).mockImplementation(() => {
        throw new Error("disconnected")
      })
      const c2 = makeMockClient("c2")
      rooms.addClient(room, c1)
      rooms.addClient(room, c2)

      expect(() => rooms.broadcastToRoom(room, { type: "test" })).not.toThrow()
      expect(c2.ws.send).toHaveBeenCalled()
    })
  })

  describe("getRoomInfo", () => {
    it("returns correct info for host", () => {
      const room = rooms.createRoom("host1")
      const host = makeMockClient("host1", "Alice")
      const guest = makeMockClient("guest1", "Bob")
      rooms.addClient(room, host)
      rooms.addClient(room, guest)

      const info = rooms.getRoomInfo(room, "host1")

      expect(info.code).toBe(room.code)
      expect(info.hostId).toBe("host1")
      expect(info.clientId).toBe("host1")
      expect(info.isHost).toBe(true)
      expect(info.clientCount).toBe(2)
      expect(info.viewers).toEqual(["Alice", "Bob"])
    })

    it("returns isHost=false for guest", () => {
      const room = rooms.createRoom("host1")
      const host = makeMockClient("host1")
      const guest = makeMockClient("guest1")
      rooms.addClient(room, host)
      rooms.addClient(room, guest)

      const info = rooms.getRoomInfo(room, "guest1")
      expect(info.isHost).toBe(false)
    })

    it("includes show and playback state", () => {
      const room = rooms.createRoom("host1")
      const host = makeMockClient("host1")
      rooms.addClient(room, host)

      room.show = { title: "Movie", poster: "/p.jpg", dubs: [] }
      room.sourceUrl = "https://example.com"
      room.isPlaying = true
      room.currentTime = 42.5

      const info = rooms.getRoomInfo(room, "host1")
      expect(info.show?.title).toBe("Movie")
      expect(info.sourceUrl).toBe("https://example.com")
      expect(info.isPlaying).toBe(true)
      expect(info.currentTime).toBe(42.5)
    })
  })

  describe("generateClientId", () => {
    it("generates unique client IDs", () => {
      const ids = new Set<string>()
      for (let i = 0; i < 10; i++) {
        ids.add(rooms.generateClientId())
      }
      expect(ids.size).toBe(10)
    })

    it("starts with c_ prefix", () => {
      const id = rooms.generateClientId()
      expect(id).toMatch(/^c_/)
    })
  })
})
