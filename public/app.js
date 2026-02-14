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
};

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
  li.innerHTML = `<span class="spinner"></span> <span>Loading...</span>`;

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

// Spacebar toggle play/pause when nothing is focused
document.addEventListener("keydown", (e) => {
  if (e.code !== "Space") return;
  const tag = document.activeElement.tagName;
  if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA" || tag === "BUTTON") return;
  if (!screens.room.classList.contains("active")) return;
  e.preventDefault();
  if (els.video.paused) {
    els.video.play().catch(() => {});
  } else {
    els.video.pause();
  }
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
  success: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" width="20" height="20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clip-rule="evenodd"/></svg>',
  error: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" width="20" height="20"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clip-rule="evenodd"/></svg>',
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
