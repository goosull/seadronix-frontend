// /server.js
const http = require("http");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { spawn } = require("child_process");

// 파일 경로
const PUBLIC_DIR = path.join(__dirname, "public");
let currentSource = null; // 현재 비디오 소스

// 정적 파일 제공 함수
function serveStatic(req, res) {
  let urlPath = req.url === "/" ? "/index.html" : req.url;
  let filePath = path.join(PUBLIC_DIR, urlPath);
  fs.readFile(filePath, (err, data) => {
    if (err) return res.writeHead(404).end("Not Found");
    const ext = path.extname(filePath).toLowerCase();
    const contentType =
      {
        ".html": "text/html",
        ".js": "application/javascript",
        ".css": "text/css",
        ".wasm": "application/wasm",
      }[ext] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": contentType });
    res.end(data);
  });
}

// 사용자가 영상을 업로드할 때 처리
function handleUpload(req, res) {
  // 임시 파일 경로
  const tmpPath = path.join(os.tmpdir(), `upload_${Date.now()}.mp4`);
  const writeStream = fs.createWriteStream(tmpPath);
  req.pipe(writeStream);
  req.on("end", () => {
    currentSource = { type: "file", path: tmpPath }; // 현재 소스를 임시 파일로 설정
    console.log("Uploaded file saved to", tmpPath);
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("OK");
  });
  req.on("error", (err) => {
    console.error("Upload error:", err);
    res.writeHead(500).end("Upload failed");
  });
}

// 사용자가 URL을 설정할 때 처리
function handleSetUrl(req, res) {
  let body = "";
  req.on("data", (chunk) => {
    body += chunk;
  });
  req.on("end", () => {
    try {
      const { url } = JSON.parse(body);
      if (!url) throw new Error("no url");
      currentSource = { type: "url", url };
      console.log("Set stream URL to", url);
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end("OK");
    } catch (e) {
      res.writeHead(400).end("Invalid JSON");
    }
  });
}

// 실시간 스트리밍 처리
function handleStream(req, res) {
  if (!currentSource) {
    res.writeHead(400).end("No source configured");
    return;
  }

  res.writeHead(200, {
    "Content-Type": "video/mp4",
    "Transfer-Encoding": "chunked",
    "Cache-Control": "no-cache",
  });

  const inputSpec =
    currentSource.type === "file" ? currentSource.path : currentSource.url;

  // ffmpeg를 사용하여 입력받은 소스를 무한 실시간 스트리밍 처리
  function spawnLoopFMP4() {
    const ff = spawn("ffmpeg", [
      "-re",
      "-stream_loop",
      "-1",
      "-i",
      inputSpec,
      "-c:v",
      "libx264",
      "-preset",
      "ultrafast",
      "-tune",
      "zerolatency",
      "-g",
      "30",
      "-bf",
      "0",
      "-f",
      "mp4",
      "-movflags",
      "frag_keyframe+empty_moov+default_base_moof",
      "pipe:1",
    ]);
    ff.stdout.pipe(res, { end: false }); // 클라이언트에 스트리밍
    ff.stderr.setEncoding("utf8");
    ff.stderr.on("data", (chunk) => console.error("ffmpeg:", chunk));
    ff.on("exit", () => {
      if (!res.writableEnded) spawnLoopFMP4(); // 끊기지 않도록 재시작
    });
    req.on("close", () => {
      ff.kill("SIGINT");
    });
  }

  spawnLoopFMP4();
}

// http 서버 생성
const server = http.createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "PUT" && req.url === "/upload")
    return handleUpload(req, res);
  if (req.method === "POST" && req.url === "/set-url")
    return handleSetUrl(req, res);
  if (req.method === "GET" && req.url === "/stream")
    return handleStream(req, res);
  serveStatic(req, res);
});

// 서버 시작
const PORT = 8080;
server.listen(PORT, () =>
  console.log(`Server running on http://localhost:${PORT}`)
);
