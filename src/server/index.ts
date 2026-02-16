import { Elysia, t } from "elysia";
import { parseUakinoPage, extractStreamUrl } from "./scraper";
import {
  createRoom,
  getRoom,
  addClient,
  removeClient,
  broadcastToRoom,
  getRoomInfo,
} from "./rooms";
import type { Room, RoomClient } from "./types";
import { join } from "path";
import { db } from "./db";
import { users, watchedEpisodes, library } from "./db/schema";
import { eq, and, sql } from "drizzle-orm";
import type { LibraryStatus } from "../shared/types";

const PORT = process.env.PORT || 3000;
const CLIENT_DIR = join(import.meta.dir, "..", "..", "dist", "client");

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

// Store client state by clientId
const wsState = new Map<string, { clientId: string; roomCode: string | null; name: string }>();

// Map WebSocket connections to clientId for close handler cleanup
const wsToClientId = new Map<any, string>();

// Pending disconnect timers for grace period (host reload)
const pendingDisconnects = new Map<string, Timer>();

function cleanupClient(cid: string) {
  const state = wsState.get(cid);
  if (!state) return;

  if (state.roomCode) {
    const room = getRoom(state.roomCode);
    if (room) {
      removeClient(room, cid);
      if (room.clients.size > 0) {
        broadcastToRoom(room, {
          type: "user-left",
          name: state.name,
          count: room.clients.size,
        });
      }
    }
  }
  wsState.delete(cid);
}

new Elysia()

  // Parse uakino URL
  .post(
    "/api/parse",
    async ({ body }) => {
      try {
        const show = await Promise.race([
          parseUakinoPage(body.url),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("Timed out loading page (30s)")), 30000)
          ),
        ]);
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
        const streamUrl = await Promise.race([
          extractStreamUrl(body.url),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("Timed out extracting stream (30s)")), 30000)
          ),
        ]);
        return { ok: true, streamUrl };
      } catch (e: any) {
        return { ok: false, error: e.message };
      }
    },
    { body: t.Object({ url: t.String() }) }
  )

  // Auth — auto register/login
  .post(
    "/api/auth",
    async ({ body }) => {
      try {
        const { username, password } = body;
        const existing = await db
          .select()
          .from(users)
          .where(eq(users.username, username))
          .limit(1);

        if (existing.length > 0) {
          const valid = await Bun.password.verify(password, existing[0].passwordHash);
          if (!valid) return { ok: false, error: "Wrong password" };
          return { ok: true, user: { id: existing[0].id, username: existing[0].username } };
        }

        const hash = await Bun.password.hash(password);
        const [newUser] = await db
          .insert(users)
          .values({ username, passwordHash: hash })
          .returning({ id: users.id, username: users.username });
        return { ok: true, user: newUser, created: true };
      } catch (e: any) {
        console.error("[Auth] Error:", e);
        return { ok: false, error: "Something went wrong, try again" };
      }
    },
    { body: t.Object({ username: t.String(), password: t.String() }) }
  )

  // Get watched episodes
  .get("/api/watched", async ({ query }) => {
    const userId = parseInt(query.userId as string);
    const sourceUrl = query.sourceUrl as string;
    if (!userId || !sourceUrl) return { ok: false, error: "Missing params" };

    const rows = await db
      .select({ episodeId: watchedEpisodes.episodeId })
      .from(watchedEpisodes)
      .where(and(eq(watchedEpisodes.userId, userId), eq(watchedEpisodes.sourceUrl, sourceUrl)));

    return { ok: true, episodeIds: rows.map((r) => r.episodeId) };
  })

  // Mark episode as watched
  .post(
    "/api/watched",
    async ({ body }) => {
      try {
        await db
          .insert(watchedEpisodes)
          .values({ userId: body.userId, sourceUrl: body.sourceUrl, episodeId: body.episodeId })
          .onConflictDoNothing();
        return { ok: true };
      } catch (e: any) {
        return { ok: false, error: e.message };
      }
    },
    {
      body: t.Object({
        userId: t.Number(),
        sourceUrl: t.String(),
        episodeId: t.String(),
      }),
    }
  )

  // Unmark episode
  .delete(
    "/api/watched",
    async ({ body }) => {
      try {
        await db
          .delete(watchedEpisodes)
          .where(
            and(
              eq(watchedEpisodes.userId, body.userId),
              eq(watchedEpisodes.sourceUrl, body.sourceUrl),
              eq(watchedEpisodes.episodeId, body.episodeId)
            )
          );
        return { ok: true };
      } catch (e: any) {
        return { ok: false, error: e.message };
      }
    },
    {
      body: t.Object({
        userId: t.Number(),
        sourceUrl: t.String(),
        episodeId: t.String(),
      }),
    }
  )

  // Get user's library
  .get("/api/library", async ({ query }) => {
    const userId = parseInt(query.userId as string);
    if (!userId) return { ok: false, error: "Missing userId" };

    const items = await db
      .select()
      .from(library)
      .where(eq(library.userId, userId))
      .orderBy(library.addedAt);

    const watchedCounts = await db
      .select({
        sourceUrl: watchedEpisodes.sourceUrl,
        count: sql<number>`count(*)::int`,
      })
      .from(watchedEpisodes)
      .where(eq(watchedEpisodes.userId, userId))
      .groupBy(watchedEpisodes.sourceUrl);

    const countMap = new Map(watchedCounts.map((r) => [r.sourceUrl, r.count]));

    return {
      ok: true,
      items: items.map((item) => ({
        ...item,
        watchedCount: countMap.get(item.sourceUrl) || 0,
      })),
    };
  })

  // Add show to library
  .post(
    "/api/library",
    async ({ body }) => {
      try {
        const { userId, sourceUrl, status } = body;

        const show = await Promise.race([
          parseUakinoPage(sourceUrl),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("Timed out loading page (30s)")), 30000)
          ),
        ]);

        const totalEpisodes = Math.max(...show.dubs.map((d) => d.episodes.length), 0);

        const [item] = await db
          .insert(library)
          .values({
            userId,
            sourceUrl,
            title: show.title,
            poster: show.poster,
            totalEpisodes,
            status: (status || "plan_to_watch") as LibraryStatus,
          })
          .onConflictDoUpdate({
            target: [library.userId, library.sourceUrl],
            set: {
              title: show.title,
              poster: show.poster,
              totalEpisodes,
              ...(status ? { status: status as LibraryStatus } : {}),
            },
          })
          .returning();

        return { ok: true, item };
      } catch (e: any) {
        return { ok: false, error: e.message };
      }
    },
    {
      body: t.Object({
        userId: t.Number(),
        sourceUrl: t.String(),
        status: t.Optional(t.String()),
      }),
    }
  )

  // Update library item status
  .patch(
    "/api/library",
    async ({ body }) => {
      try {
        const [updated] = await db
          .update(library)
          .set({ status: body.status as typeof library.$inferInsert.status })
          .where(eq(library.id, body.id))
          .returning();

        return { ok: true, item: updated };
      } catch (e: any) {
        return { ok: false, error: e.message };
      }
    },
    {
      body: t.Object({
        id: t.Number(),
        status: t.String(),
      }),
    }
  )

  // Remove from library
  .delete(
    "/api/library",
    async ({ body }) => {
      try {
        await db.delete(library).where(eq(library.id, body.id));
        return { ok: true };
      } catch (e: any) {
        return { ok: false, error: e.message };
      }
    },
    {
      body: t.Object({ id: t.Number() }),
    }
  )

  // Poster proxy
  .get("/api/poster-proxy", async ({ query }) => {
    const url = query.url as string;
    if (!url) return new Response("Missing url", { status: 400 });

    try {
      const fullUrl = url.startsWith("http") ? url : `https://uakino.best${url}`;
      const resp = await fetch(fullUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
          Referer: "https://uakino.best/",
        },
      });

      if (!resp.ok) return new Response("Upstream error", { status: 502 });

      const contentType = resp.headers.get("content-type") || "image/jpeg";
      const body = await resp.arrayBuffer();

      return new Response(body, {
        headers: {
          "Content-Type": contentType,
          "Cache-Control": "public, max-age=604800",
          "Access-Control-Allow-Origin": "*",
        },
      });
    } catch (e: any) {
      return new Response(`Proxy error: ${e.message}`, { status: 500 });
    }
  })

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

      if (url.endsWith(".m3u8") || contentType.includes("mpegurl") || contentType.includes("m3u8")) {
        let text = new TextDecoder().decode(body);
        const baseUrl = url.substring(0, url.lastIndexOf("/") + 1);

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
    message(ws, rawMsg) {
      let msg: any;
      try {
        msg = typeof rawMsg === "string" ? JSON.parse(rawMsg) : rawMsg;
      } catch {
        return;
      }

      const cid = msg.clientId as string;
      if (!cid) return;

      console.log(`[WS] ${cid} -> ${msg.type}`);

      switch (msg.type) {
        case "join": {
          const name = msg.name || "Guest";

          const pendingTimer = pendingDisconnects.get(cid);
          if (pendingTimer) {
            clearTimeout(pendingTimer);
            pendingDisconnects.delete(cid);
            console.log(`[WS] Cancelled pending disconnect for ${cid} (grace period reconnect)`);
          }

          for (const [oldWs, oldCid] of wsToClientId) {
            if (oldCid === cid && oldWs !== ws) {
              wsToClientId.delete(oldWs);
            }
          }

          wsToClientId.set(ws, cid);

          const existingState = wsState.get(cid);
          const targetCode = (msg.roomCode && msg.roomCode.trim() !== "") ? msg.roomCode.trim() : null;

          if (existingState?.roomCode && targetCode) {
            const existingRoom = getRoom(existingState.roomCode);
            if (existingRoom && existingRoom.code === targetCode.toUpperCase() && existingRoom.clients.has(cid)) {
              const existingClient = existingRoom.clients.get(cid)!;
              existingClient.ws = ws;
              existingClient.name = name;
              wsState.set(cid, { clientId: cid, roomCode: existingRoom.code, name });

              const roomInfo = getRoomInfo(existingRoom, cid);
              console.log(`[WS] ${cid} seamlessly reconnected to room ${existingRoom.code}, isHost=${roomInfo.isHost}, clients=${existingRoom.clients.size}`);
              ws.send(JSON.stringify({ type: "room-info", room: roomInfo }));
              break;
            }
          }

          if (existingState?.roomCode) {
            const oldRoom = getRoom(existingState.roomCode);
            if (oldRoom) {
              removeClient(oldRoom, cid);
              if (oldRoom.clients.size > 0) {
                broadcastToRoom(oldRoom, {
                  type: "user-left",
                  name: existingState.name,
                  count: oldRoom.clients.size,
                });
              }
            }
          }

          wsState.set(cid, { clientId: cid, roomCode: null, name });

          let room: Room | undefined;

          if (targetCode) {
            room = getRoom(targetCode);
            if (!room) {
              ws.send(JSON.stringify({ type: "error", message: `Room ${msg.roomCode} not found` }));
              return;
            }
          } else {
            room = createRoom(cid);
          }

          wsState.get(cid)!.roomCode = room.code;

          if (room.clients.size === 0) {
            room.hostId = cid;
          }

          const client: RoomClient = {
            id: cid,
            ws,
            isHost: room.hostId === cid,
            name,
          };

          addClient(room, client);

          const roomInfo = getRoomInfo(room, cid);
          console.log(`[WS] ${cid} joined room ${room.code}, isHost=${roomInfo.isHost}, clients=${room.clients.size}, hasStream=${!!roomInfo.streamUrl}`);
          ws.send(JSON.stringify({ type: "room-info", room: roomInfo }));

          broadcastToRoom(
            room,
            { type: "user-joined", name, count: room.clients.size },
            cid
          );
          break;
        }

        case "set-show": {
          const state = wsState.get(cid);
          if (!state?.roomCode) return;
          const room = getRoom(state.roomCode);
          if (!room || room.hostId !== cid) return;

          room.show = msg.show;
          room.sourceUrl = msg.sourceUrl || null;
          room.currentEpisode = null;
          room.streamUrl = null;
          room.currentTime = 0;
          room.isPlaying = false;

          broadcastToRoom(room, { type: "show-loaded", show: msg.show, sourceUrl: room.sourceUrl });
          break;
        }

        case "select-episode": {
          const state = wsState.get(cid);
          if (!state?.roomCode) return;
          const room = getRoom(state.roomCode);
          if (!room || room.hostId !== cid) return;

          room.currentEpisode = msg.episode;
          room.currentTime = 0;
          room.isPlaying = false;
          break;
        }

        case "stream-ready": {
          const state = wsState.get(cid);
          if (!state?.roomCode) return;
          const room = getRoom(state.roomCode);
          if (!room || room.hostId !== cid) return;

          room.streamUrl = msg.streamUrl;
          console.log(`[WS] Stream ready in room ${room.code}, broadcasting to ${room.clients.size} clients`);

          broadcastToRoom(room, {
            type: "episode-changed",
            episode: room.currentEpisode,
            streamUrl: msg.streamUrl,
          }, cid);
          break;
        }

        case "play": {
          const state = wsState.get(cid);
          if (!state?.roomCode) return;
          const room = getRoom(state.roomCode);
          if (!room || room.hostId !== cid) return;

          const time = msg.time ?? room.currentTime;
          room.isPlaying = true;
          room.currentTime = time;
          room.lastSyncAt = Date.now();
          broadcastToRoom(room, { type: "play", time }, cid);
          break;
        }

        case "pause": {
          const state = wsState.get(cid);
          if (!state?.roomCode) return;
          const room = getRoom(state.roomCode);
          if (!room || room.hostId !== cid) return;

          const time = msg.time ?? room.currentTime;
          room.isPlaying = false;
          room.currentTime = time;
          broadcastToRoom(room, { type: "pause", time }, cid);
          break;
        }

        case "seek": {
          const state = wsState.get(cid);
          if (!state?.roomCode) return;
          const room = getRoom(state.roomCode);
          if (!room || room.hostId !== cid) return;

          room.currentTime = msg.time;
          room.lastSyncAt = Date.now();
          broadcastToRoom(room, { type: "seek", time: msg.time }, cid);
          break;
        }

        case "sync": {
          const state = wsState.get(cid);
          if (!state?.roomCode) return;
          const room = getRoom(state.roomCode);
          if (!room || room.hostId !== cid) return;

          room.currentTime = msg.time;
          room.isPlaying = msg.isPlaying;
          room.lastSyncAt = Date.now();
          broadcastToRoom(
            room,
            { type: "sync", time: msg.time, isPlaying: msg.isPlaying },
            cid
          );
          break;
        }

        case "sync-request": {
          const state = wsState.get(cid);
          if (!state?.roomCode) return;
          const room = getRoom(state.roomCode);
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
          const state = wsState.get(cid);
          if (!state?.roomCode) return;
          const room = getRoom(state.roomCode);
          if (!room) return;

          broadcastToRoom(room, { type: "chat", name: state.name, text: msg.text });
          break;
        }

        case "reaction": {
          const state = wsState.get(cid);
          if (!state?.roomCode) return;
          const room = getRoom(state.roomCode);
          if (!room) return;

          broadcastToRoom(room, { type: "reaction", name: state.name, emoji: msg.emoji });
          break;
        }

        case "typing": {
          const state = wsState.get(cid);
          if (!state?.roomCode) return;
          const room = getRoom(state.roomCode);
          if (!room) return;

          broadcastToRoom(room, { type: "typing", name: state.name }, cid);
          break;
        }

        case "disconnect": {
          const pendingTimer = pendingDisconnects.get(cid);
          if (pendingTimer) {
            clearTimeout(pendingTimer);
            pendingDisconnects.delete(cid);
          }

          const state = wsState.get(cid);
          if (!state?.roomCode) break;

          const room = getRoom(state.roomCode);
          if (room) {
            removeClient(room, cid);
            broadcastToRoom(room, {
              type: "user-left",
              name: state.name,
              count: room.clients.size,
            });
          }
          wsState.delete(cid);
          wsToClientId.delete(ws);
          break;
        }
      }
    },

    close(ws) {
      let cid = wsToClientId.get(ws);
      if (!cid) {
        for (const [id, state] of wsState) {
          const room = state.roomCode ? getRoom(state.roomCode) : null;
          if (room) {
            const client = room.clients.get(id);
            if (client && client.ws === ws) {
              cid = id;
              break;
            }
          }
        }
      }

      if (cid) {
        wsToClientId.delete(ws);
        console.log(`[WS] Connection closed for ${cid}, starting 10s grace period`);

        const clientId = cid;
        const timer = setTimeout(() => {
          pendingDisconnects.delete(clientId);
          console.log(`[WS] Grace period expired for ${clientId}, cleaning up`);
          cleanupClient(clientId);
        }, 10000);

        pendingDisconnects.set(cid, timer);
      }
    },
  })

  // Static file serving (production — serves Vite build output)
  .get("/*", async ({ params }) => {
    const filePath = params["*"] || "index.html";
    const fullPath = join(CLIENT_DIR, filePath);

    const file = Bun.file(fullPath);
    if (await file.exists()) {
      const ext = "." + filePath.split(".").pop();
      return new Response(file, {
        headers: { "Content-Type": MIME_TYPES[ext] || "application/octet-stream" },
      });
    }

    // SPA fallback
    const indexFile = Bun.file(join(CLIENT_DIR, "index.html"));
    if (await indexFile.exists()) {
      return new Response(indexFile, {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    return new Response("Not Found", { status: 404 });
  })

  .listen(PORT);

console.log(`🎬 Watch Together running at http://localhost:${PORT}`);
