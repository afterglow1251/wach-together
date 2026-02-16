import { createSignal, createEffect, Show, onMount } from "solid-js";
import { useParams, useSearchParams, useNavigate } from "@solidjs/router";
import { useQueryClient } from "@tanstack/solid-query";
import { useAuth } from "../stores/auth";
import { useRoom } from "../stores/room";
import { useWatchedEpisodes, useToggleWatched } from "../queries/watched";
import { useAddToLibrary } from "../queries/library";
import { api } from "../services/api";
import toast from "../lib/toast";
import RoomHeader from "../components/room/RoomHeader";
import UrlInput from "../components/room/UrlInput";
import ShowInfo from "../components/room/ShowInfo";
import DubSelector from "../components/room/DubSelector";
import EpisodeList from "../components/room/EpisodeList";
import Chat from "../components/room/Chat";
import VideoPlayer from "../components/room/VideoPlayer";
import SeekOverlay from "../components/room/SeekOverlay";
import ReactionBar from "../components/room/ReactionBar";
import FullscreenChat from "../components/room/FullscreenChat";
import type { Episode } from "../../shared/types";

export default function RoomPage() {
  const params = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const auth = useAuth();
  const room = useRoom();
  const [dubIndex, setDubIndex] = createSignal(0);
  const [autoMarkedId, setAutoMarkedId] = createSignal<string | null>(null);

  const qc = useQueryClient();
  const userId = () => auth.user()?.id;
  const sourceUrl = () => room.state.sourceUrl ?? undefined;
  const watched = useWatchedEpisodes(userId, sourceUrl);
  const toggleWatched = useToggleWatched();
  const addToLib = useAddToLibrary();

  // Join room on mount
  onMount(() => {
    if (!room.state.connected && params.code) {
      room.joinRoom(params.code, auth.user()!.username);
    }
  });

  // Handle room-info redirect (room code might differ from URL param)
  createEffect(() => {
    if (room.state.roomCode && room.state.roomCode !== params.code) {
      navigate(`/room/${room.state.roomCode}`, { replace: true });
    }
  });

  // Auto-load show from library URL param
  createEffect(() => {
    const loadUrl = searchParams.load;
    if (typeof loadUrl === "string" && loadUrl && room.state.isHost && room.state.connected && !room.state.show) {
      handleLoadUrl(loadUrl);
    }
  });

  async function handleLoadUrl(url: string) {
    try {
      const resp = await api.parse({ url });
      if (resp.ok && resp.show) {
        room.setShow(resp.show, url);
        const count = resp.show.dubs.reduce((a, d) => a + d.episodes.length, 0);
        toast(`Found ${count} episodes`);
        // Add to library if not already there (keeps existing status)
        if (userId()) {
          addToLib.mutate({ userId: userId()!, sourceUrl: url });
        }
      } else {
        toast.error(resp.error ?? "Failed to load");
      }
    } catch {
      toast.error("Connection error");
    }
  }

  async function handleEpisodeSelect(ep: Episode) {
    room.selectEpisode(ep);
    setAutoMarkedId(null);
    try {
      const resp = await api.stream({ url: ep.url });
      if (resp.ok && resp.streamUrl) {
        room.streamReady(resp.streamUrl);
      } else {
        toast.error(resp.error ?? "Failed to get stream");
      }
    } catch {
      toast.error("Server connection error");
    }
  }

  function handleToggleWatched(episodeId: string) {
    if (!userId() || !sourceUrl()) return;
    const isWatched = watched.data?.has(episodeId) ?? false;
    toggleWatched.mutate({
      userId: userId()!,
      sourceUrl: sourceUrl()!,
      episodeId,
      watched: isWatched,
    });
  }

  function handleTimeUpdate(time: number, duration: number) {
    if (!room.state.currentEpisode || !duration) return;
    const progress = time / duration;
    if (progress >= 0.9) {
      const epId = room.state.currentEpisode.id;
      if (autoMarkedId() !== epId && !(watched.data?.has(epId))) {
        setAutoMarkedId(epId);
        if (userId() && sourceUrl()) {
          api.markWatched({ userId: userId()!, sourceUrl: sourceUrl()!, episodeId: epId }).catch(() => {});
          qc.invalidateQueries({ queryKey: ["watched"] });
        }
      }
    }
  }

  const currentDub = () => room.state.show?.dubs[dubIndex()] ?? null;
  const episodes = () => currentDub()?.episodes ?? [];
  const watchedIds = () => watched.data ?? new Set<string>();

  // Sidebar hearts
  const sidebarHearts = [
    { left: "10%", dur: 14, delay: 0 },
    { left: "30%", dur: 18, delay: 4 },
    { left: "55%", dur: 12, delay: 8 },
    { left: "75%", dur: 16, delay: 2 },
    { left: "90%", dur: 20, delay: 6 },
  ];

  return (
    <div class="flex h-screen w-screen max-md:flex-col">
      {/* Sidebar */}
      <aside class="w-80 min-w-80 bg-sidebar-gradient border-r border-border flex flex-col overflow-y-auto relative max-md:w-full max-md:min-w-0 max-md:max-h-[40vh] max-md:border-r-0 max-md:border-b max-md:border-border max-md:order-2">
        {/* Sidebar floating hearts */}
        <div class="absolute inset-0 overflow-hidden pointer-events-none z-0">
          {sidebarHearts.map((h) => (
            <span
              class="absolute bottom-[-20px] text-[10px] text-accent opacity-0"
              style={{
                left: h.left,
                animation: `sidebar-heart-float ${h.dur}s linear infinite`,
                "animation-delay": `${h.delay}s`,
              }}
            >♥</span>
          ))}
        </div>

        <RoomHeader code={room.state.roomCode ?? "-----"} clientCount={room.state.clientCount} isHost={room.state.isHost} />

        <Show when={room.state.isHost}>
          <UrlInput initialUrl={room.state.sourceUrl ?? ""} onLoad={handleLoadUrl} />
        </Show>

        <ShowInfo title={room.state.show?.title} />

        <Show when={room.state.show}>
          <DubSelector
            dubs={room.state.show!.dubs}
            value={dubIndex()}
            onChange={setDubIndex}
          />
        </Show>

        <Show when={episodes().length > 0}>
          <EpisodeList
            episodes={episodes()}
            currentId={room.state.currentEpisode?.id}
            watchedIds={watchedIds()}
            isHost={room.state.isHost}
            onSelect={handleEpisodeSelect}
            onToggleWatched={handleToggleWatched}
          />
        </Show>

        <Chat
          messages={room.state.chat}
          typingUser={room.state.typingUser}
          onSend={(text) => room.sendChat(text)}
          onTyping={() => room.sendTyping()}
        />
      </aside>

      {/* Main content */}
      <main class="flex-1 flex flex-col min-w-0 bg-black max-md:order-1 max-md:min-h-[40vh]">
        <VideoPlayer
          streamUrl={room.state.streamUrl}
          isHost={room.state.isHost}
          isPlaying={room.state.isPlaying}
          currentTime={room.state.currentTime}
          onPlay={(t) => room.sendPlay(t)}
          onPause={(t) => room.sendPause(t)}
          onSeek={(t) => room.sendSeek(t)}
          onSync={(t, p) => room.sendSync(t, p)}
          onTimeUpdate={handleTimeUpdate}
        >
          <SeekOverlay />
          <ReactionBar onReaction={(e) => room.sendReaction(e)} lastReaction={room.state.lastReaction} />
          <FullscreenChat
            messages={room.state.chat}
            onSend={(text) => room.sendChat(text)}
            onTyping={() => room.sendTyping()}
          />

          {/* Player overlay — shown when no video */}
          <Show when={!room.state.streamUrl}>
            <div class="absolute inset-0 z-30 flex items-center justify-center pointer-events-none" style={{ background: "radial-gradient(ellipse at 50% 50%, rgba(232, 67, 147, 0.06) 0%, rgba(0, 0, 0, 0.8) 70%)" }}>
              <div class="text-center">
                <span class="block text-5xl text-accent mb-3" style={{ animation: "heart-pulse 2s ease-in-out infinite" }}>♥</span>
                <p class="text-muted text-[15px] tracking-wide">Pick something to watch together</p>
              </div>
            </div>
          </Show>
        </VideoPlayer>
      </main>
    </div>
  );
}
