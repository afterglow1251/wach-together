// ---- State ----
let ws = null;
let clientId =
  sessionStorage.getItem("wt_clientId") ||
  "c_" + Math.random().toString(36).slice(2, 10) + "_" + Date.now().toString(36);
let roomCode = null;
let isHost = false;
let show = null;
let currentDubIndex = 0;
let currentEpisode = null;
let hls = null;
let player = null;
let syncInterval = null;
let ignoreEvents = false;

// Persist clientId so reconnects use the same identity
sessionStorage.setItem("wt_clientId", clientId);

// ---- DOM ----
const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

const screens = {
  landing: $("#landing"),
  room: $("#room"),
};

const els = {
  userName: $("#userName"),
  joinCode: $("#joinCode"),
  btnCreate: $("#btnCreate"),
  btnJoin: $("#btnJoin"),
  roomCode: $("#roomCode"),
  btnCopyCode: $("#btnCopyCode"),
  userCount: $("#userCount"),
  hostBadge: $("#hostBadge"),
  urlSection: $("#urlSection"),
  uakinoUrl: $("#uakinoUrl"),
  btnParse: $("#btnParse"),
  showInfo: $("#showInfo"),
  showTitle: $("#showTitle"),
  dubSection: $("#dubSection"),
  dubSelect: $("#dubSelect"),
  episodeSection: $("#episodeSection"),
  episodeList: $("#episodeList"),
  video: $("#video"),
  playerOverlay: $("#playerOverlay"),
  chatMessages: $("#chatMessages"),
  chatInput: $("#chatInput"),
  btnSendChat: $("#btnSendChat"),
  reactionsBar: $("#reactionsBar"),
  reactionsContainer: $("#reactionsContainer"),
  fsChat: $("#fsChat"),
  fsChatMessages: $("#fsChatMessages"),
  fsChatInput: $("#fsChatInput"),
  fsChatInputField: $("#fsChatInputField"),
  btnFsChat: $("#btnFsChat"),
};

// ---- Plyr Init ----
player = new Plyr(els.video, {
  controls: ['play-large', 'play', 'progress', 'current-time', 'duration', 'mute', 'volume', 'fullscreen'],
  keyboard: { focused: true, global: true },
  tooltips: { controls: true, seek: true },
  seekTime: 5,
  clickToPlay: false,
  fullscreen: { iosNative: true, container: ".player-wrapper" },
});

// Custom click/dblclick — single click = play/pause, double click = fullscreen only
let clickTimer = null;
const videoWrapper = $(".plyr__video-wrapper") || $(".plyr");
if (videoWrapper) {
  videoWrapper.addEventListener("click", (e) => {
    if (e.target.closest(".plyr__controls") || e.target.closest("button")) return;
    if (clickTimer) {
      clearTimeout(clickTimer);
      clickTimer = null;
      player.fullscreen.toggle();
    } else {
      clickTimer = setTimeout(() => {
        clickTimer = null;
        player.togglePlay();
      }, 250);
    }
  });
}


// ---- Session Persistence ----
function saveSession() {
  sessionStorage.setItem("wt_clientId", clientId);
  sessionStorage.setItem("wt_userName", els.userName.value || "Guest");
}

function clearSession() {
  roomCode = null;
  history.pushState({}, "", "/");
}

function getSavedName() {
  return sessionStorage.getItem("wt_userName") || els.userName.value || "Guest";
}

// ---- Screen Management ----
function showScreen(name) {
  Object.values(screens).forEach((s) => s.classList.remove("active"));
  screens[name].classList.add("active");
}

// ---- WebSocket ----
function connectWS(onOpen) {
  // Close existing connection cleanly to prevent ghost connections
  if (ws) {
    const oldWs = ws;
    oldWs.onclose = null;
    oldWs.onerror = null;
    oldWs.onmessage = null;
    if (oldWs.readyState === WebSocket.OPEN || oldWs.readyState === WebSocket.CONNECTING) {
      oldWs.close();
    }
    ws = null;
  }

  const proto = location.protocol === "https:" ? "wss:" : "ws:";
  ws = new WebSocket(`${proto}//${location.host}/ws`);

  ws.onopen = () => {
    console.log("[WS] Connected");
    if (onOpen) onOpen();
  };

  ws.onmessage = (e) => {
    try {
      const msg = JSON.parse(e.data);
      handleWSMessage(msg);
    } catch (err) {
      console.error("[WS] Failed to parse message:", err);
    }
  };

  ws.onerror = (e) => {
    console.error("[WS] Error:", e);
  };

  ws.onclose = () => {
    console.log("[WS] Disconnected");
    ws = null;
    // Only auto-reconnect if we were in a room
    if (roomCode) {
      console.log("[WS] Reconnecting in 2s...");
      setTimeout(() => {
        connectWS(() => {
          send({ type: "join", roomCode, name: getSavedName() });
        });
      }, 2000);
    }
  };
}

function send(msg) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ ...msg, clientId }));
  }
}

function handleWSMessage(msg) {
  console.log("[WS] Received:", msg.type);

  switch (msg.type) {
    case "room-info":
      setupRoom(msg.room);
      break;

    case "show-loaded":
      show = msg.show;
      currentDubIndex = 0;
      renderShow();
      break;

    case "episode-changed":
      currentEpisode = msg.episode;
      if (msg.streamUrl) {
        loadStream(msg.streamUrl);
      }
      highlightEpisode();
      break;

    case "play":
      if (!isHost) {
        ignoreEvents = true;
        els.video.currentTime = msg.time;
        els.video.play().catch(() => {});
        setTimeout(() => { ignoreEvents = false; }, 200);
      }
      break;

    case "pause":
      if (!isHost) {
        ignoreEvents = true;
        els.video.currentTime = msg.time;
        els.video.pause();
        setTimeout(() => { ignoreEvents = false; }, 200);
      }
      break;

    case "seek":
      if (!isHost) {
        ignoreEvents = true;
        els.video.currentTime = msg.time;
        setTimeout(() => { ignoreEvents = false; }, 200);
      }
      break;

    case "sync":
      if (!isHost) {
        const drift = Math.abs(els.video.currentTime - msg.time);
        if (drift > 1.5) {
          ignoreEvents = true;
          els.video.currentTime = msg.time;
          setTimeout(() => { ignoreEvents = false; }, 200);
        }
        if (msg.isPlaying && els.video.paused) {
          ignoreEvents = true;
          els.video.play().catch(() => {});
          setTimeout(() => { ignoreEvents = false; }, 200);
        } else if (!msg.isPlaying && !els.video.paused) {
          ignoreEvents = true;
          els.video.pause();
          setTimeout(() => { ignoreEvents = false; }, 200);
        }
      }
      break;

    case "user-joined":
      els.userCount.textContent = formatViewers(msg.count);
      break;

    case "user-left":
      els.userCount.textContent = formatViewers(msg.count);
      break;

    case "chat":
      appendChatMessage(msg.name, msg.text);
      showFsChatMessage(msg.name, msg.text);
      playNotificationSound(msg.name);
      break;

    case "reaction":
      spawnFloatingEmoji(msg.emoji);
      break;

    case "typing":
      showTypingIndicator(msg.name);
      break;

    case "error":
      console.error("[WS] Server error:", msg.message);
      // If room not found, clear session and go back to landing
      if (msg.message && msg.message.includes("not found")) {
        clearSession();
        showScreen("landing");
      }
      alert(msg.message);
      break;
  }
}

// ---- Room Setup ----
function setupRoom(room) {
  roomCode = room.code;
  isHost = room.isHost;
  clientId = room.clientId;

  // Persist session for page reload
  saveSession();

  // Update URL to reflect the room
  history.pushState({}, "", "/room/" + room.code);

  showScreen("room");

  els.roomCode.textContent = room.code;
  els.userCount.textContent = formatViewers(room.clientCount);
  els.hostBadge.classList.toggle("hidden", !isHost);
  els.urlSection.classList.toggle("hidden", !isHost);



  if (room.sourceUrl) {
    els.uakinoUrl.value = room.sourceUrl;
  }

  if (room.show) {
    show = room.show;
    renderShow();
  }

  if (room.streamUrl) {
    currentEpisode = room.currentEpisode;
    loadStream(room.streamUrl);
    highlightEpisode();

    // Seek to current position after stream loads
    const seekToTime = room.currentTime || 0;
    const shouldPlay = room.isPlaying;

    if (seekToTime > 0 || shouldPlay) {
      // Wait for the stream to be ready before seeking
      const onCanPlay = () => {
        els.video.removeEventListener("canplay", onCanPlay);
        if (seekToTime > 0) {
          els.video.currentTime = seekToTime;
        }
        if (shouldPlay) {
          els.video.play().catch(() => {});
        }
      };
      els.video.addEventListener("canplay", onCanPlay);
    }
  }

  // Host sync interval
  if (syncInterval) clearInterval(syncInterval);
  syncInterval = null;

  if (isHost) {
    syncInterval = setInterval(() => {
      if (!els.video.paused && !els.video.ended) {
        send({ type: "sync", time: els.video.currentTime, isPlaying: !els.video.paused });
      }
    }, 3000);
  }
}

// ---- Show Rendering ----
function renderShow() {
  if (!show) return;

  els.showInfo.classList.remove("hidden");
  els.showTitle.textContent = show.title;

  if (show.dubs.length > 0) {
    // Render dub selector
    if (show.dubs.length > 1) {
      els.dubSection.classList.remove("hidden");
      els.dubSelect.innerHTML = show.dubs
        .map((d, i) => `<option value="${i}">${d.name}</option>`)
        .join("");
      els.dubSelect.value = currentDubIndex;
    } else {
      els.dubSection.classList.add("hidden");
    }

    renderEpisodes();
  }
}

function renderEpisodes() {
  const dub = show.dubs[currentDubIndex];
  if (!dub) return;

  els.episodeSection.classList.remove("hidden");
  els.episodeList.innerHTML = dub.episodes
    .map(
      (ep, i) =>
        `<li data-index="${i}" data-id="${ep.id}">
          <span class="ep-num">${i + 1}</span>
          <span>${ep.name}</span>
        </li>`
    )
    .join("");

  highlightEpisode();
}

function highlightEpisode() {
  if (!currentEpisode) return;
  els.episodeList.querySelectorAll("li").forEach((li) => {
    li.classList.toggle("active", li.dataset.id === currentEpisode.id);
  });
}

// ---- HLS Player ----
function loadStream(url) {
  // Use proxy for the stream
  const proxiedUrl = `/api/proxy?url=${encodeURIComponent(url)}`;

  els.playerOverlay.classList.add("hidden");
  document.querySelector(".player-wrapper").classList.remove("no-source");

  if (hls) {
    hls.destroy();
    hls = null;
  }

  if (Hls.isSupported()) {
    hls = new Hls({
      maxBufferLength: 30,
      maxMaxBufferLength: 60,
    });

    hls.loadSource(proxiedUrl);
    hls.attachMedia(els.video);

    hls.on(Hls.Events.MANIFEST_PARSED, (e, data) => {
      console.log("HLS manifest parsed, levels:", data.levels.length);
      // Auto-play for host
      if (isHost) {
        els.video.play().catch((err) => console.log("Autoplay blocked:", err));
      }
    });

    hls.on(Hls.Events.FRAG_LOADED, () => {
      console.log("Fragment loaded");
    });

    hls.on(Hls.Events.ERROR, (e, data) => {
      console.error("HLS error:", data.type, data.details, data.reason || "");
      if (data.fatal) {
        switch (data.type) {
          case Hls.ErrorTypes.NETWORK_ERROR:
            console.log("Network error, retrying...");
            hls.startLoad();
            break;
          case Hls.ErrorTypes.MEDIA_ERROR:
            console.log("Media error, recovering...");
            hls.recoverMediaError();
            break;
          default:
            hls.destroy();
            break;
        }
      }
    });
  } else if (els.video.canPlayType("application/vnd.apple.mpegurl")) {
    // Native HLS (Safari)
    els.video.src = proxiedUrl;
  }
}


// ---- Event Listeners ----

// Landing
els.btnCreate.addEventListener("click", () => {
  const name = els.userName.value || "Guest";
  connectWS(() => {
    send({ type: "join", roomCode: "", name });
  });
});

els.btnJoin.addEventListener("click", () => {
  const code = els.joinCode.value.trim().toUpperCase();
  if (!code) return;
  const name = els.userName.value || "Guest";
  connectWS(() => {
    send({ type: "join", roomCode: code, name });
  });
});

els.joinCode.addEventListener("keydown", (e) => {
  if (e.key === "Enter") els.btnJoin.click();
});

// Copy room code
els.btnCopyCode.addEventListener("click", () => {
  navigator.clipboard.writeText(roomCode).then(() => {
    toast("Room code copied!");
  });
});

// Parse UaKino URL
els.btnParse.addEventListener("click", async () => {
  const url = els.uakinoUrl.value.trim();
  if (!url) return;

  els.btnParse.disabled = true;

  try {
    const resp = await fetch("/api/parse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
    const data = await resp.json();

    if (data.ok) {
      show = data.show;
      const count = show.dubs.reduce((a, d) => a + d.episodes.length, 0);
      toast(`Found ${count} episodes`);
      renderShow();
      send({ type: "set-show", show, sourceUrl: url });
    } else {
      toast(data.error, "error");
    }
  } catch (e) {
    toast("Connection error", "error");
  }

  els.btnParse.disabled = false;
});

// Dub selector
els.dubSelect.addEventListener("change", () => {
  currentDubIndex = parseInt(els.dubSelect.value);
  renderEpisodes();
});

// Episode click
els.episodeList.addEventListener("click", async (e) => {
  if (!isHost) return;

  const li = e.target.closest("li");
  if (!li) return;

  const idx = parseInt(li.dataset.index);
  const dub = show.dubs[currentDubIndex];
  const episode = dub.episodes[idx];

  // Mark as loading
  li.classList.add("loading");
  li.innerHTML = `<span class="spinner"></span>`;

  send({ type: "select-episode", episode });
  currentEpisode = episode;

  try {
    const resp = await fetch("/api/stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: episode.url }),
    });
    const data = await resp.json();

    if (data.ok) {
      loadStream(data.streamUrl);
      send({ type: "stream-ready", streamUrl: data.streamUrl });
    } else {
      // Show error, render back
      alert(`Failed to get video: ${data.error}`);
    }
  } catch (e) {
    alert("Server connection error");
  }

  renderEpisodes();
});

// Video events - host broadcasts to keep everyone in sync
els.video.addEventListener("play", () => {
  if (ignoreEvents || !isHost) return;
  send({ type: "play", time: els.video.currentTime });
});

els.video.addEventListener("pause", () => {
  if (ignoreEvents || !isHost) return;
  send({ type: "pause", time: els.video.currentTime });
});

els.video.addEventListener("seeked", () => {
  if (ignoreEvents || !isHost) return;
  send({ type: "seek", time: els.video.currentTime });
});

// Seek indicator (YouTube-style with hearts)
const seekBackward = $("#seekBackward");
const seekForward = $("#seekForward");
const seekState = { dir: null, count: 0, timer: null };

function showSeek(dir) {
  const el = dir === "forward" ? seekForward : seekBackward;
  const other = dir === "forward" ? seekBackward : seekForward;

  // Hide other direction
  other.classList.remove("active");

  clearTimeout(seekState.timer);

  if (seekState.dir === dir) {
    seekState.count += 5;
  } else {
    seekState.dir = dir;
    seekState.count = 5;
  }

  // Update text
  el.querySelector(".seek-text").textContent = seekState.count + " seconds";

  // Restart ripple animation
  const ripple = el.querySelector(".seek-ripple");
  ripple.style.animation = "none";
  void ripple.offsetWidth;
  ripple.style.animation = "";

  el.classList.add("active");

  // Auto-hide
  seekState.timer = setTimeout(() => {
    el.classList.remove("active");
    seekState.dir = null;
    seekState.count = 0;
    seekState.timer = null;
  }, 700);
}

document.addEventListener("keydown", (e) => {
  if (!screens.room.classList.contains("active")) return;
  const focused = document.activeElement;
  const inPlyr = focused.closest(".plyr");
  if (!inPlyr && ["INPUT", "SELECT", "TEXTAREA"].includes(focused.tagName)) return;
  if (e.code === "ArrowLeft") showSeek("backward");
  if (e.code === "ArrowRight") showSeek("forward");
});

// ---- Chat ----
function appendChatMessage(name, text) {
  const myName = els.userName.value || "Guest";
  const isMe = name === myName;

  const msg = document.createElement("div");
  msg.className = "chat-msg " + (isMe ? "me" : "other");

  const nameEl = document.createElement("span");
  nameEl.className = "chat-name";
  nameEl.textContent = name;

  const textEl = document.createElement("span");
  textEl.textContent = text;

  msg.appendChild(nameEl);
  msg.appendChild(textEl);
  els.chatMessages.appendChild(msg);
  els.chatMessages.scrollTop = els.chatMessages.scrollHeight;
}

function sendChat() {
  const text = els.chatInput.value.trim();
  if (!text) return;
  send({ type: "chat", text });
  els.chatInput.value = "";
}

els.btnSendChat.addEventListener("click", sendChat);
els.chatInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") sendChat();
});

// ---- Typing Indicator ----
let typingTimer = null;
let typingShown = false;

els.chatInput.addEventListener("input", () => {
  send({ type: "typing" });
});

function showTypingIndicator(name) {
  let indicator = els.chatMessages.querySelector(".typing-indicator");
  if (!indicator) {
    indicator = document.createElement("div");
    indicator.className = "typing-indicator";
    els.chatMessages.appendChild(indicator);
  }
  indicator.textContent = name + " is writing something sweet...";
  els.chatMessages.scrollTop = els.chatMessages.scrollHeight;

  clearTimeout(typingTimer);
  typingTimer = setTimeout(() => {
    indicator.remove();
  }, 2000);
}

// ---- Emoji Reactions ----
els.reactionsBar.addEventListener("click", (e) => {
  const btn = e.target.closest(".reaction-btn");
  if (!btn) return;
  send({ type: "reaction", emoji: btn.dataset.emoji });
});

function spawnFloatingEmoji(emoji) {
  const container = els.reactionsContainer;
  const el = document.createElement("div");
  const e = emoji || "♥";
  el.className = "floating-heart" + (e === "♥" ? " is-symbol" : "");
  el.textContent = e;
  el.style.left = (40 + Math.random() * 50) + "%";
  el.style.bottom = "80px";
  container.appendChild(el);
  el.addEventListener("animationend", () => el.remove());
}

// ---- Notification Sound ----
const notifCtx = new (window.AudioContext || window.webkitAudioContext)();

function playNotificationSound(name) {
  const myName = els.userName.value || "Guest";
  if (name === myName) return; // Don't play for own messages

  const osc = notifCtx.createOscillator();
  const gain = notifCtx.createGain();
  osc.connect(gain);
  gain.connect(notifCtx.destination);

  osc.type = "sine";
  osc.frequency.setValueAtTime(880, notifCtx.currentTime);
  osc.frequency.setValueAtTime(1100, notifCtx.currentTime + 0.08);
  gain.gain.setValueAtTime(0.08, notifCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, notifCtx.currentTime + 0.25);

  osc.start(notifCtx.currentTime);
  osc.stop(notifCtx.currentTime + 0.25);
}

// ---- Fullscreen Chat ----
function showFsChatMessage(name, text) {
  const msg = document.createElement("div");
  msg.className = "fs-chat-msg";
  msg.innerHTML = '<span class="fs-chat-name">' + escapeHtml(name) + '</span>' + escapeHtml(text);
  els.fsChatMessages.appendChild(msg);

  // Remove after animation ends (4.4s = 4s delay + 0.4s fadeout)
  setTimeout(() => msg.remove(), 4400);

  // Keep max 5 messages
  while (els.fsChatMessages.children.length > 5) {
    els.fsChatMessages.firstChild.remove();
  }
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

let fsChatOpen = false;
els.btnFsChat.addEventListener("click", () => {
  fsChatOpen = !fsChatOpen;
  els.fsChatInput.classList.toggle("hidden", !fsChatOpen);
  els.fsChat.classList.toggle("visible", true);
  if (fsChatOpen) els.fsChatInputField.focus();
});

els.fsChatInputField.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    const text = els.fsChatInputField.value.trim();
    if (!text) return;
    send({ type: "chat", text });
    els.fsChatInputField.value = "";
  }
  if (e.key === "Escape") {
    fsChatOpen = false;
    els.fsChatInput.classList.add("hidden");
    els.fsChatInputField.blur();
  }
  e.stopPropagation(); // Don't trigger player shortcuts
});

els.fsChatInputField.addEventListener("input", () => {
  send({ type: "typing" });
});

// Browser back/forward navigation
window.addEventListener("popstate", () => {
  const match = location.pathname.match(/^\/room\/([A-Z0-9]{5})$/i);
  if (match) {
    const code = match[1].toUpperCase();
    if (code !== roomCode) {
      roomCode = code;
      connectWS(() => {
        send({ type: "join", roomCode: code, name: getSavedName() });
      });
    }
  } else {
    // Back to landing
    roomCode = null;
    if (ws) {
      const oldWs = ws;
      oldWs.onclose = null;
      oldWs.onerror = null;
      oldWs.onmessage = null;
      if (oldWs.readyState === WebSocket.OPEN || oldWs.readyState === WebSocket.CONNECTING) {
        oldWs.close();
      }
      ws = null;
    }
    showScreen("landing");
  }
});

// ---- Helpers ----
const TOAST_ICONS = {
  success: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>',
  error: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/><line x1="9" y1="9" x2="15" y2="15"/><line x1="15" y1="9" x2="9" y2="15"/></svg>',
};

function toast(text, type = "success") {
  const icon = TOAST_ICONS[type] || TOAST_ICONS.success;
  const node = document.createElement("div");
  node.className = "sonner-content";
  node.innerHTML = '<span class="sonner-icon">' + icon + "</span><span>" + text + "</span>";
  Toastify({
    node,
    duration: 4000,
    gravity: "top",
    position: "right",
    className: "sonner-toast sonner-" + type,
  }).showToast();
}

function formatViewers(n) {
  if (n === 1) return "1 viewer";
  return `${n} viewers`;
}

// ---- Init from URL ----
(function initFromUrl() {
  const savedName = sessionStorage.getItem("wt_userName");
  if (savedName) els.userName.value = savedName;

  const match = location.pathname.match(/^\/room\/([A-Z0-9]{5})$/i);
  if (match) {
    const code = match[1].toUpperCase();
    roomCode = code;
    // Show room screen immediately to avoid landing flash
    showScreen("room");
    connectWS(() => {
      send({ type: "join", roomCode: code, name: getSavedName() });
    });
  } else {
    showScreen("landing");
  }
})();
