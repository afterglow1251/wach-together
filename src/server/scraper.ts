import type { ContentCategory, DubGroup, Episode, ParsedShow, SearchResultItem } from "../shared/types"

export function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return Promise.race([promise, new Promise<never>((_, reject) => setTimeout(() => reject(new Error(message)), ms))])
}

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Accept-Language": "uk-UA,uk;q=0.9,en-US;q=0.8,en;q=0.7",
}

export async function parseUakinoPage(url: string): Promise<ParsedShow> {
  const resp = await fetch(url, {
    headers: { ...HEADERS, Referer: "https://uakino.best/" },
  })
  if (!resp.ok) throw new Error(`Failed to fetch uakino page: ${resp.status}`)

  const html = await resp.text()

  const titleMatch = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)
  const title = titleMatch?.[1]?.replace(/<[^>]+>/g, "").trim() || "Unknown"

  const posterMatch = html.match(/class="(?:film-poster|fposter)"[^>]*>[\s\S]*?<img[^>]+src="([^"]+)"/)
  const poster = posterMatch?.[1] || ""

  const ajaxMatch = html.match(/class="playlists-ajax"[^>]*data-xfname="([^"]+)"[^>]*data-news_id="(\d+)"/)
  if (!ajaxMatch) {
    return parseInlineFallback(html, title, poster)
  }

  const xfield = ajaxMatch[1]
  const newsId = ajaxMatch[2]

  const playlistResp = await fetch("https://uakino.best/engine/ajax/playlists.php", {
    method: "POST",
    headers: {
      ...HEADERS,
      Referer: url,
      "X-Requested-With": "XMLHttpRequest",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: `news_id=${newsId}&xfield=${xfield}`,
  })

  if (!playlistResp.ok) throw new Error(`Failed to fetch playlist: ${playlistResp.status}`)

  const playlistData = await playlistResp.json()
  if (!playlistData.success) {
    throw new Error(playlistData.message || "Playlist request failed")
  }

  const playlistHtml = playlistData.response as string

  const dubNames: string[] = []
  const dubNamesBlock = playlistHtml.match(/class="playlists-lists"[^>]*>([\s\S]*?)<\/div>/)
  if (dubNamesBlock) {
    const liRegex = /<li[^>]*>([^<]+)<\/li>/g
    let m
    while ((m = liRegex.exec(dubNamesBlock[1])) !== null) {
      dubNames.push(m[1].trim())
    }
  }

  const dubs: DubGroup[] = []
  const videosBlock = playlistHtml.match(/class="playlists-videos"[^>]*>([\s\S]*?)$/)
  if (!videosBlock) throw new Error("Could not find episodes in playlist response")

  const itemsBlockRegex = /class="playlists-items"[^>]*>([\s\S]*?)<\/div>/g
  let blockMatch
  let tabIndex = 0

  while ((blockMatch = itemsBlockRegex.exec(videosBlock[1])) !== null) {
    const blockHtml = blockMatch[1]
    const episodes: Episode[] = []

    const liRegex = /<li[^>]*data-file="([^"]+)"[^>]*(?:data-voice="([^"]+)")?[^>]*>([\s\S]*?)<\/li>/g
    let liMatch
    let epIndex = 0
    let voiceName = ""

    while ((liMatch = liRegex.exec(blockHtml)) !== null) {
      let fileUrl = liMatch[1].trim()
      if (fileUrl.startsWith("//")) fileUrl = "https:" + fileUrl

      if (!voiceName && liMatch[2]) voiceName = liMatch[2].trim()

      const epName = liMatch[3].replace(/<[^>]+>/g, "").trim() || `Серія ${epIndex + 1}`

      episodes.push({
        id: `${tabIndex}-${epIndex}`,
        name: epName,
        url: fileUrl,
        dubName: voiceName || dubNames[tabIndex] || `Озвучення ${tabIndex + 1}`,
      })
      epIndex++
    }

    const dubName = voiceName || dubNames[tabIndex] || `Озвучення ${tabIndex + 1}`
    if (episodes.length > 0) {
      dubs.push({ name: dubName, episodes })
    }
    tabIndex++
  }

  if (dubs.length === 0) {
    throw new Error("Could not find any episodes/players on this page")
  }

  return { title, poster, dubs }
}

function parseInlineFallback(html: string, title: string, poster: string): ParsedShow {
  const dubs: DubGroup[] = []

  const allDataFileRegex = /data-file="([^"]+)"/g
  const episodes: Episode[] = []
  let m
  let i = 0

  while ((m = allDataFileRegex.exec(html)) !== null) {
    let fileUrl = m[1].trim()
    if (fileUrl.startsWith("//")) fileUrl = "https:" + fileUrl
    episodes.push({
      id: `0-${i}`,
      name: `Серія ${i + 1}`,
      url: fileUrl,
      dubName: "Основне",
    })
    i++
  }

  if (episodes.length > 0) {
    dubs.push({ name: "Основне", episodes })
    return { title, poster, dubs }
  }

  const iframeMatch = html.match(/<iframe[^>]+src="([^"]*ashdi[^"]*)"/)
  if (iframeMatch) {
    let fileUrl = iframeMatch[1].trim()
    if (fileUrl.startsWith("//")) fileUrl = "https:" + fileUrl
    dubs.push({
      name: "Основне",
      episodes: [{ id: "0-0", name: title, url: fileUrl, dubName: "Основне" }],
    })
    return { title, poster, dubs }
  }

  throw new Error("Could not find any episodes/players on this page")
}

export async function extractStreamUrl(playerUrl: string): Promise<string> {
  const resp = await fetch(playerUrl, {
    headers: { ...HEADERS, Referer: "https://uakino.best/" },
  })
  if (!resp.ok) throw new Error(`Failed to fetch player page: ${resp.status}`)

  const html = await resp.text()

  const m3u8Match = html.match(/https?:\/\/[^\s"']+\.m3u8[^\s"']*/)
  if (m3u8Match) return m3u8Match[0]

  const fileMatch = html.match(/file\s*[:=]\s*["']([^"']+)["']/) || html.match(/source\s*[:=]\s*["']([^"']+)["']/)

  if (fileMatch) {
    const val = fileMatch[1]
    if (val.includes(".m3u8")) return val

    try {
      const decoded = atob(val)
      if (decoded.includes(".m3u8") || decoded.startsWith("http")) return decoded
    } catch {}

    const streamUrl = await tryGet2FunApi(val)
    if (streamUrl) return streamUrl
  }

  const hashMatch =
    html.match(/var\s+file_hash\s*=\s*["']([^"']+)["']/) ||
    html.match(/hash\s*[:=]\s*["']([^"']+)["']/) ||
    html.match(/\(["']([A-Za-z0-9+/=]{16,})["']\)/)

  if (hashMatch) {
    const streamUrl = await tryGet2FunApi(hashMatch[1])
    if (streamUrl) return streamUrl
  }

  const b64Matches = html.match(/["']([A-Za-z0-9+/=]{20,})["']/g)
  if (b64Matches) {
    for (const match of b64Matches.slice(0, 5)) {
      const clean = match.replace(/["']/g, "")
      try {
        const decoded = atob(clean)
        if (decoded.includes(".m3u8") || decoded.startsWith("http")) return decoded
      } catch {}
      const streamUrl = await tryGet2FunApi(clean)
      if (streamUrl) return streamUrl
    }
  }

  throw new Error("Could not extract stream URL from player page. Try manual .m3u8 input.")
}

async function tryGet2FunApi(param: string): Promise<string | null> {
  try {
    const encoded = btoa(btoa(param))
    const apiUrl = `https://get2.fun/point/?method=video_link2&xl=${encoded}`

    const resp = await fetch(apiUrl, {
      headers: { ...HEADERS, Referer: "https://ashdi.vip/" },
    })

    if (!resp.ok) return null

    const text = await resp.text()
    if (!text || text.length < 10) return null

    try {
      const decoded = atob(atob(text.trim()))
      if (decoded.includes(".m3u8") || decoded.startsWith("http")) return decoded
    } catch {}

    try {
      const decoded = atob(text.trim())
      if (decoded.includes(".m3u8") || decoded.startsWith("http")) return decoded
    } catch {}

    return null
  } catch {
    return null
  }
}

// --- Search & Browse ---

const CATEGORY_MAP: Record<string, string> = {
  films: "/filmy/",
  series: "/seriesss/",
  cartoons: "/cartoon/",
  anime: "/animeukr/",
}

function detectCategory(url: string): ContentCategory | null {
  if (url.includes("/filmy/")) return "film"
  if (url.includes("/seriesss/")) return "series"
  if (url.includes("/cartoon/")) return "cartoon"
  if (url.includes("/animeukr/")) return "anime"
  return null
}

function parseResultCards(html: string): SearchResultItem[] {
  const results: SearchResultItem[] = []
  const seen = new Set<string>()

  // Cards are <div class="movie-item short-item"> ... next card or end
  const cardParts = html.split(/(?=<div\s+class="movie-item\s)/)

  for (const card of cardParts) {
    if (!card.includes("movie-item")) continue

    // Title + URL from <a class="movie-title" href="...">Title</a>
    const titleLinkMatch = card.match(/<a\s+class="movie-title"\s+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/)
    if (!titleLinkMatch) continue

    const url = titleLinkMatch[1]
    if (seen.has(url)) continue
    seen.add(url)

    const title = titleLinkMatch[2].replace(/<[^>]+>/g, "").trim()
    if (!title) continue

    // Poster from <img src="...">
    const posterMatch = card.match(/<img\s+src="([^"]+)"/)
    const poster = posterMatch?.[1] || ""

    // Year from "Рік виходу:" label followed by deck-value with a year link
    const yearMatch = card.match(/Рік виходу:[\s\S]*?find\/year\/(\d{4})\//)
    const year = yearMatch?.[1] || null

    // IMDB rating from "IMDB:" label followed by deck-value
    const ratingMatch = card.match(/IMDB:<\/span><\/div><div\s+class="deck-value"[^>]*>([\d.]+)<\/div>/)
    const rating = ratingMatch?.[1] || null

    results.push({ title, url, poster, year, rating, category: detectCategory(url) })
  }

  return results
}

export async function searchUakino(query: string, page = 1): Promise<SearchResultItem[]> {
  const body = new URLSearchParams({
    do: "search",
    subaction: "search",
    story: query,
    search_start: String(page),
    full_search: "0",
    result_from: String((page - 1) * 20 + 1),
  })

  const resp = await fetch("https://uakino.best/index.php?do=search", {
    method: "POST",
    headers: {
      ...HEADERS,
      Referer: "https://uakino.best/",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  })

  if (!resp.ok) throw new Error(`Search failed: ${resp.status}`)
  const html = await resp.text()
  return parseResultCards(html)
}

export async function browseUakino(category: string, page = 1): Promise<SearchResultItem[]> {
  const path = CATEGORY_MAP[category]
  if (!path) throw new Error(`Unknown category: ${category}`)

  const url = `https://uakino.best${path}page/${page}/`
  const resp = await fetch(url, {
    headers: { ...HEADERS, Referer: "https://uakino.best/" },
  })

  if (!resp.ok) throw new Error(`Browse failed: ${resp.status}`)
  const html = await resp.text()
  return parseResultCards(html)
}
