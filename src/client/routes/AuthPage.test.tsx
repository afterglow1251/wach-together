import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent } from "@solidjs/testing-library"
import { AuthProvider } from "../stores/auth"

// Mock @solidjs/router to avoid .jsx extension issue
const mockNavigate = vi.fn()
vi.mock("@solidjs/router", () => ({
  useNavigate: () => mockNavigate,
  Router: (props: any) => props.children,
  Route: () => null,
  Navigate: () => null,
}))

// Mock api
vi.mock("../services/api", () => ({
  api: {
    auth: vi.fn(),
  },
}))

// Mock FloatingHearts (uses canvas/animation)
vi.mock("../components/layout/FloatingHearts", () => ({
  default: () => <div data-testid="hearts" />,
}))

// Mock Card
vi.mock("../components/layout/Card", () => ({
  default: (props: any) => <div data-testid="card">{props.children}</div>,
}))

import { api } from "../services/api"
import AuthPage from "./AuthPage"

function renderAuthPage() {
  return render(() => (
    <AuthProvider>
      <AuthPage />
    </AuthProvider>
  ))
}

describe("AuthPage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    mockNavigate.mockClear()
  })

  it("renders login form", () => {
    renderAuthPage()

    expect(screen.getByPlaceholderText("Your name")).toBeInTheDocument()
    expect(screen.getByPlaceholderText("Password")).toBeInTheDocument()
    expect(screen.getByText("Sign in")).toBeInTheDocument()
  })

  it("shows validation error for empty fields", async () => {
    renderAuthPage()

    screen.getByText("Sign in").click()

    await vi.waitFor(() => {
      expect(screen.getByText("Enter username and password")).toBeInTheDocument()
    })
  })

  it("shows error on failed login", async () => {
    ;(api.auth as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      error: "Wrong password",
    })

    renderAuthPage()

    const usernameInput = screen.getByPlaceholderText("Your name")
    const passwordInput = screen.getByPlaceholderText("Password")

    fireEvent.input(usernameInput, { target: { value: "testuser" } })
    fireEvent.input(passwordInput, { target: { value: "wrongpass" } })
    screen.getByText("Sign in").click()

    await vi.waitFor(() => {
      expect(screen.getByText("Wrong password")).toBeInTheDocument()
    })
  })

  it("calls auth API with form data", async () => {
    ;(api.auth as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      user: { id: 1, username: "testuser" },
    })

    renderAuthPage()

    const usernameInput = screen.getByPlaceholderText("Your name")
    const passwordInput = screen.getByPlaceholderText("Password")

    fireEvent.input(usernameInput, { target: { value: "testuser" } })
    fireEvent.input(passwordInput, { target: { value: "mypass" } })
    screen.getByText("Sign in").click()

    await vi.waitFor(() => {
      expect(api.auth).toHaveBeenCalledWith({ username: "testuser", password: "mypass" })
    })
  })

  it("shows loading state during submission", async () => {
    let resolveAuth: (v: any) => void
    ;(api.auth as ReturnType<typeof vi.fn>).mockReturnValue(
      new Promise((r) => {
        resolveAuth = r
      }),
    )

    renderAuthPage()

    fireEvent.input(screen.getByPlaceholderText("Your name"), { target: { value: "test" } })
    fireEvent.input(screen.getByPlaceholderText("Password"), { target: { value: "pass" } })
    screen.getByText("Sign in").click()

    await vi.waitFor(() => {
      expect(screen.getByText("Signing in...")).toBeInTheDocument()
    })

    resolveAuth!({ ok: true, user: { id: 1, username: "test" } })
  })

  it("shows connection error on network failure", async () => {
    ;(api.auth as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Network error"))

    renderAuthPage()

    fireEvent.input(screen.getByPlaceholderText("Your name"), { target: { value: "test" } })
    fireEvent.input(screen.getByPlaceholderText("Password"), { target: { value: "pass" } })
    screen.getByText("Sign in").click()

    await vi.waitFor(() => {
      expect(screen.getByText("Connection error")).toBeInTheDocument()
    })
  })

  it("displays auto-registration note", () => {
    renderAuthPage()
    expect(screen.getByText("No account? It'll be created automatically")).toBeInTheDocument()
  })
})
