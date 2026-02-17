import { Elysia } from "elysia"

const errMsg = (e: unknown): string => (e instanceof Error ? e.message : "Unknown error")

export default new Elysia()
  // Poster proxy
  .get("/api/poster-proxy", async ({ query }) => {
    const url = query.url as string
    if (!url) return new Response("Missing url", { status: 400 })

    try {
      const fullUrl = url.startsWith("http") ? url : `https://uakino.best${url}`
      const resp = await fetch(fullUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
          Referer: "https://uakino.best/",
        },
      })

      if (!resp.ok) return new Response("Upstream error", { status: 502 })

      const contentType = resp.headers.get("content-type") || "image/jpeg"
      const body = await resp.arrayBuffer()

      return new Response(body, {
        headers: {
          "Content-Type": contentType,
          "Cache-Control": "public, max-age=604800",
          "Access-Control-Allow-Origin": "*",
        },
      })
    } catch (e) {
      return new Response(`Proxy error: ${errMsg(e)}`, { status: 500 })
    }
  })

  // Proxy HLS requests to avoid CORS issues
  .get("/api/proxy", async ({ query }) => {
    const url = query.url
    if (!url) return new Response("Missing url", { status: 400 })

    try {
      const resp = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
          Referer: "https://ashdi.vip/",
          Origin: "https://ashdi.vip",
        },
      })

      if (!resp.ok) {
        return new Response(`Upstream error: ${resp.status}`, { status: resp.statusText ? 502 : 500 })
      }

      const contentType = resp.headers.get("content-type") || "application/octet-stream"
      const body = await resp.arrayBuffer()

      if (url.endsWith(".m3u8") || contentType.includes("mpegurl") || contentType.includes("m3u8")) {
        let text = new TextDecoder().decode(body)
        const baseUrl = url.substring(0, url.lastIndexOf("/") + 1)

        text = text.replace(/^(?!#)(\S+)$/gm, (match) => {
          let absolute: string
          if (match.startsWith("http://") || match.startsWith("https://")) {
            absolute = match
          } else if (match.startsWith("/")) {
            absolute = new URL(match, new URL(url).origin).href
          } else {
            absolute = baseUrl + match
          }
          return `/api/proxy?url=${encodeURIComponent(absolute)}`
        })

        return new Response(text, {
          headers: {
            "Content-Type": "application/vnd.apple.mpegurl",
            "Access-Control-Allow-Origin": "*",
          },
        })
      }

      return new Response(body, {
        headers: {
          "Content-Type": contentType,
          "Access-Control-Allow-Origin": "*",
        },
      })
    } catch (e) {
      return new Response(`Proxy error: ${errMsg(e)}`, { status: 500 })
    }
  })
