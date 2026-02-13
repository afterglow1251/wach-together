import { Elysia, t } from "elysia";
import { parseUakinoPage, extractStreamUrl } from "./scraper";
import {
  createRoom,
  getRoom,
  addClient,
  removeClient,
  broadcastToRoom,
  getRoomInfo,
  generateClientId,
} from "./rooms";
import type { Room, RoomClient, WSMessage } from "./types";
import { join } from "path";

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = join(import.meta.dir, "..", "public");

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

// Store client state outside of ws.data for reliability
const wsClients = new WeakMap<any, { clientId: string; roomCode: string | null; name: string }>();

const app = new Elysia()

  // Parse uakino URL
  .post(
    "/api/parse",
    async ({ body }) => {
      try {
        const show = await parseUakinoPage(body.url);
        return { ok: true, show };
      } catch (e: any) {
        return { ok: false, error: e.message };
      }
    },
    { body: t.Object({ url: t.String() }) }
  )

  // Extract stream URL from player page
  .post(
    "/api/stream",
    async ({ body }) => {
      try {
        const streamUrl = await extractStreamUrl(body.url);
        return { ok: true, streamUrl };
      } catch (e: any) {
        return { ok: false, error: e.message };
      }
    },
    { body: t.Object({ url: t.String() }) }
  )

  // Proxy HLS requests to avoid CORS issues
  .get("/api/proxy", async ({ query }) => {
    const url = query.url;
    if (!url) return new Response("Missing url", { status: 400 });

    try {
      const resp = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
          Referer: "https://ashdi.vip/",
          Origin: "https://ashdi.vip",
        },
      });

      if (!resp.ok) {
        return new Response(`Upstream error: ${resp.status}`, { status: resp.statusText ? 502 : 500 });
      }

      const contentType = resp.headers.get("content-type") || "application/octet-stream";
      const body = await resp.arrayBuffer();

      // For m3u8 playlists, rewrite URLs to go through proxy
      if (url.endsWith(".m3u8") || contentType.includes("mpegurl") || contentType.includes("m3u8")) {
        let text = new TextDecoder().decode(body);
        const baseUrl = url.substring(0, url.lastIndexOf("/") + 1);

        // Rewrite ALL non-comment URLs to go through proxy (both relative and absolute)
        text = text.replace(/^(?!#)(\S+)$/gm, (match) => {
          let absolute: string;
          if (match.startsWith("http://") || match.startsWith("https://")) {
            absolute = match;
          } else if (match.startsWith("/")) {
            absolute = new URL(match, new URL(url).origin).href;
          } else {
            absolute = baseUrl + match;
          }
          return `/api/proxy?url=${encodeURIComponent(absolute)}`;
        });

        return new Response(text, {
          headers: {
            "Content-Type": "application/vnd.apple.mpegurl",
            "Access-Control-Allow-Origin": "*",
          },
        });
      }

      return new Response(body, {
        headers: {
          "Content-Type": contentType,
          "Access-Control-Allow-Origin": "*",
        },
      });
    } catch (e: any) {
      return new Response(`Proxy error: ${e.message}`, { status: 500 });
    }
  })

  // WebSocket for room sync
  .ws("/ws", {
    open(ws) {
      const cid = generateClientId();
      wsClients.set(ws, { clientId: cid, roomCode: null, name: "Guest" });
      ws.send(JSON.stringify({ type: "connected", clientId: cid }));
      console.log(`[WS] Client connected: ${cid}`);
    },

    message(ws, rawMsg) {
      const state = wsClients.get(ws);
      if (!state) return;

      let msg: WSMessage;
      try {
        msg = typeof rawMsg === "string" ? JSON.parse(rawMsg) : rawMsg;
      } catch {
        return;
      }

      console.log(`[WS] ${state.clientId} -> ${msg.type}`, msg.type === "join" ? `room=${(msg as any).roomCode}` : "");

      switch (msg.type) {
        case "join": {
          const name = msg.name || "Guest";
          state.name = name;

          let room: Room | undefined;

          if (msg.roomCode && msg.roomCode.trim() !== "") {
            room = getRoom(msg.roomCode.trim());
            if (!room) {
              ws.send(JSON.stringify({ type: "error", message: `Кімнату ${msg.roomCode} не знайдено` }));
              return;
            }
          } else {
            room = createRoom(state.clientId);
          }

          state.roomCode = room.code;

          const isHost = room.hostId === state.clientId || room.clients.size === 0;
          if (isHost && room.clients.size === 0) {
            room.hostId = state.clientId;
          }

          const client: RoomClient = {
            id: state.clientId,
            ws,
            isHost: room.hostId === state.clientId,
            name,
          };

          addClient(room, client);

          const roomInfo = getRoomInfo(room, state.clientId);
          console.log(`[WS] ${state.clientId} joined room ${room.code}, isHost=${roomInfo.isHost}, clients=${room.clients.size}, hasStream=${!!roomInfo.streamUrl}`);
          ws.send(JSON.stringify({ type: "room-info", room: roomInfo }));

          broadcastToRoom(
            room,
            { type: "user-joined", name, count: room.clients.size },
            state.clientId
          );
          break;
        }

        case "set-show": {
          const room = getRoom(state.roomCode!);
          if (!room || room.hostId !== state.clientId) return;

          room.show = msg.show;
          room.currentEpisode = null;
          room.streamUrl = null;
          room.currentTime = 0;
          room.isPlaying = false;

          broadcastToRoom(room, { type: "show-loaded", show: msg.show });
          break;
        }

        case "select-episode": {
          const room = getRoom(state.roomCode!);
          if (!room || room.hostId !== state.clientId) return;

          room.currentEpisode = msg.episode;
          room.currentTime = 0;
          room.isPlaying = false;
          break;
        }

        case "stream-ready": {
          const room = getRoom(state.roomCode!);
          if (!room || room.hostId !== state.clientId) return;

          room.streamUrl = msg.streamUrl;
          console.log(`[WS] Stream ready in room ${room.code}: ${msg.streamUrl.substring(0, 60)}...`);
          broadcastToRoom(room, {
            type: "episode-changed",
            episode: room.currentEpisode!,
            streamUrl: msg.streamUrl,
          });
          break;
        }

        case "play": {
          const room = getRoom(state.roomCode!);
          if (!room || room.hostId !== state.clientId) return;

          room.isPlaying = true;
          room.lastSyncAt = Date.now();
          broadcastToRoom(room, { type: "play", time: room.currentTime }, state.clientId);
          break;
        }

        case "pause": {
          const room = getRoom(state.roomCode!);
          if (!room || room.hostId !== state.clientId) return;

          room.isPlaying = false;
          broadcastToRoom(room, { type: "pause", time: room.currentTime }, state.clientId);
          break;
        }

        case "seek": {
          const room = getRoom(state.roomCode!);
          if (!room || room.hostId !== state.clientId) return;

          room.currentTime = msg.time;
          room.lastSyncAt = Date.now();
          broadcastToRoom(room, { type: "seek", time: msg.time }, state.clientId);
          break;
        }

        case "sync": {
          const room = getRoom(state.roomCode!);
          if (!room || room.hostId !== state.clientId) return;

          room.currentTime = msg.time;
          room.isPlaying = msg.isPlaying;
          room.lastSyncAt = Date.now();
          broadcastToRoom(
            room,
            { type: "sync", time: msg.time, isPlaying: msg.isPlaying },
            state.clientId
          );
          break;
        }

        case "sync-request": {
          const room = getRoom(state.roomCode!);
          if (!room) return;

          ws.send(
            JSON.stringify({
              type: "sync",
              time: room.currentTime,
              isPlaying: room.isPlaying,
            })
          );
          break;
        }

        case "chat": {
          const room = getRoom(state.roomCode!);
          if (!room) return;

          broadcastToRoom(room, { type: "chat", name: state.name, text: msg.text });
          break;
        }
      }
    },

    close(ws) {
      const state = wsClients.get(ws);
      if (!state || !state.roomCode) {
        wsClients.delete(ws);
        return;
      }

      const room = getRoom(state.roomCode);
      if (room) {
        removeClient(room, state.clientId);
        broadcastToRoom(room, {
          type: "user-left",
          name: state.name,
          count: room.clients.size,
        });
        console.log(`[WS] ${state.clientId} left room ${state.roomCode}, clients=${room.clients.size}`);
      }
      wsClients.delete(ws);
    },
  })

  // Static file serving
  .get("/*", async ({ params }) => {
    const filePath = params["*"] || "index.html";
    const fullPath = join(PUBLIC_DIR, filePath);

    const file = Bun.file(fullPath);
    if (await file.exists()) {
      const ext = "." + filePath.split(".").pop();
      return new Response(file, {
        headers: { "Content-Type": MIME_TYPES[ext] || "application/octet-stream" },
      });
    }

    // SPA fallback
    const indexFile = Bun.file(join(PUBLIC_DIR, "index.html"));
    return new Response(indexFile, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  })

  .listen(PORT);

console.log(`🎬 Watch Together running at http://localhost:${PORT}`);
