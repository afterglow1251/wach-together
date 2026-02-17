import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@solidjs/testing-library"
import { AuthProvider, useAuth } from "./auth"

// Mock the api module
vi.mock("../services/api", () => ({
  api: {
    auth: vi.fn(),
  },
}))

import { api } from "../services/api"

function TestConsumer() {
  const auth = useAuth()
  return (
    <div>
      <span data-testid="logged-in">{auth.isLoggedIn() ? "yes" : "no"}</span>
      <span data-testid="username">{auth.user()?.username ?? "none"}</span>
      <button
        data-testid="login"
        onClick={async () => {
          const result = await auth.login("testuser", "pass")
          // store result for assertion
          ;(window as any).__loginResult = result
        }}
      >
        Login
      </button>
      <button data-testid="logout" onClick={() => auth.logout()}>
        Logout
      </button>
    </div>
  )
}

describe("AuthProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    delete (window as any).__loginResult
  })

  it("starts logged out when no stored user", () => {
    render(() => (
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    ))

    expect(screen.getByTestId("logged-in").textContent).toBe("no")
    expect(screen.getByTestId("username").textContent).toBe("none")
  })

  it("restores user from localStorage", () => {
    localStorage.setItem("wt_user", JSON.stringify({ id: 1, username: "saved" }))

    render(() => (
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    ))

    expect(screen.getByTestId("logged-in").textContent).toBe("yes")
    expect(screen.getByTestId("username").textContent).toBe("saved")
  })

  it("logs in successfully", async () => {
    ;(api.auth as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      user: { id: 1, username: "testuser" },
    })

    render(() => (
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    ))

    screen.getByTestId("login").click()

    // Wait for async login
    await vi.waitFor(() => {
      expect(screen.getByTestId("logged-in").textContent).toBe("yes")
    })

    expect(screen.getByTestId("username").textContent).toBe("testuser")
    expect(localStorage.getItem("wt_user")).toContain("testuser")
  })

  it("handles login failure", async () => {
    ;(api.auth as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      error: "Wrong password",
    })

    render(() => (
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    ))

    screen.getByTestId("login").click()

    await vi.waitFor(() => {
      expect((window as any).__loginResult).toBeDefined()
    })

    expect((window as any).__loginResult.ok).toBe(false)
    expect((window as any).__loginResult.error).toBe("Wrong password")
    expect(screen.getByTestId("logged-in").textContent).toBe("no")
  })

  it("logs out and clears localStorage", async () => {
    localStorage.setItem("wt_user", JSON.stringify({ id: 1, username: "saved" }))

    render(() => (
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    ))

    expect(screen.getByTestId("logged-in").textContent).toBe("yes")

    screen.getByTestId("logout").click()

    await vi.waitFor(() => {
      expect(screen.getByTestId("logged-in").textContent).toBe("no")
    })

    expect(localStorage.getItem("wt_user")).toBeNull()
  })

  it("throws when useAuth is used outside AuthProvider", () => {
    function BadConsumer() {
      useAuth()
      return <div />
    }

    expect(() => render(() => <BadConsumer />)).toThrow("useAuth must be used within AuthProvider")
  })
})
