import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent } from "@solidjs/testing-library"
import { ConfirmProvider, useConfirm } from "./ConfirmDialog"
import { createSignal } from "solid-js"

function TestConsumer() {
  const confirm = useConfirm()
  const [result, setResult] = createSignal<string>("none")

  return (
    <div>
      <span data-testid="result">{result()}</span>
      <button
        data-testid="open"
        onClick={async () => {
          const ok = await confirm({
            title: "Delete item?",
            message: "This action cannot be undone.",
            confirmText: "Delete",
            cancelText: "Keep",
            danger: true,
          })
          setResult(ok ? "confirmed" : "cancelled")
        }}
      >
        Open
      </button>
      <button
        data-testid="open-default"
        onClick={async () => {
          const ok = await confirm({
            title: "Are you sure?",
            message: "Please confirm.",
          })
          setResult(ok ? "confirmed" : "cancelled")
        }}
      >
        OpenDefault
      </button>
    </div>
  )
}

describe("ConfirmDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("starts with no dialog visible", () => {
    render(() => (
      <ConfirmProvider>
        <TestConsumer />
      </ConfirmProvider>
    ))

    expect(screen.queryByText("Delete item?")).toBeNull()
  })

  it("shows dialog when confirm is called", async () => {
    render(() => (
      <ConfirmProvider>
        <TestConsumer />
      </ConfirmProvider>
    ))

    screen.getByTestId("open").click()

    await vi.waitFor(() => {
      expect(screen.getByText("Delete item?")).toBeInTheDocument()
    })

    expect(screen.getByText("This action cannot be undone.")).toBeInTheDocument()
    expect(screen.getByText("Delete")).toBeInTheDocument()
    expect(screen.getByText("Keep")).toBeInTheDocument()
  })

  it("resolves true on confirm click", async () => {
    render(() => (
      <ConfirmProvider>
        <TestConsumer />
      </ConfirmProvider>
    ))

    screen.getByTestId("open").click()

    await vi.waitFor(() => {
      expect(screen.getByText("Delete")).toBeInTheDocument()
    })

    screen.getByText("Delete").click()

    await vi.waitFor(() => {
      expect(screen.getByTestId("result").textContent).toBe("confirmed")
    })

    // Dialog should be closed
    expect(screen.queryByText("Delete item?")).toBeNull()
  })

  it("resolves false on cancel click", async () => {
    render(() => (
      <ConfirmProvider>
        <TestConsumer />
      </ConfirmProvider>
    ))

    screen.getByTestId("open").click()

    await vi.waitFor(() => {
      expect(screen.getByText("Keep")).toBeInTheDocument()
    })

    screen.getByText("Keep").click()

    await vi.waitFor(() => {
      expect(screen.getByTestId("result").textContent).toBe("cancelled")
    })
  })

  it("uses default button text when not specified", async () => {
    render(() => (
      <ConfirmProvider>
        <TestConsumer />
      </ConfirmProvider>
    ))

    screen.getByTestId("open-default").click()

    await vi.waitFor(() => {
      expect(screen.getByText("Confirm")).toBeInTheDocument()
      expect(screen.getByText("Cancel")).toBeInTheDocument()
    })
  })

  it("throws when useConfirm used outside provider", () => {
    function BadConsumer() {
      useConfirm()
      return <div />
    }

    expect(() => render(() => <BadConsumer />)).toThrow("useConfirm must be used within ConfirmProvider")
  })
})
