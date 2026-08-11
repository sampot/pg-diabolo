/**
 * 扯鈴 — Web Audio 合成音效（節拍、命中、combo、遺漏、結算）。
 */

export class DiaboloAudio {
  constructor() {
    /** @type {AudioContext | null} */
    this.ctx = null;
    this.enabled = true;
    this.master = 0.2;
  }

  async unlock() {
    this.ensure();
    if (this.ctx?.state === "suspended") await this.ctx.resume();
  }

  ensure() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) this.ctx = new AC();
    }
  }

  setEnabled(on) {
    this.enabled = on;
  }

  /**
   * @param {number} freq
   * @param {number} dur
   * @param {OscillatorType} [type]
   * @param {number} [gain]
   * @param {number} [when]
   */
  tone(freq, dur, type = "sine", gain = 0.1, when = 0) {
    if (!this.enabled) return;
    this.ensure();
    const ctx = this.ctx;
    if (!ctx) return;
    const t0 = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain * this.master, t0 + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + Math.max(0.025, dur));
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.04);
  }

  /** 節拍提示（每拍輕點） */
  metronome() {
    this.tone(880, 0.03, "sine", 0.05);
  }

  /** 動作成功（抖／拋／接） */
  hit() {
    this.tone(523, 0.07, "triangle", 0.09);
    this.tone(784, 0.09, "sine", 0.07, 0.05);
  }

  /** perfect */
  perfect() {
    this.tone(659, 0.08, "triangle", 0.1);
    this.tone(880, 0.09, "triangle", 0.09, 0.06);
    this.tone(1109, 0.12, "sine", 0.07, 0.12);
  }

  /** miss / 漏拍 */
  miss() {
    this.tone(200, 0.12, "sawtooth", 0.05);
    this.tone(140, 0.16, "sine", 0.05, 0.06);
  }

  /** 連招里程碑（每 10 combo） */
  comboMilestone() {
    this.tone(523, 0.08, "triangle", 0.09);
    this.tone(659, 0.08, "triangle", 0.09, 0.07);
    this.tone(784, 0.08, "triangle", 0.09, 0.14);
    this.tone(1047, 0.16, "sine", 0.08, 0.21);
  }

  /** 開始 */
  startBeep() {
    this.tone(440, 0.06, "triangle", 0.08);
    this.tone(554, 0.08, "triangle", 0.08, 0.06);
  }

  /** 結算 */
  over() {
    this.tone(392, 0.12, "triangle", 0.08);
    this.tone(523, 0.14, "triangle", 0.08, 0.1);
    this.tone(659, 0.2, "sine", 0.07, 0.2);
  }
}