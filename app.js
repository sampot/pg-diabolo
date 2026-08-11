import { DiaboloAudio } from "./audio.js";
import {
  DiaboloGame,
  WINDOW,
  ROUND_SECONDS,
} from "./game.js";

const BEST_KEY = "pg-diabolo-best";
const audio = new DiaboloAudio();
const game = new DiaboloGame();
globalThis.__diabolo = game;

const canvas = document.getElementById("game");
const ctx = /** @type {HTMLCanvasElement} */ (canvas).getContext("2d");
const W = 360;
const H = 480;
canvas.width = W;
canvas.height = H;

const scoreEl = document.getElementById("score");
const comboEl = document.getElementById("combo");
const bestEl = document.getElementById("best");
const levelEl = document.getElementById("level");
const statusEl = document.getElementById("status");
const btnStart = document.getElementById("btn-start");
const btnMute = document.getElementById("btn-mute");
const btnJerk = document.getElementById("btn-jerk");
const btnToss = document.getElementById("btn-toss");
const btnCatch = document.getElementById("btn-catch");

const MOVE_LABEL = { jerk: "抖鈴", toss: "拋鈴", catch: "接鈴" };
const MOVE_KEY = { jerk: ["j", "J"], toss: ["k", "K"], catch: ["l", "L"] };

const TARGET_X = 58; // 判定線
const TRAVEL = W - 90; // 節拍移動距離

let lastTs = 0;
let running = true;
let bestScore = 0;
let bestLoaded = false;
let levelFlash = 0;

function loadBestLocal() {
  const v = Number(localStorage.getItem(BEST_KEY) || "0");
  return Number.isFinite(v) ? v : 0;
}
function saveBestLocal(n) {
  try {
    localStorage.setItem(BEST_KEY, String(n));
  } catch {
    /* ignore */
  }
}

async function loadBestKv() {
  try {
    const res = await fetch(`/api/kv/${BEST_KEY}`);
    if (!res.ok) return;
    const data = await res.json();
    const v = Number(data?.value);
    if (Number.isFinite(v) && v >= 0) bestScore = v;
  } catch {
    /* ignore */
  }
  bestLoaded = true;
  syncHud();
}

async function saveBestKv(n) {
  try {
    await fetch(`/api/kv/${BEST_KEY}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value: n }),
    });
  } catch {
    /* ignore */
  }
}

function setStatus(msg, tone = "") {
  statusEl.textContent = msg;
  statusEl.dataset.tone = tone;
}

function syncHud() {
  scoreEl.textContent = String(game.score);
  comboEl.textContent = `x${game.combo}`;
  bestEl.textContent = String(bestScore);
  levelEl.textContent = `難度 ${game.level + 1}`;

  if (game.status === "ready") {
    btnStart.textContent = "開局";
    btnStart.disabled = false;
  } else if (game.status === "playing") {
    btnStart.textContent = "進行中";
    btnStart.disabled = true;
  } else {
    btnStart.textContent = "再來一局";
    btnStart.disabled = false;
  }
}

function roundRect(c, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  c.beginPath();
  c.moveTo(x + rr, y);
  c.arcTo(x + w, y, x + w, y + h, rr);
  c.arcTo(x + w, y + h, x, y + h, rr);
  c.arcTo(x, y + h, x, y, rr);
  c.arcTo(x, y, x + w, y, rr);
  c.closePath();
}

function drawSticks(progress) {
  // 兩根棒＋繩＋鈴的象徵圖（隨節拍擺動）
  const bob = Math.sin((game.elapsed * game.bpm) / 60 * Math.PI * 2) * 6;
  const cx = W / 2;
  const cy = H * 0.3;
  const sway = progress * 10;

  // 鈴
  ctx.save();
  ctx.translate(cx, cy + bob * 0.3);
  ctx.rotate(Math.sin(progress * Math.PI * 2) * 0.2);
  ctx.beginPath();
  ctx.arc(0, 0, 26, 0, Math.PI * 2);
  const g = ctx.createRadialGradient(-8, -8, 2, 0, 0, 26);
  g.addColorStop(0, "#fde047");
  g.addColorStop(0.6, "#eab308");
  g.addColorStop(1, "#a16207");
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = "#713f12";
  ctx.lineWidth = 2;
  ctx.stroke();
  // 鈴腰線
  ctx.beginPath();
  ctx.ellipse(0, 0, 26, 8, 0, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(113,63,18,0.5)";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();

  // 兩根棒
  ctx.strokeStyle = "#b45309";
  ctx.lineWidth = 6;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(cx - 70, cy + 40 + bob);
  ctx.lineTo(cx - 20 + sway, cy - 20 - bob);
  ctx.moveTo(cx + 70, cy + 40 - bob);
  ctx.lineTo(cx + 20 - sway, cy - 20 + bob);
  ctx.stroke();

  // 棒頭
  ctx.fillStyle = "#f59e0b";
  ctx.beginPath();
  ctx.arc(cx - 70, cy + 40 + bob, 5, 0, Math.PI * 2);
  ctx.arc(cx + 70, cy + 40 - bob, 5, 0, Math.PI * 2);
  ctx.fill();
}

function drawBeat(b, elapsed) {
  // 節拍位置：at 時間越近越靠近判定線
  const diff = b.at - elapsed;
  const x = TARGET_X + (diff / (WINDOW * 3)) * TRAVEL;
  if (x > W + 20 || x < -20) return;
  const near = Math.abs(diff) <= WINDOW;

  const pal = MOVE_LABEL[b.move] === "抖鈴" ? "#f87171" : "#60a5fa";
  const col = b.move === "catch" ? "#a3e635" : pal;

  if (b.judged && b.result && b.result !== "miss") {
    // 已命中：顯示成功標記
    ctx.fillStyle = b.result === "perfect" ? "#fde047" : "#4ade80";
    ctx.font = "700 16px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(b.result === "perfect" ? "PERFECT" : "GOOD", x, H * 0.62);
  }

  const pulse = near ? 1.2 : 1;
  ctx.fillStyle = col;
  ctx.globalAlpha = b.judged && b.result === "miss" ? 0.25 : 1;
  ctx.beginPath();
  ctx.arc(x, H * 0.5, 16 * pulse, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  ctx.fillStyle = "#1e1b16";
  ctx.font = "700 12px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(MOVE_LABEL[b.move], x, H * 0.5);
}

function drawTimeline() {
  // 判定線
  ctx.strokeStyle = "rgba(253,224,71,0.9)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(TARGET_X, H * 0.34);
  ctx.lineTo(TARGET_X, H * 0.66);
  ctx.stroke();

  const label = {
    toss: "抖鈴",
    jerk: "拋鈴",
    catch: "接鈴",
  };

  // 時間行
  ctx.strokeStyle = "rgba(255,255,255,0.12)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(TARGET_X, H * 0.5);
  ctx.lineTo(W - 20, H * 0.5);
  ctx.stroke();

  for (const b of game.beats) {
    drawBeat(b, game.elapsed);
  }

  // 剩餘時間
  const remain = Math.max(0, ROUND_SECONDS - game.elapsed);
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.font = "700 14px system-ui, sans-serif";
  ctx.textAlign = "right";
  ctx.textBaseline = "top";
  ctx.fillText(`${Math.ceil(remain)}s`, W - 14, 14);
}

function drawBanner(msg) {
  ctx.fillStyle = "rgba(15,23,42,0.8)";
  roundRect(ctx, 24, H / 2 - 34, W - 48, 68, 12);
  ctx.fill();
  ctx.fillStyle = "#e2e8f0";
  ctx.font = "700 15px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(msg, W / 2, H / 2 - 8);
  ctx.font = "500 12px system-ui, sans-serif";
  ctx.fillStyle = "#94a3b8";
  ctx.fillText(`最高 combo ${game.maxCombo}`, W / 2, H / 2 + 14);
}

function draw() {
  ctx.clearRect(0, 0, W, H);
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#1c1420");
  bg.addColorStop(1, "#0d0a12");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // 背景光暈隨難度
  const glow = game.level / 4;
  ctx.fillStyle = `rgba(217,70,239,${0.05 + glow * 0.05})`;
  ctx.beginPath();
  ctx.arc(W / 2, H * 0.3, 120, 0, Math.PI * 2);
  ctx.fill();

  drawSticks(0);
  drawTimeline();

  if (game.status === "ready") {
    drawBanner("點開局 · 在拍點按對應動作");
  } else if (game.status === "over") {
    drawBanner(`分數 ${game.score}`);
  }
}

function handleEvents(events) {
  for (const e of events) {
    if (e.result === "perfect") {
      audio.perfect();
      setStatus("上上！PERFECT", "win");
    } else if (e.result === "good") {
      audio.hit();
      setStatus("接中！", "win");
    } else if (e.result === "miss") {
      audio.miss();
      setStatus("漏拍或動作不符…", "warn");
    } else if (e.result === "end") {
      audio.over();
      maybeRecordBest();
      setStatus(`結束！分數 ${game.score} · 最高 combo ${game.maxCombo}`, "");
    }
  }
}

function maybeRecordBest() {
  if (game.score > bestScore) {
    bestScore = game.score;
    saveBestLocal(bestScore);
    void saveBestKv(bestScore);
  }
}

function frame(ts) {
  if (!running) return;
  const dt = Math.min(0.05, (ts - lastTs) / 1000) || 0.016;
  lastTs = ts;

  const events = game.update(dt);
  if (events.length) handleEvents(events);

  if (game.status === "playing" && game.elapsed > 0) {
    if (Math.random() < 0.02) audio.metronome();
    if (game.combo > 0 && game.combo % 10 === 0 && levelFlash <= 0) {
      audio.comboMilestone();
      levelFlash = 0.5;
    }
  }
  if (levelFlash > 0) levelFlash = Math.max(0, levelFlash - dt);

  draw();
  syncHud();
  requestAnimationFrame(frame);
}

async function tryStart() {
  await audio.unlock();
  game.start();
  audio.startBeep();
  setStatus("跟節拍輸入動作！");
  syncHud();
}

function doInput(move) {
  if (game.status !== "playing") return;
  const events = game.input(move);
  handleEvents(events);
}

btnStart.addEventListener("click", () => void tryStart());

btnMute.addEventListener("click", async () => {
  await audio.unlock();
  audio.setEnabled(!audio.enabled);
  btnMute.textContent = audio.enabled ? "音效開" : "音效關";
  btnMute.setAttribute("aria-pressed", audio.enabled ? "true" : "false");
});

btnJerk.addEventListener("click", () => doInput("jerk"));
btnToss.addEventListener("click", () => doInput("toss"));
btnCatch.addEventListener("click", () => doInput("catch"));

window.addEventListener("keydown", (e) => {
  if (game.status !== "playing") {
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      void tryStart();
    }
    return;
  }
  for (const [move, keys] of Object.entries(MOVE_KEY)) {
    if (keys.includes(e.key)) {
      e.preventDefault();
      doInput(move);
      return;
    }
  }
});

document.body.addEventListener(
  "pointerdown",
  () => void audio.unlock(),
  { once: true },
);

bestScore = loadBestLocal();
setStatus("點開局 · 抖鈴／拋鈴／接鈴");
syncHud();
void loadBestKv();
requestAnimationFrame((ts) => {
  lastTs = ts;
  requestAnimationFrame(frame);
});