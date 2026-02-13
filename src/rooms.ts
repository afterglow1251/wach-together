import type { Room, RoomClient, RoomInfo } from "./types";

const rooms = new Map<string, Room>();

function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 5; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

let clientCounter = 0;
export function generateClientId(): string {
  return `c_${++clientCounter}_${Date.now().toString(36)}`;
}

export function createRoom(hostId: string): Room {
  let code: string;
  do {
    code = generateCode();
  } while (rooms.has(code));

  const room: Room = {
    code,
    hostId,
    show: null,
    currentEpisode: null,
    streamUrl: null,
    isPlaying: false,
    currentTime: 0,
    lastSyncAt: Date.now(),
    clients: new Map(),
  };

  rooms.set(code, room);
  return room;
}

export function getRoom(code: string): Room | undefined {
  return rooms.get(code.toUpperCase());
}

export function addClient(room: Room, client: RoomClient): void {
  room.clients.set(client.id, client);
}

export function removeClient(room: Room, clientId: string): void {
  room.clients.delete(clientId);

  // Transfer host if host left
  if (room.hostId === clientId && room.clients.size > 0) {
    const newHost = room.clients.values().next().value!;
    room.hostId = newHost.id;
    newHost.isHost = true;
  }

  // Clean up empty rooms
  if (room.clients.size === 0) {
    rooms.delete(room.code);
  }
}

export function broadcastToRoom(room: Room, message: object, excludeId?: string): void {
  const data = JSON.stringify(message);
  for (const [id, client] of room.clients) {
    if (id !== excludeId) {
      try {
        client.ws.send(data);
      } catch {
        // Client disconnected
      }
    }
  }
}

export function getRoomInfo(room: Room, clientId: string): RoomInfo {
  return {
    code: room.code,
    hostId: room.hostId,
    clientId,
    isHost: room.hostId === clientId,
    clientCount: room.clients.size,
    show: room.show,
    currentEpisode: room.currentEpisode,
    streamUrl: room.streamUrl,
    isPlaying: room.isPlaying,
    currentTime: room.currentTime,
  };
}
