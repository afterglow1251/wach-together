import { parse } from "node-html-parser";
import type { DubGroup, Episode, ParsedShow } from "./types";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Accept-Language": "uk-UA,uk;q=0.9,en-US;q=0.8,en;q=0.7",
};

export async function parseUakinoPage(url: string): Promise<ParsedShow> {
  const resp = await fetch(url, { headers: { ...HEADERS, Referer: "https://uakino.best/" } });
  if (!resp.ok) throw new Error(`Failed to fetch uakino page: ${resp.status}`);

  const html = await resp.text();
  const root = parse(html);

  // Extract title
  const title =
    root.querySelector("h1")?.textContent?.trim() ||
    root.querySelector(".solodka-title")?.textContent?.trim() ||
    "Unknown";

  // Extract poster
  const posterEl = root.querySelector(".film-poster img") || root.querySelector(".fposter img");
  const poster = posterEl?.getAttribute("src") || "";

  // Parse player tabs (dubs/voices)
  const dubs: DubGroup[] = [];

  // Try new structure: multiple voice tabs with episodes
  const voiceTabs = root.querySelectorAll(".players-list .playlists-videos .playlists-items");

  if (voiceTabs.length > 0) {
    // Series with voice tabs
    const voiceNames = root.querySelectorAll(".players-list .playlists-lists li");

    voiceTabs.forEach((tab, tabIndex) => {
      const dubName = voiceNames[tabIndex]?.textContent?.trim() || `Озвучення ${tabIndex + 1}`;
      const episodes: Episode[] = [];

      const items = tab.querySelectorAll("li");
      items.forEach((item, i) => {
        const dataFile = item.getAttribute("data-file") || "";
        if (!dataFile) return;

        let fileUrl = dataFile.trim();
        if (fileUrl.startsWith("//")) fileUrl = "https:" + fileUrl;

        const epName = item.textContent?.trim() || `Серія ${i + 1}`;

        episodes.push({
          id: `${tabIndex}-${i}`,
          name: epName,
          url: fileUrl,
          dubName,
        });
      });

      if (episodes.length > 0) {
        dubs.push({ name: dubName, episodes });
      }
    });
  }

  // Fallback: try to find iframe directly (single movie)
  if (dubs.length === 0) {
    const iframeSrc =
      root.querySelector(".visible-player iframe")?.getAttribute("src") ||
      root.querySelector("#player iframe")?.getAttribute("src") ||
      root.querySelector("iframe[src*='ashdi']")?.getAttribute("src") ||
      "";

    if (iframeSrc) {
      let fileUrl = iframeSrc.trim();
      if (fileUrl.startsWith("//")) fileUrl = "https:" + fileUrl;

      dubs.push({
        name: "Основне",
        episodes: [
          {
            id: "0-0",
            name: title,
            url: fileUrl,
            dubName: "Основне",
          },
        ],
      });
    }
  }

  // Fallback: look for data-file attributes anywhere
  if (dubs.length === 0) {
    const allDataFiles = root.querySelectorAll("[data-file]");
    const episodes: Episode[] = [];

    allDataFiles.forEach((el, i) => {
      const dataFile = el.getAttribute("data-file") || "";
      if (!dataFile) return;

      let fileUrl = dataFile.trim();
      if (fileUrl.startsWith("//")) fileUrl = "https:" + fileUrl;

      const epName = el.textContent?.trim() || `Серія ${i + 1}`;
      episodes.push({
        id: `0-${i}`,
        name: epName,
        url: fileUrl,
        dubName: "Основне",
      });
    });

    if (episodes.length > 0) {
      dubs.push({ name: "Основне", episodes });
    }
  }

  if (dubs.length === 0) {
    throw new Error("Could not find any episodes/players on this page");
  }

  return { title, poster, dubs };
}

export async function extractStreamUrl(playerUrl: string): Promise<string> {
  // First, try fetching the player page directly
  const resp = await fetch(playerUrl, {
    headers: {
      ...HEADERS,
      Referer: "https://uakino.best/",
    },
  });

  if (!resp.ok) throw new Error(`Failed to fetch player page: ${resp.status}`);

  const html = await resp.text();

  // Method 1: Look for .m3u8 directly in page source
  const m3u8Match = html.match(/https?:\/\/[^\s"']+\.m3u8[^\s"']*/);
  if (m3u8Match) {
    return m3u8Match[0];
  }

  // Method 2: Look for the encoded file parameter used by the player
  // ashdi pages often have: var file = '...' or player setup with file param
  const fileMatch =
    html.match(/file\s*[:=]\s*["']([^"']+)["']/) ||
    html.match(/source\s*[:=]\s*["']([^"']+)["']/) ||
    html.match(/src\s*[:=]\s*["'](https?:\/\/[^"']*\.m3u8[^"']*)["']/);

  if (fileMatch) {
    let fileUrl = fileMatch[1];
    if (fileUrl.includes(".m3u8")) return fileUrl;
    // Could be base64 encoded
    try {
      const decoded = atob(fileUrl);
      if (decoded.includes(".m3u8") || decoded.startsWith("http")) return decoded;
    } catch {}
  }

  // Method 3: Try the get2.fun API approach
  // Extract the file/hash parameter from the page
  const hashMatch =
    html.match(/var\s+file_hash\s*=\s*["']([^"']+)["']/) ||
    html.match(/hash\s*[:=]\s*["']([^"']+)["']/) ||
    html.match(/mbn2r056csd3\(["']([^"']+)["']\)/) ||
    html.match(/getVideo\(["']([^"']+)["']\)/);

  if (hashMatch) {
    const streamUrl = await tryGet2FunApi(hashMatch[1]);
    if (streamUrl) return streamUrl;
  }

  // Method 4: Look for any function that builds video URL
  const funcMatch = html.match(/function\s+\w+\s*\(\s*\w+\s*\)\s*\{[^}]*atob[^}]*get2\.fun[^}]*/);
  if (funcMatch) {
    // Extract the argument passed to this function
    const callMatch = html.match(/\w+\s*\(\s*["']([^"']+)["']\s*\)/);
    if (callMatch) {
      const streamUrl = await tryGet2FunApi(callMatch[1]);
      if (streamUrl) return streamUrl;
    }
  }

  // Method 5: brute force - look for any encoded strings that might be the param
  const b64Matches = html.match(/["']([A-Za-z0-9+/=]{20,})["']/g);
  if (b64Matches) {
    for (const match of b64Matches.slice(0, 5)) {
      const clean = match.replace(/["']/g, "");
      try {
        const decoded = atob(clean);
        if (decoded.includes(".m3u8") || decoded.startsWith("http")) return decoded;
        // Try double decode
        const decoded2 = atob(decoded);
        if (decoded2.includes(".m3u8") || decoded2.startsWith("http")) return decoded2;
      } catch {}
    }
  }

  throw new Error("Could not extract stream URL from player page. Try manual .m3u8 input.");
}

async function tryGet2FunApi(param: string): Promise<string | null> {
  try {
    const encoded = btoa(btoa(param));
    const apiUrl = `https://get2.fun/point/?method=video_link2&xl=${encoded}`;

    const resp = await fetch(apiUrl, {
      headers: {
        ...HEADERS,
        Referer: "https://ashdi.vip/",
      },
    });

    if (!resp.ok) return null;

    const text = await resp.text();
    if (!text || text.length < 10) return null;

    // Double base64 decode the response
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
