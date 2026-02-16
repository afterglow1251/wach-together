import { Router, Route, Navigate } from "@solidjs/router";
import { QueryClient, QueryClientProvider } from "@tanstack/solid-query";
import { Show } from "solid-js";
import { Toaster } from "solid-toast";
import { AuthProvider, useAuth } from "./stores/auth";
import { RoomProvider } from "./stores/room";
import AuthPage from "./routes/AuthPage";
import HomePage from "./routes/HomePage";
import LibraryPage from "./routes/LibraryPage";
import RoomPage from "./routes/RoomPage";
import AppLayout from "./components/layout/AppLayout";

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000 } },
});

function AuthGuard(props: { children: any }) {
  const auth = useAuth();
  return (
    <Show when={auth.isLoggedIn()} fallback={<Navigate href="/auth" />}>
      <RoomProvider username={() => auth.user()?.username ?? "Guest"}>
        {props.children}
      </RoomProvider>
    </Show>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router>
          <Route path="/auth" component={AuthPage} />
          <Route path="/" component={() => (
            <AuthGuard><AppLayout><HomePage /></AppLayout></AuthGuard>
          )} />
          <Route path="/library" component={() => (
            <AuthGuard><AppLayout><LibraryPage /></AppLayout></AuthGuard>
          )} />
          <Route path="/room/:code" component={() => (
            <AuthGuard><RoomPage /></AuthGuard>
          )} />
          <Route path="*" component={() => <Navigate href="/" />} />
        </Router>
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: "linear-gradient(135deg, #1a1020, #2a1028)",
              color: "#f0c0d8",
              border: "1px solid rgba(232, 67, 147, 0.3)",
              "border-radius": "12px",
              "font-size": "13px",
            },
            duration: 4000,
          }}
        />
      </AuthProvider>
    </QueryClientProvider>
  );
}
