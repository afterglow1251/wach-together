// ---- State ----
let ws = null;
let clientId = "c_" + Math.random().toString(36).slice(2, 10) + "_" + Date.now().toString(36);
let roomCode = null;
let isHost = false;
let show = null;
let currentDubIndex = 0;
let currentEpisode = null;
let hls = null;
let syncInterval = null;
let ignoreEvents = false;

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
  parseStatus: $("#parseStatus"),
  manualSection: $("#manualSection"),
  manualM3u8: $("#manualM3u8"),
  btnManual: $("#btnManual"),
  showInfo: $("#showInfo"),
  showTitle: $("#showTitle"),
  dubSection: $("#dubSection"),
  dubSelect: $("#dubSelect"),
  episodeSection: $("#episodeSection"),
  episodeList: $("#episodeList"),
  video: $("#video"),
  playerOverlay: $("#playerOverlay"),
  controls: $("#controls"),
  nowPlaying: $("#nowPlaying"),
  qualitySelect: $("#qualitySelect"),
};

// ---- Screen Management ----
function showScreen(name) {
  Object.values(screens).forEach((s) => s.classList.remove("active"));
  screens[name].classList.add("active");
}

// ---- WebSocket ----
function connectWS(onOpen) {
  const proto = location.protocol === "https:" ? "wss:" : "ws:";
  ws = new WebSocket(`${proto}//${location.host}/ws`);

  ws.onopen = () => onOpen && onOpen();

  ws.onmessage = (e) => {
    const msg = JSON.parse(e.data);
    handleWSMessage(msg);
  };

  ws.onclose = () => {
    console.log("WS disconnected, reconnecting...");
    setTimeout(() => connectWS(() => {
      if (roomCode) {
        send({ type: "join", roomCode, name: els.userName.value || "Guest" });
      }
    }), 2000);
  };
}

function send(msg) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ ...msg, clientId }));
  }
}

function handleWSMessage(msg) {
  switch (msg.type) {

    case "room-info":
      setupRoom(msg.room);
      break;

    case "show-loaded":
      show = msg.show;
      renderShow();
      break;

    case "episode-changed":
      currentEpisode = msg.episode;
      loadStream(msg.streamUrl);
      highlightEpisode();
      break;

    case "play":
      ignoreEvents = true;
      els.video.currentTime = msg.time;
      els.video.play().catch(() => {});
      ignoreEvents = false;
      break;

    case "pause":
      ignoreEvents = true;
      els.video.currentTime = msg.time;
      els.video.pause();
      ignoreEvents = false;
      break;

    case "seek":
      ignoreEvents = true;
      els.video.currentTime = msg.time;
      ignoreEvents = false;
      break;

    case "sync":
      if (!isHost) {
        const drift = Math.abs(els.video.currentTime - msg.time);
        if (drift > 1.5) {
          ignoreEvents = true;
          els.video.currentTime = msg.time;
          ignoreEvents = false;
        }
        if (msg.isPlaying && els.video.paused) {
          els.video.play().catch(() => {});
        } else if (!msg.isPlaying && !els.video.paused) {
          els.video.pause();
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
      alert(msg.message);
      break;
  }
}

// ---- Room Setup ----
function setupRoom(room) {
  roomCode = room.code;
  isHost = room.isHost;
  clientId = room.clientId;

  showScreen("room");

  els.roomCode.textContent = room.code;
  els.userCount.textContent = formatViewers(room.clientCount);
  els.hostBadge.classList.toggle("hidden", !isHost);
  els.urlSection.classList.toggle("hidden", !isHost);
  els.manualSection.classList.toggle("hidden", !isHost);

  if (room.show) {
    show = room.show;
    renderShow();
  }

  if (room.streamUrl) {
    currentEpisode = room.currentEpisode;
    loadStream(room.streamUrl);
    highlightEpisode();

    if (room.currentTime > 0) {
      els.video.currentTime = room.currentTime;
    }
    if (room.isPlaying) {
      els.video.play().catch(() => {});
    }
  }

  // Host sync interval
  if (isHost) {
    if (syncInterval) clearInterval(syncInterval);
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
  // Update now playing
  els.nowPlaying.textContent = currentEpisode.name;
}

// ---- HLS Player ----
function loadStream(url) {
  // Use proxy for the stream
  const proxiedUrl = `/api/proxy?url=${encodeURIComponent(url)}`;

  els.playerOverlay.classList.add("hidden");
  els.controls.classList.remove("hidden");

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
      populateQualitySelector(data.levels);
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

function populateQualitySelector(levels) {
  els.qualitySelect.innerHTML = '<option value="-1">Auto</option>';
  levels.forEach((level, i) => {
    const height = level.height;
    const label = height ? `${height}p` : `Level ${i}`;
    els.qualitySelect.innerHTML += `<option value="${i}">${label}</option>`;
  });
}

// ---- Event Listeners ----

// Landing
els.btnCreate.addEventListener("click", () => {
  connectWS(() => {
    send({ type: "join", roomCode: "", name: els.userName.value || "Guest" });
  });
});

els.btnJoin.addEventListener("click", () => {
  const code = els.joinCode.value.trim().toUpperCase();
  if (!code) return;
  connectWS(() => {
    send({ type: "join", roomCode: code, name: els.userName.value || "Guest" });
  });
});

els.joinCode.addEventListener("keydown", (e) => {
  if (e.key === "Enter") els.btnJoin.click();
});

// Copy room code
els.btnCopyCode.addEventListener("click", () => {
  navigator.clipboard.writeText(roomCode).then(() => {
    els.btnCopyCode.title = "Скопійовано!";
    setTimeout(() => (els.btnCopyCode.title = "Копіювати код"), 2000);
  });
});

// Parse UaKino URL
els.btnParse.addEventListener("click", async () => {
  const url = els.uakinoUrl.value.trim();
  if (!url) return;

  els.btnParse.disabled = true;
  els.parseStatus.textContent = "Завантаження...";
  els.parseStatus.className = "status-text";

  try {
    const resp = await fetch("/api/parse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
    const data = await resp.json();

    if (data.ok) {
      show = data.show;
      els.parseStatus.textContent = `Знайдено ${show.dubs.reduce((a, d) => a + d.episodes.length, 0)} серій`;
      els.parseStatus.className = "status-text success";
      renderShow();
      send({ type: "set-show", show });
    } else {
      els.parseStatus.textContent = data.error;
      els.parseStatus.className = "status-text error";
    }
  } catch (e) {
    els.parseStatus.textContent = "Помилка з'єднання";
    els.parseStatus.className = "status-text error";
  }

  els.btnParse.disabled = false;
});

// Manual m3u8
els.btnManual.addEventListener("click", () => {
  const url = els.manualM3u8.value.trim();
  if (!url) return;

  currentEpisode = { id: "manual", name: "Manual stream", url: "", dubName: "" };
  loadStream(url);
  send({ type: "select-episode", episode: currentEpisode });
  send({ type: "stream-ready", streamUrl: url });
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
  li.innerHTML = `<span class="spinner"></span> <span>Завантаження...</span>`;

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
      alert(`Не вдалося отримати відео: ${data.error}\n\nСпробуйте вставити .m3u8 вручну.`);
    }
  } catch (e) {
    alert("Помилка з'єднання з сервером");
  }

  renderEpisodes();
});

// Quality selector
els.qualitySelect.addEventListener("change", () => {
  if (hls) {
    hls.currentLevel = parseInt(els.qualitySelect.value);
  }
});

// Video events (host only)
els.video.addEventListener("play", () => {
  if (!isHost || ignoreEvents) return;
  send({ type: "play" });
});

els.video.addEventListener("pause", () => {
  if (!isHost || ignoreEvents) return;
  send({ type: "pause" });
});

els.video.addEventListener("seeked", () => {
  if (!isHost || ignoreEvents) return;
  send({ type: "seek", time: els.video.currentTime });
});

// Cleanup on page unload
window.addEventListener("beforeunload", () => {
  send({ type: "disconnect" });
});

// ---- Helpers ----
function formatViewers(n) {
  if (n === 1) return "1 глядач";
  if (n >= 2 && n <= 4) return `${n} глядачі`;
  return `${n} глядачів`;
}
