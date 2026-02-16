import { createContext, useContext, onCleanup, type ParentComponent, type Accessor } from "solid-js";
import { createStore, produce } from "solid-js/store";
import type { Episode, ParsedShow, RoomInfo } from "../../shared/types";
import type { WSServerMessage } from "../../shared/ws-types";
import * as ws from "../services/ws";
import { playNotificationBeep } from "../services/audio";

export interface ChatMsg {
  name: string;
  text: string;
  isMe: boolean;
  id: number;
  time: number;
}

export interface RoomState {
  connected: boolean;
  roomCode: string | null;
  isHost: boolean;
  clientCount: number;
  viewers: string[];
  show: ParsedShow | null;
  sourceUrl: string | null;
  currentEpisode: Episode | null;
  streamUrl: string | null;
  isPlaying: boolean;
  currentTime: number;
  chat: ChatMsg[];
  typingUser: string | null;
  lastReaction: { emoji: string; id: number } | null;
}

interface RoomActions {
  state: RoomState;
  createRoom: (name: string) => void;
  joinRoom: (code: string, name: string) => void;
  leaveRoom: () => void;
  setShow: (show: ParsedShow, sourceUrl: string) => void;
  selectEpisode: (episode: Episode) => void;
  streamReady: (streamUrl: string) => void;
  sendPlay: (time: number) => void;
  sendPause: (time: number) => void;
  sendSeek: (time: number) => void;
  sendSync: (time: number, isPlaying: boolean) => void;
  sendChat: (text: string) => void;
  sendReaction: (emoji: string) => void;
  sendTyping: () => void;
  getUsername: () => string;
}

const RoomContext = createContext<RoomActions>();

let chatIdCounter = 0;
let reactionIdCounter = 0;

export const RoomProvider: ParentComponent<{ username: Accessor<string> }> = (props) => {
  let typingTimer: ReturnType<typeof setTimeout> | null = null;
  let syncInterval: ReturnType<typeof setInterval> | null = null;

  const [state, setState] = createStore<RoomState>({
    connected: false,
    roomCode: null,
    isHost: false,
    clientCount: 0,
    viewers: [],
    show: null,
    sourceUrl: null,
    currentEpisode: null,
    streamUrl: null,
    isPlaying: false,
    currentTime: 0,
    chat: [],
    typingUser: null,
    lastReaction: null,
  });

  function handleMessage(msg: WSServerMessage) {
    switch (msg.type) {
      case "room-info":
        setupRoom(msg.room);
        break;
      case "show-loaded": {
        const sameShow = msg.sourceUrl && msg.sourceUrl === state.sourceUrl;
        setState({
          show: msg.show,
          sourceUrl: msg.sourceUrl || state.sourceUrl,
          // Keep current playback when re-loading the same URL
          currentEpisode: sameShow ? state.currentEpisode : null,
          streamUrl: sameShow ? state.streamUrl : null,
        });
        break;
      }
      case "episode-changed":
        setState({ currentEpisode: msg.episode, streamUrl: msg.streamUrl });
        break;
      case "play":
        setState({ isPlaying: true, currentTime: msg.time });
        break;
      case "pause":
        setState({ isPlaying: false, currentTime: msg.time });
        break;
      case "seek":
        setState({ currentTime: msg.time });
        break;
      case "sync":
        setState({ currentTime: msg.time, isPlaying: msg.isPlaying });
        break;
      case "user-joined":
        setState({ clientCount: msg.count, viewers: msg.viewers });
        break;
      case "user-left":
        setState({ clientCount: msg.count, viewers: msg.viewers });
        break;
      case "chat": {
        const isMe = msg.name === props.username();
        setState(produce(s => {
          s.chat.push({ name: msg.name, text: msg.text, isMe, id: ++chatIdCounter, time: msg.time });
        }));
        if (!isMe) playNotificationBeep();
        break;
      }
      case "reaction":
        setState({ lastReaction: { emoji: msg.emoji, id: ++reactionIdCounter } });
        break;
      case "typing":
        setState({ typingUser: msg.name });
        if (typingTimer) clearTimeout(typingTimer);
        typingTimer = setTimeout(() => setState({ typingUser: null }), 2000);
        break;
      case "error":
        console.error("[WS] Error:", msg.message);
        break;
    }
  }

  ws.onMessage(handleMessage);

  function setupRoom(room: RoomInfo) {
    ws.setClientId(room.clientId);
    ws.setReconnectInfo(room.code, props.username());
    if (syncInterval) clearInterval(syncInterval);
    syncInterval = null;

    setState({
      connected: true,
      roomCode: room.code,
      isHost: room.isHost,
      clientCount: room.clientCount,
      viewers: room.viewers,
      show: room.show,
      sourceUrl: room.sourceUrl,
      currentEpisode: room.currentEpisode,
      streamUrl: room.streamUrl,
      isPlaying: room.isPlaying,
      currentTime: room.currentTime,
    });
  }

  onCleanup(() => {
    if (syncInterval) clearInterval(syncInterval);
    if (typingTimer) clearTimeout(typingTimer);
  });

  const actions: RoomActions = {
    state,
    getUsername: () => props.username(),

    createRoom(name) {
      ws.connect(() => {
        ws.send({ type: "join", clientId: ws.getClientId(), roomCode: "", name });
      });
    },

    joinRoom(code, name) {
      ws.connect(() => {
        ws.send({ type: "join", clientId: ws.getClientId(), roomCode: code, name });
      });
    },

    leaveRoom() {
      if (syncInterval) clearInterval(syncInterval);
      syncInterval = null;
      ws.send({ type: "disconnect", clientId: ws.getClientId() });
      ws.disconnect();
      setState({
        connected: false, roomCode: null, isHost: false, clientCount: 0, viewers: [],
        show: null, sourceUrl: null, currentEpisode: null, streamUrl: null,
        isPlaying: false, currentTime: 0, chat: [], typingUser: null,
      });
    },

    setShow(show, sourceUrl) {
      ws.send({ type: "set-show", clientId: ws.getClientId(), show, sourceUrl });
    },

    selectEpisode(episode) {
      setState({ currentEpisode: episode, streamUrl: null, currentTime: 0, isPlaying: false });
      ws.send({ type: "select-episode", clientId: ws.getClientId(), episode });
    },

    streamReady(streamUrl) {
      setState({ streamUrl });
      ws.send({ type: "stream-ready", clientId: ws.getClientId(), streamUrl });
    },

    sendPlay(time) {
      ws.send({ type: "play", clientId: ws.getClientId(), time });
    },

    sendPause(time) {
      ws.send({ type: "pause", clientId: ws.getClientId(), time });
    },

    sendSeek(time) {
      ws.send({ type: "seek", clientId: ws.getClientId(), time });
    },

    sendSync(time, isPlaying) {
      ws.send({ type: "sync", clientId: ws.getClientId(), time, isPlaying });
    },

    sendChat(text) {
      ws.send({ type: "chat", clientId: ws.getClientId(), text });
    },

    sendReaction(emoji) {
      ws.send({ type: "reaction", clientId: ws.getClientId(), emoji });
    },

    sendTyping() {
      ws.send({ type: "typing", clientId: ws.getClientId() });
    },
  };

  return (
    <RoomContext.Provider value={actions}>
      {props.children}
    </RoomContext.Provider>
  );
};

export function useRoom() {
  const ctx = useContext(RoomContext);
  if (!ctx) throw new Error("useRoom must be used within RoomProvider");
  return ctx;
}
