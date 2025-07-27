// public/main.js

const fileInput = document.getElementById("file-input");
const urlInput = document.getElementById("url-input");
const btnUrl = document.getElementById("btn-url");
const video = document.getElementById("video");
const latencyEl = document.getElementById("latency");

let currentObjectURL = null;

// 플레이어 초기화
function resetPlayer() {
  if (currentObjectURL) {
    URL.revokeObjectURL(currentObjectURL);
    currentObjectURL = null;
  }
  // 비디오 소스 초기화
  video.removeAttribute("src");
  video.load();
  latencyEl.textContent = "지연: -- ms";
}

// 스트리밍 시작
function loadStream() {
  resetPlayer();

  const mediaSource = new MediaSource();
  currentObjectURL = URL.createObjectURL(mediaSource);
  video.src = currentObjectURL;
  video.autoplay = true;
  video.muted = true;
  video.playsInline = true;

  mediaSource.addEventListener("sourceopen", onSourceOpen, { once: true });
}

// MediaSource 열렸을 때 처리
async function onSourceOpen() {
  const mediaSource = this; // MediaSource
  const mime = 'video/mp4; codecs="avc1.42E01E, mp4a.40.2"';

  if (!MediaSource.isTypeSupported(mime)) {
    console.error("Unsupported MIME type:", mime);
    return;
  }

  const sb = mediaSource.addSourceBuffer(mime);
  sb.mode = "segments";

  const queue = [];
  let currentItem = null;

  // 버퍼에 청크 추가 완료 이벤트
  // 비디오 지연시간 계산
  sb.addEventListener("updateend", () => {
    if (currentItem) {
      const { t0 } = currentItem;
      if (video.requestVideoFrameCallback) {
        video.requestVideoFrameCallback(() => {
          const latency = performance.now() - t0;
          latencyEl.textContent = `지연: ${latency.toFixed(1)} ms`;
        });
      } else {
        const onTime = () => {
          const latency = performance.now() - t0;
          latencyEl.textContent = `지연: ${latency.toFixed(1)} ms`;
          video.removeEventListener("timeupdate", onTime);
        };
        video.addEventListener("timeupdate", onTime);
      }
      currentItem = null;
    }
    appendNext();
  });

  try {
    const resp = await fetch("/stream");
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const reader = resp.body.getReader();

    // 스트리밍 데이터 수신
    while (true) {
      const { value: chunk, done } = await reader.read();
      if (done) {
        if (mediaSource.readyState === "open") {
          mediaSource.endOfStream();
        }
        break;
      }
      const t0 = performance.now();
      queue.push({ data: chunk, t0 });
      appendNext();
    }
  } catch (err) {
    console.error("Stream fetch error:", err);
  }

  // 다음 청크를 버퍼에 추가
  function appendNext() {
    if (!sb.updating && queue.length > 0) {
      currentItem = queue.shift();
      sb.appendBuffer(currentItem.data);
    }
  }
}

// 1) 로컬 파일 업로드
fileInput.addEventListener("change", async () => {
  const file = fileInput.files[0];
  if (!file) return;
  // 지연시간 초기화
  latencyEl.textContent = "지연: -- ms";

  try {
    await fetch("/upload", {
      method: "PUT",
      body: file,
    });
    loadStream();
  } catch (err) {
    console.error("Upload failed:", err);
  }
});

// 2) URL 설정
btnUrl.addEventListener("click", async () => {
  const url = urlInput.value.trim();
  if (!url) return alert("URL을 입력하세요.");
  latencyEl.textContent = "지연: -- ms";

  try {
    await fetch("/set-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
    loadStream();
  } catch (err) {
    console.error("Set URL failed:", err);
  }
});
