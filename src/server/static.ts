import { Elysia } from "elysia"
import { join } from "path"

const CLIENT_DIR = join(import.meta.dir, "..", "..", "dist", "client")

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
}

export default new Elysia().get("/*", async ({ params }) => {
  const filePath = params["*"] || "index.html"
  const fullPath = join(CLIENT_DIR, filePath)

  const file = Bun.file(fullPath)
  if (await file.exists()) {
    const ext = "." + filePath.split(".").pop()
    return new Response(file, {
      headers: { "Content-Type": MIME_TYPES[ext] || "application/octet-stream" },
    })
  }

  // SPA fallback
  const indexFile = Bun.file(join(CLIENT_DIR, "index.html"))
  if (await indexFile.exists()) {
    return new Response(indexFile, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    })
  }

  return new Response("Not Found", { status: 404 })
})
