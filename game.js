/**
 * 扯鈴 — 節奏連招：兩根棒＋繩＋鈴。
 * 螢幕出現節拍點，玩家在拍點按對應鍵／鈕觸發「抖鈴／拋鈴／接鈴」連招，
 * 節奏正確累加 combo，miss 斷 combo。難度隨時間提升（拍速加快）。
 * 純函式規則邏輯（不碰 DOM），可單元測試。
 */

export const MOVES = ["toss", "jerk", "catch"];
export const START_BPM = 66;
export const MAX_BPM = 156;
export const BPM_ACCEL = 0.22; // bpm / 秒
export const WINDOW = 0.16; // 判定窗 ±0.16s
export const ROUND_SECONDS = 45;
export const POINTS_HIT = 10;
export const POINTS_BONUS = 25;

const BPM_BANDS = [
  { min: 0, max: 5, bpm: 66 },
  { min: 5, max: 10, bpm: 74 },
  { min: 10, max: 15, bpm: 82 },
  { min: 15, max: 20, bpm: 90 },
  { min: 20, max: 25, bpm: 98 },
  { min: 25, max: 30, bpm: 108 },
  { min: 30, max: 35, bpm: 120 },
  { min: 35, max: 40, bpm: 134 },
  { min: 40, max: 45, bpm: 150 },
];

/** 依已進行秒數回傳目標拍速。 */
export function bpmForTime(t) {
  let bpm = START_BPM + t * BPM_ACCEL;
  for (const band of BPM_BANDS) {
    if (t >= band.min && t < band.max) bpm = band.bpm;
  }
  return Math.min(MAX_BPM, Math.max(START_BPM, bpm));
}

/** 每拍間隔秒數。 */
export function beatInterval(bpm) {
  return 60 / bpm;
}

/** 以拍速與時距產生下一個節拍點。 */
export function spawnBeat(now, bpm) {
  return {
    at: now + beatInterval(bpm),
    move: MOVES[Math.floor(Math.random() * MOVES.length)],
  };
}

/**
 * 依輸入時間與節拍時間判定結果。
 * @param {number} at 節拍時間
 * @param {number} now 輸入時間
 * @returns {'perfect' | 'good' | 'miss' | 'early'}
 */
export function judgeBeat(at, now) {
  const diff = now - at;
  if (Math.abs(diff) > WINDOW) return diff < 0 ? "early" : "miss";
  if (Math.abs(diff) <= WINDOW * 0.35) return "perfect";
  return "good";
}

/** 難度等級（依 bpm）：0 開始。 */
export function levelForBpm(bpm) {
  return Math.min(4, Math.floor((bpm - START_BPM) / 18));
}

export class DiaboloGame {
  constructor() {
    this.reset();
  }

  reset() {
    this.status = /** @type {'ready' | 'playing' | 'over'} */ ("ready");
    this.score = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.totalHit = 0;
    this.totalMiss = 0;
    this.perfects = 0;
    this.goods = 0;
    this.elapsed = 0;
    this.bpm = START_BPM;
    this.level = 0;
    /** @type {Array<{ at: number, move: string, judged?: boolean, result?: string }>} */
    this.beats = [];
    /** @type {string | null} 目前待處理的動作輸入 */
    this.pendingInput = null;
  }

  start() {
    this.reset();
    this.status = "playing";
    this.bpm = bpmForTime(0);
    this.spawnInitialBeat();
  }

  /** 開局預先放一個節拍點。 */
  spawnInitialBeat() {
    this.beats = [spawnBeat(0, this.bpm)];
  }

  /**
   * 玩家輸入一個動作。
   * @param {string} move
   * @returns {Array<{ at: number, move: string, result: string }>} 被判定／過期的節拍
   */
  input(move) {
    const judged = [];
    if (this.status !== "playing") return judged;
    this.pendingInput = move;

    // 找出最近的未判定節拍
    let nearest = null;
    let nearestDiff = Infinity;
    for (const b of this.beats) {
      if (b.judged) continue;
      const diff = Math.abs(this.elapsed - b.at);
      if (diff < nearestDiff) {
        nearestDiff = diff;
        nearest = b;
      }
    }
    if (!nearest) return judged;

    // 若該節拍早已超過判定窗 → 先記 miss
    if (nearest.at < this.elapsed - WINDOW) {
      this.markBeat(nearest, "miss");
      judged.push({ at: nearest.at, move: nearest.move, result: "miss" });
      this.pendingInput = null;
      return judged;
    }

    // 檢查動作種類：後續節拍（在同一判定窗內）也可能被此輸入觸發
    for (const b of [...this.beats]) {
      if (b.judged) continue;
      const r = judgeBeat(b.at, this.elapsed);
      if (r === "early") continue;
      if (Math.abs(this.elapsed - b.at) <= WINDOW) {
        const matched = b.move === move;
        this.markBeat(b, matched ? r : "miss");
        judged.push({ at: b.at, move: b.move, result: matched ? r : "miss" });
        break;
      }
    }

    this.pendingInput = null;
    return judged;
  }

  /**
   * @param {import('./game.js').DiaboloGame} g
   */
  markBeat(beat, result) {
    if (beat.judged) return;
    beat.judged = true;
    beat.result = result;
    if (result === "perfect" || result === "good") {
      this.combo += 1;
      this.maxCombo = Math.max(this.maxCombo, this.combo);
      this.totalHit += 1;
      const pts = result === "perfect" ? POINTS_HIT + 5 : POINTS_HIT;
      this.score += pts;
      if (this.combo > 0 && this.combo % 10 === 0) this.score += POINTS_BONUS;
      if (result === "perfect") this.perfects += 1;
      else this.goods += 1;
    } else {
      this.combo = 0;
      this.totalMiss += 1;
    }
  }

  /** 檢查是否有節拍已過期（漏拍）。 */
  checkExpired() {
    const expired = [];
    for (const b of this.beats) {
      if (!b.judged && this.elapsed > b.at + WINDOW) {
        this.markBeat(b, "miss");
        expired.push({ at: b.at, move: b.move, result: "miss" });
      }
    }
    return expired;
  }

  /**
   * @param {number} dt 秒
   * @returns {Array<{ at: number, move: string, result: string }>}
   */
  update(dt) {
    const events = [];
    if (this.status !== "playing") return events;

    this.elapsed += dt;
    this.bpm = bpmForTime(this.elapsed);
    this.level = levelForBpm(this.bpm);

    // 生成下一個節拍點：最後一個節拍已進入判定窗後就補拍
    const last = this.beats[this.beats.length - 1];
    if (!last || this.elapsed >= last.at - WINDOW) {
      this.beats.push(spawnBeat(this.elapsed, this.bpm));
    }

    events.push(...this.checkExpired());

    if (this.elapsed >= ROUND_SECONDS) {
      this.status = "over";
      events.push({ at: 0, move: "", result: "end" });
    }
    return events;
  }
}