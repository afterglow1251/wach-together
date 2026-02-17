import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@solidjs/testing-library"
import { QueryClient, QueryClientProvider } from "@tanstack/solid-query"
import { createSignal } from "solid-js"
import { useFriends, useFriendRequests, useSendFriendRequest, useAcceptFriend, useRejectFriend } from "./friends"
import { mockFriend, mockFriendRequest } from "../../../tests/fixtures/mock-data"

vi.mock("../services/api", () => ({
  api: {
    getFriends: vi.fn(),
    getFriendRequests: vi.fn(),
    getSentRequests: vi.fn(),
    sendFriendRequest: vi.fn(),
    acceptFriend: vi.fn(),
    rejectFriend: vi.fn(),
    cancelFriendRequest: vi.fn(),
    removeFriend: vi.fn(),
    getSharedWatches: vi.fn(),
  },
}))

import { api } from "../services/api"

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  })
}

function TestFriendsConsumer(props: { userId: number }) {
  const query = useFriends(() => props.userId)
  return (
    <div>
      <span data-testid="loading">{query.isLoading ? "yes" : "no"}</span>
      <span data-testid="count">{query.data?.length ?? 0}</span>
      <span data-testid="first">{query.data?.[0]?.username ?? "none"}</span>
    </div>
  )
}

function TestRequestsConsumer(props: { userId: number }) {
  const query = useFriendRequests(() => props.userId)
  return (
    <div>
      <span data-testid="req-count">{query.data?.length ?? 0}</span>
      <span data-testid="req-first">{query.data?.[0]?.senderUsername ?? "none"}</span>
    </div>
  )
}

function TestSendRequestConsumer() {
  const sendMut = useSendFriendRequest()
  const [status, setStatus] = createSignal("idle")
  return (
    <div>
      <span data-testid="status">{status()}</span>
      <button
        data-testid="send"
        onClick={async () => {
          try {
            await sendMut.mutateAsync({ userId: 1, friendUsername: "newfriend" })
            setStatus("success")
          } catch {
            setStatus("error")
          }
        }}
      >
        Send
      </button>
    </div>
  )
}

function TestAcceptConsumer() {
  const acceptMut = useAcceptFriend()
  const [status, setStatus] = createSignal("idle")
  return (
    <div>
      <span data-testid="status">{status()}</span>
      <button
        data-testid="accept"
        onClick={async () => {
          try {
            await acceptMut.mutateAsync({ friendshipId: 2 })
            setStatus("success")
          } catch {
            setStatus("error")
          }
        }}
      >
        Accept
      </button>
    </div>
  )
}

function TestRejectConsumer() {
  const rejectMut = useRejectFriend()
  const [status, setStatus] = createSignal("idle")
  return (
    <div>
      <span data-testid="status">{status()}</span>
      <button
        data-testid="reject"
        onClick={async () => {
          try {
            await rejectMut.mutateAsync({ friendshipId: 2 })
            setStatus("success")
          } catch {
            setStatus("error")
          }
        }}
      >
        Reject
      </button>
    </div>
  )
}

describe("useFriends", () => {
  let queryClient: QueryClient

  beforeEach(() => {
    vi.clearAllMocks()
    queryClient = createTestQueryClient()
  })

  it("fetches friends list", async () => {
    ;(api.getFriends as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      friends: [mockFriend],
    })

    render(() => (
      <QueryClientProvider client={queryClient}>
        <TestFriendsConsumer userId={1} />
      </QueryClientProvider>
    ))

    await vi.waitFor(() => {
      expect(screen.getByTestId("count").textContent).toBe("1")
    })

    expect(screen.getByTestId("first").textContent).toBe("friend1")
  })
})

describe("useFriendRequests", () => {
  let queryClient: QueryClient

  beforeEach(() => {
    vi.clearAllMocks()
    queryClient = createTestQueryClient()
  })

  it("fetches friend requests", async () => {
    ;(api.getFriendRequests as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      requests: [mockFriendRequest],
    })

    render(() => (
      <QueryClientProvider client={queryClient}>
        <TestRequestsConsumer userId={1} />
      </QueryClientProvider>
    ))

    await vi.waitFor(() => {
      expect(screen.getByTestId("req-count").textContent).toBe("1")
    })

    expect(screen.getByTestId("req-first").textContent).toBe("requester")
  })
})

describe("useSendFriendRequest", () => {
  let queryClient: QueryClient

  beforeEach(() => {
    vi.clearAllMocks()
    queryClient = createTestQueryClient()
  })

  it("sends friend request", async () => {
    ;(api.sendFriendRequest as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true })

    render(() => (
      <QueryClientProvider client={queryClient}>
        <TestSendRequestConsumer />
      </QueryClientProvider>
    ))

    screen.getByTestId("send").click()

    await vi.waitFor(() => {
      expect(screen.getByTestId("status").textContent).toBe("success")
    })
  })
})

describe("useAcceptFriend", () => {
  let queryClient: QueryClient

  beforeEach(() => {
    vi.clearAllMocks()
    queryClient = createTestQueryClient()
  })

  it("accepts friend request", async () => {
    ;(api.acceptFriend as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true })

    render(() => (
      <QueryClientProvider client={queryClient}>
        <TestAcceptConsumer />
      </QueryClientProvider>
    ))

    screen.getByTestId("accept").click()

    await vi.waitFor(() => {
      expect(screen.getByTestId("status").textContent).toBe("success")
    })
  })
})

describe("useRejectFriend", () => {
  let queryClient: QueryClient

  beforeEach(() => {
    vi.clearAllMocks()
    queryClient = createTestQueryClient()
  })

  it("rejects friend request", async () => {
    ;(api.rejectFriend as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true })

    render(() => (
      <QueryClientProvider client={queryClient}>
        <TestRejectConsumer />
      </QueryClientProvider>
    ))

    screen.getByTestId("reject").click()

    await vi.waitFor(() => {
      expect(screen.getByTestId("status").textContent).toBe("success")
    })
  })
})
