import { describe, expect, it } from "vitest";
import {
  DiaboloGame,
  MOVES,
  START_BPM,
  MAX_BPM,
  WINDOW,
  ROUND_SECONDS,
  bpmForTime,
  beatInterval,
  judgeBeat,
  spawnBeat,
  levelForBpm,
} from "./game.js";

describe("bpmForTime / beatInterval", () => {
  it("starts at START_BPM", () => {
    expect(bpmForTime(0)).toBe(START_BPM);
  });

  it("increases with time and never exceeds MAX_BPM", () => {
    expect(bpmForTime(0)).toBeLessThan(bpmForTime(20));
    expect(bpmForTime(1000)).toBe(MAX_BPM);
  });

  it("beat interval scales inversely with bpm", () => {
    const fast = beatInterval(150);
    const slow = beatInterval(66);
    expect(fast).toBeLessThan(slow);
  });
});

describe("judgeBeat", () => {
  it("perfect within tight window", () => {
    expect(judgeBeat(1.0, 1.0)).toBe("perfect");
  });

  it("good within window but not tight", () => {
    expect(judgeBeat(1.0, 1.0 + WINDOW * 0.5)).toBe("good");
  });

  it("miss after window closes", () => {
    expect(judgeBeat(1.0, 1.0 + WINDOW + 0.1)).toBe("miss");
  });

  it("early before beat", () => {
    expect(judgeBeat(1.0, 1.0 - WINDOW - 0.1)).toBe("early");
  });
});

describe("spawnBeat", () => {
  it("produces a valid move at the expected time", () => {
    const b = spawnBeat(5, 90);
    expect(MOVES).toContain(b.move);
    expect(b.at).toBeCloseTo(5 + 60 / 90, 5);
  });
});

describe("DiaboloGame flow", () => {
  it("starts with a pending beat and playing status", () => {
    const g = new DiaboloGame();
    g.start();
    expect(g.status).toBe("playing");
    expect(g.beats.length).toBeGreaterThanOrEqual(1);
  });

  it("correct move on a beat builds combo and score", () => {
    const g = new DiaboloGame();
    g.start();
    g.beats = [{ at: 1.0, move: "toss" }];
    g.update(1.0); // elapsed = 1.0
    const events = g.input(g.beats[0].move);
    expect(events[0].result).not.toBe("miss");
    expect(g.combo).toBe(1);
    expect(g.score).toBeGreaterThan(0);
  });

  it("wrong move breaks combo", () => {
    const g = new DiaboloGame();
    g.start();
    g.beats = [{ at: 1.0, move: "toss" }];
    g.update(1.0);
    g.input("jerk");
    expect(g.combo).toBe(0);
    expect(g.totalMiss).toBe(1);
  });

  it("unmatched beat expires as a miss", () => {
    const g = new DiaboloGame();
    g.start();
    g.beats = [{ at: 0.01, move: "toss" }];
    const events = g.checkExpired(); // 尚未過期
    expect(events).toHaveLength(0);
    g.elapsed = 0.01 + WINDOW + 0.05;
    const expired = g.checkExpired();
    expect(expired).toHaveLength(1);
    expect(expired[0].result).toBe("miss");
    expect(g.totalMiss).toBe(1);
    expect(g.combo).toBe(0);
  });

  it("a streak of 10 grants a bonus", () => {
    const g = new DiaboloGame();
    g.start();
    g.combo = 9;
    g.beats = [{ at: 1.0, move: "toss" }];
    g.update(1.0);
    const before = g.score;
    g.input("toss");
    expect(g.combo).toBe(10);
    // perfect(15) + bonus(25)
    expect(g.score).toBe(before + 15 + 25);
  });

  it("game ends after ROUND_SECONDS", () => {
    const g = new DiaboloGame();
    g.start();
    g.update(ROUND_SECONDS + 1);
    expect(g.status).toBe("over");
  });
});

describe("levelForBpm", () => {
  it("maps higher bpm to higher level", () => {
    expect(levelForBpm(START_BPM)).toBe(0);
    expect(levelForBpm(MAX_BPM)).toBeGreaterThan(levelForBpm(START_BPM));
  });
});