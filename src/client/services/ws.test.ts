import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

// Track created WebSocket instances
let lastWs: any
const instances: any[] = []

class FakeWebSocket {
  static CONNECTING = 0
  static OPEN = 1
  static CLOSING = 2
  static CLOSED = 3

  readyState = FakeWebSocket.OPEN
  onopen: ((ev: Event) => void) | null = null
  onclose: (() => void) | null = null
  onmessage: ((ev: MessageEvent) => void) | null = null
  onerror: ((ev: Event) => void) | null = null
  url: string
  sent: string[] = []

  constructor(url: string) {
    this.url = url
    lastWs = this
    instances.push(this)
    // Auto-fire open on next microtask
    setTimeout(() => {
      if (this.onopen) this.onopen(new Event("open"))
    }, 0)
  }

  send(data: string) {
    this.sent.push(data)
  }

  close() {
    this.readyState = FakeWebSocket.CLOSED
  }

  // Test helpers
  simulateMessage(data: object) {
    this.onmessage?.(new MessageEvent("message", { data: JSON.stringify(data) }))
  }

  simulateClose() {
    this.readyState = FakeWebSocket.CLOSED
    this.onclose?.()
  }
}

vi.stubGlobal("WebSocket", FakeWebSocket)
vi.stubGlobal("location", { protocol: "http:", host: "localhost:5173" })

let ws: typeof import("./ws")

beforeEach(async () => {
  vi.resetModules()
  vi.useFakeTimers()
  lastWs = null
  instances.length = 0
  ws = await import("./ws")
})

afterEach(() => {
  vi.useRealTimers()
})

describe("ws service", () => {
  describe("getClientId", () => {
    it("returns a client ID", () => {
      const id = ws.getClientId()
      expect(id).toBeTruthy()
      expect(typeof id).toBe("string")
    })

    it("persists to sessionStorage", () => {
      const id = ws.getClientId()
      expect(sessionStorage.getItem("wt_clientId")).toBe(id)
    })
  })

  describe("setClientId", () => {
    it("updates the client ID", () => {
      ws.setClientId("new_id")
      expect(ws.getClientId()).toBe("new_id")
      expect(sessionStorage.getItem("wt_clientId")).toBe("new_id")
    })
  })

  describe("connect", () => {
    it("creates a WebSocket connection", () => {
      ws.connect()
      expect(lastWs).toBeTruthy()
      expect(lastWs.url).toBe("ws://localhost:5173/ws")
    })

    it("calls onOpen callback when connected", async () => {
      const onOpen = vi.fn()
      ws.connect(onOpen)
      await vi.advanceTimersByTimeAsync(10)
      expect(onOpen).toHaveBeenCalled()
    })

    it("closes existing socket before reconnecting", async () => {
      ws.connect()
      await vi.advanceTimersByTimeAsync(10)
      const first = lastWs

      ws.connect()
      expect(first.readyState).toBe(FakeWebSocket.CLOSED)
    })
  })

  describe("send", () => {
    it("sends message when connected", async () => {
      ws.connect()
      await vi.advanceTimersByTimeAsync(10)

      ws.send({ type: "chat", clientId: "c1", text: "hello" })

      expect(lastWs.sent).toHaveLength(1)
      expect(JSON.parse(lastWs.sent[0])).toEqual({ type: "chat", clientId: "c1", text: "hello" })
    })

    it("does not throw when not connected", () => {
      expect(() => ws.send({ type: "chat", clientId: "c1", text: "hello" })).not.toThrow()
    })
  })

  describe("message handlers", () => {
    it("dispatches messages to registered handlers", async () => {
      const handler = vi.fn()
      ws.addMessageHandler(handler)
      ws.connect()
      await vi.advanceTimersByTimeAsync(10)

      lastWs.simulateMessage({ type: "chat", name: "Alice", text: "hi", time: 123 })
      expect(handler).toHaveBeenCalledWith({ type: "chat", name: "Alice", text: "hi", time: 123 })
    })

    it("removes handler after calling removeMessageHandler", async () => {
      const handler = vi.fn()
      ws.addMessageHandler(handler)
      ws.connect()
      await vi.advanceTimersByTimeAsync(10)

      ws.removeMessageHandler(handler)
      lastWs.simulateMessage({ type: "chat", name: "Alice", text: "hi", time: 123 })
      expect(handler).not.toHaveBeenCalled()
    })
  })

  describe("isConnected", () => {
    it("returns false when not connected", () => {
      expect(ws.isConnected()).toBe(false)
    })

    it("returns true when connected", async () => {
      ws.connect()
      await vi.advanceTimersByTimeAsync(10)
      expect(ws.isConnected()).toBe(true)
    })
  })

  describe("disconnect", () => {
    it("closes the socket and prevents reconnection", async () => {
      ws.connect()
      await vi.advanceTimersByTimeAsync(10)

      ws.disconnect()
      expect(ws.isConnected()).toBe(false)
    })
  })

  describe("setReconnectInfo", () => {
    it("stores reconnect data without error", () => {
      expect(() => ws.setReconnectInfo("ABC12", "TestUser", 1)).not.toThrow()
    })
  })

  describe("connectWithIdentity", () => {
    it("connects and sends identify message", async () => {
      ws.connectWithIdentity(1, "TestUser")
      await vi.advanceTimersByTimeAsync(10)

      // The identify message is sent via the send() function in onopen
      expect(lastWs.sent.length).toBeGreaterThanOrEqual(1)
      const msg = JSON.parse(lastWs.sent[0])
      expect(msg.type).toBe("identify")
      expect(msg.userId).toBe(1)
      expect(msg.name).toBe("TestUser")
    })
  })
})
