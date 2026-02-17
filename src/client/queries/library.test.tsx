import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@solidjs/testing-library"
import { QueryClient, QueryClientProvider } from "@tanstack/solid-query"
import { createSignal } from "solid-js"
import {
  useSharedLibrary,
  useAddToSharedLibrary,
  useUpdateSharedLibraryStatus,
  useRemoveFromSharedLibrary,
} from "./library"
import { mockSharedLibraryItem } from "../../../tests/fixtures/mock-data"

vi.mock("../services/api", () => ({
  api: {
    getSharedLibrary: vi.fn(),
    addToSharedLibrary: vi.fn(),
    updateSharedLibrary: vi.fn(),
    removeFromSharedLibrary: vi.fn(),
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

function TestSharedLibraryConsumer(props: { userId: number; friendId: number }) {
  const query = useSharedLibrary(
    () => props.userId,
    () => props.friendId,
  )
  return (
    <div>
      <span data-testid="loading">{query.isLoading ? "yes" : "no"}</span>
      <span data-testid="count">{query.data?.length ?? 0}</span>
      <span data-testid="first-title">{query.data?.[0]?.title ?? "none"}</span>
    </div>
  )
}

function TestAddConsumer() {
  const addMut = useAddToSharedLibrary()
  const [status, setStatus] = createSignal("idle")
  return (
    <div>
      <span data-testid="status">{status()}</span>
      <button
        data-testid="add"
        onClick={async () => {
          try {
            await addMut.mutateAsync({ userId: 1, friendId: 2, sourceUrl: "https://uakino.best/test" })
            setStatus("success")
          } catch {
            setStatus("error")
          }
        }}
      >
        Add
      </button>
    </div>
  )
}

function TestUpdateConsumer() {
  const updateMut = useUpdateSharedLibraryStatus()
  const [status, setStatus] = createSignal("idle")
  return (
    <div>
      <span data-testid="status">{status()}</span>
      <button
        data-testid="update"
        onClick={async () => {
          try {
            await updateMut.mutateAsync({ id: 1, status: "watched" })
            setStatus("success")
          } catch {
            setStatus("error")
          }
        }}
      >
        Update
      </button>
    </div>
  )
}

function TestRemoveConsumer() {
  const removeMut = useRemoveFromSharedLibrary()
  const [status, setStatus] = createSignal("idle")
  return (
    <div>
      <span data-testid="status">{status()}</span>
      <button
        data-testid="remove"
        onClick={async () => {
          try {
            await removeMut.mutateAsync({ id: 1 })
            setStatus("success")
          } catch {
            setStatus("error")
          }
        }}
      >
        Remove
      </button>
    </div>
  )
}

describe("useSharedLibrary", () => {
  let queryClient: QueryClient

  beforeEach(() => {
    vi.clearAllMocks()
    queryClient = createTestQueryClient()
  })

  it("fetches shared library items", async () => {
    ;(api.getSharedLibrary as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      items: [mockSharedLibraryItem],
    })

    render(() => (
      <QueryClientProvider client={queryClient}>
        <TestSharedLibraryConsumer userId={1} friendId={2} />
      </QueryClientProvider>
    ))

    await vi.waitFor(() => {
      expect(screen.getByTestId("count").textContent).toBe("1")
    })

    expect(screen.getByTestId("first-title").textContent).toBe("Test Movie")
  })

  it("returns empty array on error", async () => {
    ;(api.getSharedLibrary as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false })

    render(() => (
      <QueryClientProvider client={queryClient}>
        <TestSharedLibraryConsumer userId={1} friendId={2} />
      </QueryClientProvider>
    ))

    await vi.waitFor(() => {
      expect(screen.getByTestId("loading").textContent).toBe("no")
    })

    expect(screen.getByTestId("count").textContent).toBe("0")
  })
})

describe("useAddToSharedLibrary", () => {
  let queryClient: QueryClient

  beforeEach(() => {
    vi.clearAllMocks()
    queryClient = createTestQueryClient()
  })

  it("adds item successfully", async () => {
    ;(api.addToSharedLibrary as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, item: mockSharedLibraryItem })

    render(() => (
      <QueryClientProvider client={queryClient}>
        <TestAddConsumer />
      </QueryClientProvider>
    ))

    screen.getByTestId("add").click()

    await vi.waitFor(() => {
      expect(screen.getByTestId("status").textContent).toBe("success")
    })
  })

  it("handles add failure", async () => {
    ;(api.addToSharedLibrary as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false, error: "Failed" })

    render(() => (
      <QueryClientProvider client={queryClient}>
        <TestAddConsumer />
      </QueryClientProvider>
    ))

    screen.getByTestId("add").click()

    await vi.waitFor(() => {
      expect(screen.getByTestId("status").textContent).toBe("error")
    })
  })
})

describe("useUpdateSharedLibraryStatus", () => {
  let queryClient: QueryClient

  beforeEach(() => {
    vi.clearAllMocks()
    queryClient = createTestQueryClient()
  })

  it("updates status successfully", async () => {
    ;(api.updateSharedLibrary as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      item: { ...mockSharedLibraryItem, status: "watched" },
    })

    render(() => (
      <QueryClientProvider client={queryClient}>
        <TestUpdateConsumer />
      </QueryClientProvider>
    ))

    screen.getByTestId("update").click()

    await vi.waitFor(() => {
      expect(screen.getByTestId("status").textContent).toBe("success")
    })
  })
})

describe("useRemoveFromSharedLibrary", () => {
  let queryClient: QueryClient

  beforeEach(() => {
    vi.clearAllMocks()
    queryClient = createTestQueryClient()
  })

  it("removes item successfully", async () => {
    ;(api.removeFromSharedLibrary as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true })

    render(() => (
      <QueryClientProvider client={queryClient}>
        <TestRemoveConsumer />
      </QueryClientProvider>
    ))

    screen.getByTestId("remove").click()

    await vi.waitFor(() => {
      expect(screen.getByTestId("status").textContent).toBe("success")
    })
  })

  it("handles remove failure", async () => {
    ;(api.removeFromSharedLibrary as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false, error: "Not found" })

    render(() => (
      <QueryClientProvider client={queryClient}>
        <TestRemoveConsumer />
      </QueryClientProvider>
    ))

    screen.getByTestId("remove").click()

    await vi.waitFor(() => {
      expect(screen.getByTestId("status").textContent).toBe("error")
    })
  })
})
