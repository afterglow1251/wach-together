import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@solidjs/testing-library"
import { QueryClient, QueryClientProvider } from "@tanstack/solid-query"
import { createSignal } from "solid-js"
import { useWatchedEpisodes, useToggleWatched } from "./watched"

vi.mock("../services/api", () => ({
  api: {
    getWatched: vi.fn(),
    markWatched: vi.fn(),
    unmarkWatched: vi.fn(),
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

function TestWatchedConsumer(props: { userId: number; sourceUrl: string }) {
  const query = useWatchedEpisodes(
    () => props.userId,
    () => props.sourceUrl,
  )
  return (
    <div>
      <span data-testid="loading">{query.isLoading ? "yes" : "no"}</span>
      <span data-testid="count">{query.data?.size ?? 0}</span>
      <span data-testid="has-0-0">{query.data?.has("0-0") ? "yes" : "no"}</span>
    </div>
  )
}

function TestToggleConsumer() {
  const toggleMut = useToggleWatched()
  const [status, setStatus] = createSignal("idle")
  return (
    <div>
      <span data-testid="status">{status()}</span>
      <button
        data-testid="mark"
        onClick={async () => {
          try {
            await toggleMut.mutateAsync({ userId: 1, sourceUrl: "s", episodeId: "0-0", watched: false })
            setStatus("marked")
          } catch {
            setStatus("error")
          }
        }}
      >
        Mark
      </button>
      <button
        data-testid="unmark"
        onClick={async () => {
          try {
            await toggleMut.mutateAsync({ userId: 1, sourceUrl: "s", episodeId: "0-0", watched: true })
            setStatus("unmarked")
          } catch {
            setStatus("error")
          }
        }}
      >
        Unmark
      </button>
    </div>
  )
}

describe("useWatchedEpisodes", () => {
  let queryClient: QueryClient

  beforeEach(() => {
    vi.clearAllMocks()
    queryClient = createTestQueryClient()
  })

  it("fetches watched episodes as a Set", async () => {
    ;(api.getWatched as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      episodeIds: ["0-0", "0-1"],
    })

    render(() => (
      <QueryClientProvider client={queryClient}>
        <TestWatchedConsumer userId={1} sourceUrl="https://uakino.best/test" />
      </QueryClientProvider>
    ))

    await vi.waitFor(() => {
      expect(screen.getByTestId("count").textContent).toBe("2")
    })

    expect(screen.getByTestId("has-0-0").textContent).toBe("yes")
  })

  it("returns empty Set on error", async () => {
    ;(api.getWatched as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false })

    render(() => (
      <QueryClientProvider client={queryClient}>
        <TestWatchedConsumer userId={1} sourceUrl="https://uakino.best/test" />
      </QueryClientProvider>
    ))

    await vi.waitFor(() => {
      expect(screen.getByTestId("loading").textContent).toBe("no")
    })

    expect(screen.getByTestId("count").textContent).toBe("0")
  })
})

describe("useToggleWatched", () => {
  let queryClient: QueryClient

  beforeEach(() => {
    vi.clearAllMocks()
    queryClient = createTestQueryClient()
  })

  it("marks episode as watched", async () => {
    ;(api.markWatched as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true })

    render(() => (
      <QueryClientProvider client={queryClient}>
        <TestToggleConsumer />
      </QueryClientProvider>
    ))

    screen.getByTestId("mark").click()

    await vi.waitFor(() => {
      expect(screen.getByTestId("status").textContent).toBe("marked")
    })

    expect(api.markWatched).toHaveBeenCalled()
  })

  it("unmarks episode", async () => {
    ;(api.unmarkWatched as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true })

    render(() => (
      <QueryClientProvider client={queryClient}>
        <TestToggleConsumer />
      </QueryClientProvider>
    ))

    screen.getByTestId("unmark").click()

    await vi.waitFor(() => {
      expect(screen.getByTestId("status").textContent).toBe("unmarked")
    })

    expect(api.unmarkWatched).toHaveBeenCalled()
  })
})
