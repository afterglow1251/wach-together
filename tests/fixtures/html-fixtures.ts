// HTML fixture strings for scraper tests

export const PLAYLIST_AJAX_PAGE = `
<html>
<body>
<h1>Test Movie Title</h1>
<div class="film-poster"><img src="/uploads/poster.jpg" /></div>
<div class="playlists-ajax" data-xfname="playlist" data-news_id="12345"></div>
</body>
</html>
`

export const PLAYLIST_RESPONSE_SUCCESS = {
  success: true,
  response: `
<div class="playlists-lists">
  <ul>
    <li class="active">Озвучення 1</li>
    <li>Озвучення 2</li>
  </ul>
</div>
<div class="playlists-videos">
  <div class="playlists-items">
    <li data-file="//ashdi.vip/video1" data-voice="DubGroup1">Серія 1</li>
    <li data-file="//ashdi.vip/video2">Серія 2</li>
  </div>
  <div class="playlists-items">
    <li data-file="//ashdi.vip/video3" data-voice="DubGroup2">Серія 1</li>
  </div>
</div>
`,
}

export const INLINE_DATA_FILE_PAGE = `
<html>
<body>
<h1>Inline Show</h1>
<div class="fposter"><img src="/uploads/inline-poster.jpg" /></div>
<div data-file="//ashdi.vip/inline1"></div>
<div data-file="//ashdi.vip/inline2"></div>
</body>
</html>
`

export const IFRAME_FALLBACK_PAGE = `
<html>
<body>
<h1>Iframe Movie</h1>
<div class="fposter"><img src="/uploads/iframe-poster.jpg" /></div>
<iframe src="//ashdi.vip/embed/movie123"></iframe>
</body>
</html>
`

export const NO_PLAYER_PAGE = `
<html>
<body>
<h1>Empty Page</h1>
<div class="film-poster"><img src="/uploads/empty-poster.jpg" /></div>
</body>
</html>
`

export const PLAYER_PAGE_DIRECT_M3U8 = `
<html><body>
<script>
var player = "https://cdn.example.com/stream/master.m3u8?token=abc123";
</script>
</body></html>
`

export const PLAYER_PAGE_BASE64 = `
<html><body>
<script>
file = "${btoa("https://cdn.example.com/encoded/stream.m3u8")}";
</script>
</body></html>
`

export const PLAYER_PAGE_FILE_VAR = `
<html><body>
<script>
file = "https://cdn.example.com/direct/stream.m3u8";
</script>
</body></html>
`

export const PLAYER_PAGE_NO_STREAM = `
<html><body>
<p>No stream here</p>
</body></html>
`

export const SEARCH_RESULTS_HTML = `
<div class="movie-item short-item">
  <a class="movie-title" href="https://uakino.best/filmy/test-film.html">Test Film</a>
  <img src="/uploads/poster1.jpg" />
  <div>Рік виходу:</div><a href="/find/year/2024/">2024</a>
  <div>IMDB:</span></div><div class="deck-value">7.5</div>
</div>
<div class="movie-item short-item">
  <a class="movie-title" href="https://uakino.best/seriesss/test-series.html">Test Series</a>
  <img src="/uploads/poster2.jpg" />
  <div>Рік виходу:</div><a href="/find/year/2023/">2023</a>
</div>
`

export const SEARCH_RESULTS_EMPTY = `<div class="main-content">No results found</div>`
