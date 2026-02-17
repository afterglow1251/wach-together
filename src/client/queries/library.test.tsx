import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@solidjs/testing-library"
import { QueryClient, QueryClientProvider } from "@tanstack/solid-query"
import { createSignal } from "solid-js"
import { useLibrary, useAddToLibrary, useUpdateLibraryStatus, useRemoveFromLibrary } from "./library"
import { mockLibraryItem } from "../../../tests/fixtures/mock-data"

vi.mock("../services/api", () => ({
  api: {
    getLibrary: vi.fn(),
    addToLibrary: vi.fn(),
    updateLibrary: vi.fn(),
    removeFromLibrary: vi.fn(),
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

function TestLibraryConsumer(props: { userId: number }) {
  const query = useLibrary(() => props.userId)
  return (
    <div>
      <span data-testid="loading">{query.isLoading ? "yes" : "no"}</span>
      <span data-testid="count">{query.data?.length ?? 0}</span>
      <span data-testid="first-title">{query.data?.[0]?.title ?? "none"}</span>
    </div>
  )
}

function TestAddConsumer() {
  const addMut = useAddToLibrary()
  const [status, setStatus] = createSignal("idle")
  return (
    <div>
      <span data-testid="status">{status()}</span>
      <button
        data-testid="add"
        onClick={async () => {
          try {
            await addMut.mutateAsync({ userId: 1, sourceUrl: "https://uakino.best/test" })
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
  const updateMut = useUpdateLibraryStatus()
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
  const removeMut = useRemoveFromLibrary()
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

describe("useLibrary", () => {
  let queryClient: QueryClient

  beforeEach(() => {
    vi.clearAllMocks()
    queryClient = createTestQueryClient()
  })

  it("fetches library items", async () => {
    ;(api.getLibrary as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      items: [mockLibraryItem],
    })

    render(() => (
      <QueryClientProvider client={queryClient}>
        <TestLibraryConsumer userId={1} />
      </QueryClientProvider>
    ))

    await vi.waitFor(() => {
      expect(screen.getByTestId("count").textContent).toBe("1")
    })

    expect(screen.getByTestId("first-title").textContent).toBe("Test Movie")
  })

  it("returns empty array on error", async () => {
    ;(api.getLibrary as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false })

    render(() => (
      <QueryClientProvider client={queryClient}>
        <TestLibraryConsumer userId={1} />
      </QueryClientProvider>
    ))

    await vi.waitFor(() => {
      expect(screen.getByTestId("loading").textContent).toBe("no")
    })

    expect(screen.getByTestId("count").textContent).toBe("0")
  })
})

describe("useAddToLibrary", () => {
  let queryClient: QueryClient

  beforeEach(() => {
    vi.clearAllMocks()
    queryClient = createTestQueryClient()
  })

  it("adds item successfully", async () => {
    ;(api.addToLibrary as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, item: mockLibraryItem })

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
    ;(api.addToLibrary as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false, error: "Failed" })

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

describe("useUpdateLibraryStatus", () => {
  let queryClient: QueryClient

  beforeEach(() => {
    vi.clearAllMocks()
    queryClient = createTestQueryClient()
  })

  it("updates status successfully", async () => {
    ;(api.updateLibrary as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      item: { ...mockLibraryItem, status: "watched" },
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

describe("useRemoveFromLibrary", () => {
  let queryClient: QueryClient

  beforeEach(() => {
    vi.clearAllMocks()
    queryClient = createTestQueryClient()
  })

  it("removes item successfully", async () => {
    ;(api.removeFromLibrary as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true })

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
    ;(api.removeFromLibrary as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false, error: "Not found" })

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
