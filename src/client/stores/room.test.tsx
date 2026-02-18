import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@solidjs/testing-library"
import { RoomProvider, useRoom } from "./room"
import type { WSServerMessage } from "../../shared/ws-types"
import type { RoomInfo } from "../../shared/types"
import { mockRoomInfo, mockShow, mockEpisode } from "../../../tests/fixtures/mock-data"

// Capture the message handler registered with ws
let capturedHandler: ((msg: WSServerMessage) => void) | null = null
const mockSend = vi.fn()

vi.mock("../services/ws", () => ({
  addMessageHandler: vi.fn((h: any) => {
    capturedHandler = h
  }),
  removeMessageHandler: vi.fn(),
  getClientId: vi.fn(() => "c_test"),
  setClientId: vi.fn(),
  setReconnectInfo: vi.fn(),
  connect: vi.fn((cb?: () => void) => cb?.()),
  connectWithIdentity: vi.fn(),
  isConnected: vi.fn(() => true),
  send: (...args: any[]) => mockSend(...args),
  disconnect: vi.fn(),
}))

vi.mock("../services/audio", () => ({
  playNotificationBeep: vi.fn(),
}))

function TestConsumer() {
  const room = useRoom()
  return (
    <div>
      <span data-testid="connected">{room.state.connected ? "yes" : "no"}</span>
      <span data-testid="room-code">{room.state.roomCode ?? "none"}</span>
      <span data-testid="is-host">{room.state.isHost ? "yes" : "no"}</span>
      <span data-testid="client-count">{room.state.clientCount}</span>
      <span data-testid="viewers">{room.state.viewers.join(",")}</span>
      <span data-testid="show-title">{room.state.show?.title ?? "none"}</span>
      <span data-testid="source-url">{room.state.sourceUrl ?? "none"}</span>
      <span data-testid="episode">{room.state.currentEpisode?.name ?? "none"}</span>
      <span data-testid="stream-url">{room.state.streamUrl ?? "none"}</span>
      <span data-testid="is-playing">{room.state.isPlaying ? "yes" : "no"}</span>
      <span data-testid="current-time">{room.state.currentTime}</span>
      <span data-testid="chat-count">{room.state.chat.length}</span>
      <span data-testid="typing">{room.state.typingUser ?? "none"}</span>
      <span data-testid="reaction">{room.state.lastReaction?.emoji ?? "none"}</span>

      <button data-testid="create-room" onClick={() => room.createRoom("TestUser")}>
        Create
      </button>
      <button data-testid="join-room" onClick={() => room.joinRoom("ABC12", "TestUser")}>
        Join
      </button>
      <button data-testid="leave-room" onClick={() => room.leaveRoom()}>
        Leave
      </button>
      <button data-testid="set-show" onClick={() => room.setShow(mockShow, "https://uakino.best/test")}>
        SetShow
      </button>
      <button data-testid="select-ep" onClick={() => room.selectEpisode(mockEpisode)}>
        SelectEp
      </button>
      <button data-testid="send-play" onClick={() => room.sendPlay(10)}>
        Play
      </button>
      <button data-testid="send-pause" onClick={() => room.sendPause(15)}>
        Pause
      </button>
      <button data-testid="send-seek" onClick={() => room.sendSeek(30)}>
        Seek
      </button>
      <button data-testid="send-sync" onClick={() => room.sendSync(45, true)}>
        Sync
      </button>
      <button data-testid="send-chat" onClick={() => room.sendChat("hello")}>
        Chat
      </button>
      <button data-testid="send-reaction" onClick={() => room.sendReaction("❤️")}>
        React
      </button>
      <button data-testid="send-typing" onClick={() => room.sendTyping()}>
        Typing
      </button>
    </div>
  )
}

function renderRoom() {
  capturedHandler = null
  mockSend.mockClear()

  return render(() => (
    <RoomProvider username={() => "TestUser"} userId={() => 1}>
      <TestConsumer />
    </RoomProvider>
  ))
}

function simulateMessage(msg: WSServerMessage) {
  capturedHandler?.(msg)
}

describe("RoomProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("initial state", () => {
    it("starts disconnected", () => {
      renderRoom()
      expect(screen.getByTestId("connected").textContent).toBe("no")
      expect(screen.getByTestId("room-code").textContent).toBe("none")
    })
  })

  describe("handleMessage: room-info", () => {
    it("sets room info on join", () => {
      renderRoom()
      simulateMessage({ type: "room-info", room: mockRoomInfo })

      expect(screen.getByTestId("connected").textContent).toBe("yes")
      expect(screen.getByTestId("room-code").textContent).toBe("ABC12")
      expect(screen.getByTestId("is-host").textContent).toBe("yes")
      expect(screen.getByTestId("client-count").textContent).toBe("1")
    })
  })

  describe("handleMessage: show-loaded", () => {
    it("sets show data", () => {
      renderRoom()
      simulateMessage({ type: "show-loaded", show: mockShow, sourceUrl: "https://uakino.best/test" })

      expect(screen.getByTestId("show-title").textContent).toBe("Test Movie")
      expect(screen.getByTestId("source-url").textContent).toBe("https://uakino.best/test")
    })
  })

  describe("handleMessage: episode-changed", () => {
    it("updates current episode and stream URL", () => {
      renderRoom()
      simulateMessage({
        type: "episode-changed",
        episode: mockEpisode,
        streamUrl: "https://cdn.example.com/stream.m3u8",
      })

      expect(screen.getByTestId("episode").textContent).toBe("Серія 1")
      expect(screen.getByTestId("stream-url").textContent).toBe("https://cdn.example.com/stream.m3u8")
    })
  })

  describe("handleMessage: playback controls", () => {
    it("handles play message", () => {
      renderRoom()
      simulateMessage({ type: "play", time: 10.5 })

      expect(screen.getByTestId("is-playing").textContent).toBe("yes")
      expect(screen.getByTestId("current-time").textContent).toBe("10.5")
    })

    it("handles pause message", () => {
      renderRoom()
      simulateMessage({ type: "play", time: 10 })
      simulateMessage({ type: "pause", time: 15.3 })

      expect(screen.getByTestId("is-playing").textContent).toBe("no")
      expect(screen.getByTestId("current-time").textContent).toBe("15.3")
    })

    it("handles seek message", () => {
      renderRoom()
      simulateMessage({ type: "seek", time: 60 })

      expect(screen.getByTestId("current-time").textContent).toBe("60")
    })

    it("handles sync message", () => {
      renderRoom()
      simulateMessage({ type: "sync", time: 120, isPlaying: true })

      expect(screen.getByTestId("current-time").textContent).toBe("120")
      expect(screen.getByTestId("is-playing").textContent).toBe("yes")
    })
  })

  describe("handleMessage: users", () => {
    it("handles user-joined", () => {
      renderRoom()
      simulateMessage({ type: "user-joined", name: "Bob", count: 2, viewers: ["TestUser", "Bob"] })

      expect(screen.getByTestId("client-count").textContent).toBe("2")
      expect(screen.getByTestId("viewers").textContent).toBe("TestUser,Bob")
    })

    it("handles user-left", () => {
      renderRoom()
      simulateMessage({ type: "user-joined", name: "Bob", count: 2, viewers: ["TestUser", "Bob"] })
      simulateMessage({ type: "user-left", name: "Bob", count: 1, viewers: ["TestUser"] })

      expect(screen.getByTestId("client-count").textContent).toBe("1")
    })
  })

  describe("handleMessage: chat", () => {
    it("adds chat messages", () => {
      renderRoom()
      simulateMessage({ type: "chat", name: "Alice", text: "hello", time: 123, msgId: 1 })

      expect(screen.getByTestId("chat-count").textContent).toBe("1")
    })

    it("plays beep for messages from others", async () => {
      const { playNotificationBeep } = await import("../services/audio")
      renderRoom()
      simulateMessage({ type: "chat", name: "Alice", text: "hello", time: 123, msgId: 2 })

      expect(playNotificationBeep).toHaveBeenCalled()
    })

    it("does not play beep for own messages", async () => {
      const { playNotificationBeep } = await import("../services/audio")
      renderRoom()
      simulateMessage({ type: "chat", name: "TestUser", text: "hello", time: 123, msgId: 3 })

      expect(playNotificationBeep).not.toHaveBeenCalled()
    })
  })

  describe("handleMessage: reaction", () => {
    it("sets last reaction", () => {
      renderRoom()
      simulateMessage({ type: "reaction", name: "Alice", emoji: "❤️" })

      expect(screen.getByTestId("reaction").textContent).toBe("❤️")
    })
  })

  describe("handleMessage: typing", () => {
    it("sets typing user", () => {
      renderRoom()
      simulateMessage({ type: "typing", name: "Bob" })

      expect(screen.getByTestId("typing").textContent).toBe("Bob")
    })
  })

  describe("actions: send messages", () => {
    it("createRoom sends join with empty roomCode", () => {
      renderRoom()
      screen.getByTestId("create-room").click()

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "join",
          roomCode: "",
          name: "TestUser",
        }),
      )
    })

    it("joinRoom sends join with roomCode", () => {
      renderRoom()
      screen.getByTestId("join-room").click()

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "join",
          roomCode: "ABC12",
          name: "TestUser",
        }),
      )
    })

    it("sendPlay sends play message", () => {
      renderRoom()
      screen.getByTestId("send-play").click()

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "play",
          time: 10,
        }),
      )
    })

    it("sendPause sends pause message", () => {
      renderRoom()
      screen.getByTestId("send-pause").click()

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "pause",
          time: 15,
        }),
      )
    })

    it("sendSeek sends seek message", () => {
      renderRoom()
      screen.getByTestId("send-seek").click()

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "seek",
          time: 30,
        }),
      )
    })

    it("sendChat sends chat message", () => {
      renderRoom()
      screen.getByTestId("send-chat").click()

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "chat",
          text: "hello",
        }),
      )
    })

    it("sendReaction sends reaction message", () => {
      renderRoom()
      screen.getByTestId("send-reaction").click()

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "reaction",
          emoji: "❤️",
        }),
      )
    })

    it("leaveRoom sends disconnect and resets state", () => {
      renderRoom()
      // First join a room
      simulateMessage({ type: "room-info", room: mockRoomInfo })
      expect(screen.getByTestId("connected").textContent).toBe("yes")

      screen.getByTestId("leave-room").click()

      expect(mockSend).toHaveBeenCalledWith(expect.objectContaining({ type: "disconnect" }))
      expect(screen.getByTestId("connected").textContent).toBe("no")
      expect(screen.getByTestId("room-code").textContent).toBe("none")
    })
  })

  describe("useRoom outside provider", () => {
    it("throws when used outside RoomProvider", () => {
      function BadConsumer() {
        useRoom()
        return <div />
      }

      expect(() => render(() => <BadConsumer />)).toThrow("useRoom must be used within RoomProvider")
    })
  })
})
