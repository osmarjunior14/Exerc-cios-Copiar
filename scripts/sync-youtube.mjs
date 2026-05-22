import { writeFile } from "node:fs/promises";

const channelUrl = process.argv[2] || "https://www.youtube.com/@fifteensecondsforfit/videos";
const outputPath = new URL("../data/exercises.json", import.meta.url);

function extractJsonAfter(html, marker) {
  const start = html.indexOf(marker);
  if (start === -1) return null;
  const jsonStart = start + marker.length;
  const end = html.indexOf(";</script>", jsonStart);
  return JSON.parse(html.slice(jsonStart, end));
}

function uniqueByVideoId(items) {
  const seen = new Set();
  return items.filter((item) => {
    if (!item.videoId || seen.has(item.videoId)) return false;
    seen.add(item.videoId);
    return true;
  });
}

function inferGroup(title = "") {
  const text = title.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
  if (/(AGACHAMENTO|CADEIRA|AFUNDO|PANTURRILHA|TORNOZELO|ESTEIRA|PELVICA|COXA|GLUTEO)/.test(text)) return "Pernas e glúteos";
  if (/(SUPINO|CRUCIFIXO|PEITORAL|FLEXAO)/.test(text)) return "Peito";
  if (/(REMADA|PUXADA|PULLOVER|DORSAL)/.test(text)) return "Costas";
  if (/(ELEVACAO|DESENVOLVIMENTO|OMBRO|ARNOLD)/.test(text)) return "Ombros";
  if (/(ROSCA|BICEPS)/.test(text)) return "Bíceps";
  if (/(TRICEPS|FRANCES|TESTA)/.test(text)) return "Tríceps";
  if (/(ABDOMINAL|PRANCHA|CORE)/.test(text)) return "Core";
  if (/(MOBILIDADE|ALONGAMENTO)/.test(text)) return "Mobilidade";
  return "Fifteen Seconds for Fit";
}

function findVideos(payload) {
  const found = [];
  function walk(value) {
    if (!value || typeof value !== "object") return;
    const lockup = value.lockupViewModel;
    const renderer = value.videoRenderer || value.gridVideoRenderer || value.richItemRenderer?.content?.videoRenderer;
    if (lockup) {
      const videoId = lockup.contentId || lockup.rendererContext?.commandContext?.onTap?.innertubeCommand?.watchEndpoint?.videoId;
      const name = lockup.metadata?.lockupMetadataViewModel?.title?.content;
      if (videoId && name) found.push({ videoId, name });
    }
    if (renderer?.videoId) {
      const name = renderer.title?.runs?.[0]?.text || renderer.title?.simpleText;
      if (name) found.push({ videoId: renderer.videoId, name });
    }
    Object.values(value).forEach(walk);
  }
  walk(payload);
  return found;
}

function findContinuation(payload) {
  const tokens = [];
  function walk(value) {
    if (!value || typeof value !== "object") return;
    if (value.continuationCommand?.token) tokens.push(value.continuationCommand.token);
    Object.values(value).forEach(walk);
  }
  walk(payload);
  return tokens.sort((a, b) => b.length - a.length)[0];
}

const response = await fetch(channelUrl, {
  headers: {
    "accept-language": "pt-BR,pt;q=0.9,en;q=0.8",
    "user-agent": "Mozilla/5.0 AppDeTreinoSync/1.0"
  }
});

if (!response.ok) {
  throw new Error(`YouTube respondeu com HTTP ${response.status}`);
}

const html = await response.text();
const initialData = extractJsonAfter(html, "var ytInitialData = ");
const apiKey = html.match(/"INNERTUBE_API_KEY":"([^"]+)/)?.[1];
const clientVersion = html.match(/"INNERTUBE_CLIENT_VERSION":"([^"]+)/)?.[1] || "2.20260521.00.00";
const videos = findVideos(initialData);
let continuation = findContinuation(initialData);

for (let page = 0; continuation && apiKey && page < 25; page += 1) {
  const next = await fetch(`https://www.youtube.com/youtubei/v1/browse?key=${apiKey}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "user-agent": "Mozilla/5.0 AppDeTreinoSync/1.0"
    },
    body: JSON.stringify({
      context: {
        client: {
          clientName: "WEB",
          clientVersion,
          hl: "pt",
          gl: "BR"
        }
      },
      continuation
    })
  });
  if (!next.ok) break;
  const payload = await next.json();
  const newVideos = findVideos(payload);
  if (newVideos.length === 0) break;
  videos.push(...newVideos);
  continuation = findContinuation(payload);
}

const exercises = uniqueByVideoId(videos).map((item) => ({
  name: item.name,
  group: inferGroup(item.name),
  videoUrl: `https://www.youtube.com/watch?v=${item.videoId}`
}));

if (exercises.length === 0) {
  throw new Error("Nenhum vídeo encontrado. O layout do YouTube pode ter mudado ou a página exigiu consentimento.");
}

await writeFile(outputPath, `${JSON.stringify(exercises, null, 2)}\n`);
console.log(`Sincronizados ${exercises.length} vídeos em ${outputPath.pathname}`);
