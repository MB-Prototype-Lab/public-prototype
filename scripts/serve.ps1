param(
  [string]$Root = "C:\Users\Darth Hoff\Desktop\MB Prototype\mbprototype_v1-main",
  [int]$Port = 8787
)

$mime = @{
  ".html"="text/html; charset=utf-8"; ".htm"="text/html; charset=utf-8"
  ".js"="application/javascript; charset=utf-8"; ".mjs"="application/javascript; charset=utf-8"
  ".css"="text/css; charset=utf-8"; ".json"="application/json; charset=utf-8"
  ".png"="image/png"; ".jpg"="image/jpeg"; ".jpeg"="image/jpeg"; ".gif"="image/gif"
  ".svg"="image/svg+xml"; ".webp"="image/webp"; ".ico"="image/x-icon"
  ".wav"="audio/wav"; ".mp3"="audio/mpeg"; ".m4a"="audio/mp4"; ".ogg"="audio/ogg"
  ".woff"="font/woff"; ".woff2"="font/woff2"; ".ttf"="font/ttf"
  ".txt"="text/plain; charset=utf-8"; ".md"="text/markdown; charset=utf-8"
}

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")
$listener.Start()
Write-Host "serving $Root on http://localhost:$Port/"

$rootFull = (Resolve-Path $Root).Path

while ($listener.IsListening) {
  try {
    $ctx = $listener.GetContext()
    $rel = [System.Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath).TrimStart('/')
    if ($rel -eq "") { $rel = "index.html" }
    $path = Join-Path $rootFull ($rel -replace '/','\')

    if ((Test-Path $path) -and ((Get-Item $path) -is [System.IO.DirectoryInfo])) {
      $path = Join-Path $path "index.html"
    }

    # Never serve outside the root, whatever the request says.
    $resolved = $null
    if (Test-Path $path) { $resolved = (Resolve-Path $path).Path }

    if ($resolved -and $resolved.StartsWith($rootFull) -and (Test-Path $resolved -PathType Leaf)) {
      $ext = [System.IO.Path]::GetExtension($resolved).ToLower()
      $ct = $mime[$ext]; if (-not $ct) { $ct = "application/octet-stream" }
      $bytes = [System.IO.File]::ReadAllBytes($resolved)
      $ctx.Response.ContentType = $ct
      $ctx.Response.StatusCode = 200
      $ctx.Response.ContentLength64 = $bytes.Length
      $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
      Write-Host "200 $rel"
    } else {
      $body = [System.Text.Encoding]::UTF8.GetBytes("404 $rel")
      $ctx.Response.StatusCode = 404
      $ctx.Response.ContentLength64 = $body.Length
      $ctx.Response.OutputStream.Write($body, 0, $body.Length)
      Write-Host "404 $rel"
    }
    $ctx.Response.OutputStream.Close()
  } catch {
    Write-Host "err: $_"
  }
}
