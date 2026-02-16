import { createSignal } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { useAuth } from "../stores/auth";
import FloatingHearts from "../components/layout/FloatingHearts";
import Card from "../components/layout/Card";

export default function AuthPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = createSignal("");
  const [password, setPassword] = createSignal("");
  const [error, setError] = createSignal("");
  const [loading, setLoading] = createSignal(false);

  // Redirect if already logged in
  if (auth.isLoggedIn()) navigate("/", { replace: true });

  async function handleSubmit(e: Event) {
    e.preventDefault();
    if (!username().trim() || !password()) {
      setError("Enter username and password");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const result = await auth.login(username().trim(), password());
      if (result.ok) {
        navigate("/", { replace: true });
      } else {
        setError(result.error ?? "Login failed");
      }
    } catch {
      setError("Connection error");
    }
    setLoading(false);
  }

  return (
    <div class="h-screen flex items-center justify-center relative bg-auth-gradient">
      <FloatingHearts />
      <Card>
        <h1 class="text-[28px] font-bold mb-1.5 text-gradient">
          Watch <span class="text-accent" style={{ "-webkit-text-fill-color": "var(--color-accent)" }}>♥</span> Together
        </h1>
        <p class="text-muted text-sm mb-8">Sign in to your movie night</p>

        <form onSubmit={handleSubmit} class="text-left">
          <div class="mb-3">
            <label class="block text-xs font-semibold text-muted uppercase tracking-wide mb-1.5">Username</label>
            <input
              type="text"
              value={username()}
              onInput={(e) => setUsername(e.currentTarget.value)}
              placeholder="Your name"
              maxLength={20}
              autocomplete="username"
              class="w-full px-3.5 py-2.5 bg-input border border-border rounded-md text-text text-sm outline-none transition-colors focus:border-accent focus:shadow-[0_0_0_3px_var(--color-accent-glow)]"
              onKeyDown={(e) => e.key === "Enter" && (document.getElementById("pw") as HTMLInputElement)?.focus()}
            />
          </div>
          <div class="mb-3">
            <label class="block text-xs font-semibold text-muted uppercase tracking-wide mb-1.5">Password</label>
            <input
              id="pw"
              type="password"
              value={password()}
              onInput={(e) => setPassword(e.currentTarget.value)}
              placeholder="Password"
              autocomplete="current-password"
              class="w-full px-3.5 py-2.5 bg-input border border-border rounded-md text-text text-sm outline-none transition-colors focus:border-accent focus:shadow-[0_0_0_3px_var(--color-accent-glow)]"
            />
          </div>

          {error() && <p class="text-danger text-[13px] mb-3 text-left">{error()}</p>}

          <button
            type="submit"
            disabled={loading()}
            class="w-full inline-flex items-center justify-center px-5 py-2.5 bg-accent text-white rounded-md text-sm font-semibold cursor-pointer transition-all hover:bg-accent-dark hover:shadow-[0_4px_16px_var(--color-accent-glow)] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading() ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <p class="text-muted text-xs mt-4">No account? It'll be created automatically</p>
      </Card>
    </div>
  );
}
