import type { DubGroup, Episode, ParsedShow } from "./types";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Accept-Language": "uk-UA,uk;q=0.9,en-US;q=0.8,en;q=0.7",
};

export async function parseUakinoPage(url: string): Promise<ParsedShow> {
  const resp = await fetch(url, {
    headers: { ...HEADERS, Referer: "https://uakino.best/" },
  });
  if (!resp.ok) throw new Error(`Failed to fetch uakino page: ${resp.status}`);

  const html = await resp.text();

  // Extract title — h1 may contain nested spans like <h1><span class="solototle">Title</span></h1>
  const titleMatch = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/);
  const title = titleMatch?.[1]?.replace(/<[^>]+>/g, "").trim() || "Unknown";

  // Extract poster
  const posterMatch = html.match(/class="(?:film-poster|fposter)"[^>]*>[\s\S]*?<img[^>]+src="([^"]+)"/);
  const poster = posterMatch?.[1] || "";

  // Extract news_id and xfield from the AJAX playlist loader div
  // <div class="playlists-ajax" data-xfname="playlist" data-news_id="5613">
  const ajaxMatch = html.match(/class="playlists-ajax"[^>]*data-xfname="([^"]+)"[^>]*data-news_id="(\d+)"/);
  if (!ajaxMatch) {
    // No AJAX playlist — try inline data-file or iframe fallback
    return parseInlineFallback(html, title, poster);
  }

  const xfield = ajaxMatch[1];
  const newsId = ajaxMatch[2];

  // Fetch playlist via the same AJAX endpoint UaKino uses
  const playlistResp = await fetch("https://uakino.best/engine/ajax/playlists.php", {
    method: "POST",
    headers: {
      ...HEADERS,
      Referer: url,
      "X-Requested-With": "XMLHttpRequest",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: `news_id=${newsId}&xfield=${xfield}`,
  });

  if (!playlistResp.ok) throw new Error(`Failed to fetch playlist: ${playlistResp.status}`);

  const playlistData = await playlistResp.json();
  if (!playlistData.success) {
    throw new Error(playlistData.message || "Playlist request failed");
  }

  const playlistHtml = playlistData.response as string;

  // Parse dub names from .playlists-lists
  const dubNames: string[] = [];
  const dubNamesBlock = playlistHtml.match(/class="playlists-lists"[^>]*>([\s\S]*?)<\/div>/);
  if (dubNamesBlock) {
    const liRegex = /<li[^>]*>([^<]+)<\/li>/g;
    let m;
    while ((m = liRegex.exec(dubNamesBlock[1])) !== null) {
      dubNames.push(m[1].trim());
    }
  }

  // Parse episodes from .playlists-videos
  const dubs: DubGroup[] = [];
  const videosBlock = playlistHtml.match(/class="playlists-videos"[^>]*>([\s\S]*?)$/);
  if (!videosBlock) throw new Error("Could not find episodes in playlist response");

  const itemsBlockRegex = /class="playlists-items"[^>]*>([\s\S]*?)<\/div>/g;
  let blockMatch;
  let tabIndex = 0;

  while ((blockMatch = itemsBlockRegex.exec(videosBlock[1])) !== null) {
    const blockHtml = blockMatch[1];
    const episodes: Episode[] = [];

    // Extract voice name from data-voice attribute if available, otherwise use dubNames
    const liRegex = /<li[^>]*data-file="([^"]+)"[^>]*(?:data-voice="([^"]+)")?[^>]*>([\s\S]*?)<\/li>/g;
    let liMatch;
    let epIndex = 0;
    let voiceName = "";

    while ((liMatch = liRegex.exec(blockHtml)) !== null) {
      let fileUrl = liMatch[1].trim();
      if (fileUrl.startsWith("//")) fileUrl = "https:" + fileUrl;

      if (!voiceName && liMatch[2]) voiceName = liMatch[2].trim();

      const epName = liMatch[3].replace(/<[^>]+>/g, "").trim() || `Серія ${epIndex + 1}`;

      episodes.push({
        id: `${tabIndex}-${epIndex}`,
        name: epName,
        url: fileUrl,
        dubName: voiceName || dubNames[tabIndex] || `Озвучення ${tabIndex + 1}`,
      });
      epIndex++;
    }

    const dubName = voiceName || dubNames[tabIndex] || `Озвучення ${tabIndex + 1}`;
    if (episodes.length > 0) {
      dubs.push({ name: dubName, episodes });
    }
    tabIndex++;
  }

  if (dubs.length === 0) {
    throw new Error("Could not find any episodes/players on this page");
  }

  return { title, poster, dubs };
}

function parseInlineFallback(html: string, title: string, poster: string): ParsedShow {
  const dubs: DubGroup[] = [];

  // Try inline data-file attributes
  const allDataFileRegex = /data-file="([^"]+)"/g;
  const episodes: Episode[] = [];
  let m;
  let i = 0;

  while ((m = allDataFileRegex.exec(html)) !== null) {
    let fileUrl = m[1].trim();
    if (fileUrl.startsWith("//")) fileUrl = "https:" + fileUrl;
    episodes.push({
      id: `0-${i}`,
      name: `Серія ${i + 1}`,
      url: fileUrl,
      dubName: "Основне",
    });
    i++;
  }

  if (episodes.length > 0) {
    dubs.push({ name: "Основне", episodes });
    return { title, poster, dubs };
  }

  // Try iframe (single movie)
  const iframeMatch = html.match(/<iframe[^>]+src="([^"]*ashdi[^"]*)"/);
  if (iframeMatch) {
    let fileUrl = iframeMatch[1].trim();
    if (fileUrl.startsWith("//")) fileUrl = "https:" + fileUrl;
    dubs.push({
      name: "Основне",
      episodes: [{ id: "0-0", name: title, url: fileUrl, dubName: "Основне" }],
    });
    return { title, poster, dubs };
  }

  throw new Error("Could not find any episodes/players on this page");
}

export async function extractStreamUrl(playerUrl: string): Promise<string> {
  const resp = await fetch(playerUrl, {
    headers: { ...HEADERS, Referer: "https://uakino.best/" },
  });
  if (!resp.ok) throw new Error(`Failed to fetch player page: ${resp.status}`);

  const html = await resp.text();

  // Method 1: Look for .m3u8 directly in page source
  const m3u8Match = html.match(/https?:\/\/[^\s"']+\.m3u8[^\s"']*/);
  if (m3u8Match) return m3u8Match[0];

  // Method 2: Look for file parameter in player JS
  const fileMatch =
    html.match(/file\s*[:=]\s*["']([^"']+)["']/) ||
    html.match(/source\s*[:=]\s*["']([^"']+)["']/);

  if (fileMatch) {
    const val = fileMatch[1];
    if (val.includes(".m3u8")) return val;

    // Could be base64 encoded
    try {
      const decoded = atob(val);
      if (decoded.includes(".m3u8") || decoded.startsWith("http")) return decoded;
    } catch {}

    // Try as get2.fun param
    const streamUrl = await tryGet2FunApi(val);
    if (streamUrl) return streamUrl;
  }

  // Method 3: Extract hash/param for get2.fun API
  const hashMatch =
    html.match(/var\s+file_hash\s*=\s*["']([^"']+)["']/) ||
    html.match(/hash\s*[:=]\s*["']([^"']+)["']/) ||
    html.match(/\(["']([A-Za-z0-9+/=]{16,})["']\)/);

  if (hashMatch) {
    const streamUrl = await tryGet2FunApi(hashMatch[1]);
    if (streamUrl) return streamUrl;
  }

  // Method 4: Try all base64-looking strings as get2.fun params
  const b64Matches = html.match(/["']([A-Za-z0-9+/=]{20,})["']/g);
  if (b64Matches) {
    for (const match of b64Matches.slice(0, 5)) {
      const clean = match.replace(/["']/g, "");
      try {
        const decoded = atob(clean);
        if (decoded.includes(".m3u8") || decoded.startsWith("http")) return decoded;
      } catch {}
      const streamUrl = await tryGet2FunApi(clean);
      if (streamUrl) return streamUrl;
    }
  }

  throw new Error("Could not extract stream URL from player page. Try manual .m3u8 input.");
}

async function tryGet2FunApi(param: string): Promise<string | null> {
  try {
    const encoded = btoa(btoa(param));
    const apiUrl = `https://get2.fun/point/?method=video_link2&xl=${encoded}`;

    const resp = await fetch(apiUrl, {
      headers: { ...HEADERS, Referer: "https://ashdi.vip/" },
    });

    if (!resp.ok) return null;

    const text = await resp.text();
    if (!text || text.length < 10) return null;

    // Double base64 decode
    try {
      const decoded = atob(atob(text.trim()));
      if (decoded.includes(".m3u8") || decoded.startsWith("http")) return decoded;
    } catch {}

    // Single decode
    try {
      const decoded = atob(text.trim());
      if (decoded.includes(".m3u8") || decoded.startsWith("http")) return decoded;
    } catch {}

    return null;
  } catch {
    return null;
  }
}
