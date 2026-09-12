import { describe, expect, it } from "vitest";
import { DEFAULT_CALENDAR } from "@/lib/domain/sla-calendar";
import { DEFAULT_SLA_TARGETS, badge, elapsedMs, extend, isAtRisk, isBreached, newTimer, pause, remainingMs, restartFromRemaining, resume, stop, tick, timerState } from "@/lib/domain/sla-timers";

const cal = DEFAULT_CALENDAR;
const t0 = new Date("2026-09-12T10:00:00Z");
const min = (n: number) => new Date(t0.getTime() + n * 60_000);

describe("SLA timers (requirements §6)", () => {
  it("P1 first response 30 min, resolution 4 h, 24×7", () => {
    const fr = newTimer("first_response", "p1", "incident", DEFAULT_SLA_TARGETS, cal, t0)!;
    const res = newTimer("resolution", "p1", "incident", DEFAULT_SLA_TARGETS, cal, t0)!;
    expect(fr.targetMinutes).toBe(30);
    expect(fr.dueAt).toEqual(min(30));
    expect(res.targetMinutes).toBe(240);
    expect(res.calendar).toBe("24x7");
  });
  it("project enquiries have no resolution target", () => {
    expect(newTimer("resolution", "p3", "project_enquiry", DEFAULT_SLA_TARGETS, cal, t0)).toBeNull();
    expect(newTimer("first_response", "p3", "project_enquiry", DEFAULT_SLA_TARGETS, cal, t0)).not.toBeNull();
  });
  it("P3/P4 use the business calendar", () => {
    const fr = newTimer("first_response", "p3", "incident", DEFAULT_SLA_TARGETS, cal, t0)!; // Sat 15:30 Colombo
    expect(fr.calendar).toBe("business");
    expect(fr.dueAt.getTime()).toBeGreaterThan(t0.getTime() + 24 * 3600_000);
  });

  describe("golden path 3: P1 breach", () => {
    const fr = newTimer("first_response", "p1", "incident", DEFAULT_SLA_TARGETS, cal, t0)!;
    it("at-risk at 75 % (22.5 min), breached at 30 min, keeps counting overtime", () => {
      expect(isAtRisk(fr, min(20), cal)).toBe(false);
      expect(isAtRisk(fr, min(23), cal)).toBe(true);
      expect(isBreached(fr, min(23), cal)).toBe(false);
      expect(isBreached(fr, min(30), cal)).toBe(true);
      expect(timerState(fr, min(31), cal)).toBe("breached");
      expect(remainingMs(fr, min(40), cal)).toBe(-10 * 60_000);
      expect(elapsedMs(fr, min(40), cal)).toBe(40 * 60_000);
    });
    it("tick emits at-risk once, then breach once", () => {
      const r1 = tick(fr, min(23), cal);
      expect(r1.nowAtRisk).toBe(true);
      expect(r1.nowBreached).toBe(false);
      const r2 = tick(r1.timer, min(25), cal);
      expect(r2.nowAtRisk).toBe(false);
      const r3 = tick(r2.timer, min(31), cal);
      expect(r3.nowBreached).toBe(true);
      expect(r3.timer.breachedAt).toEqual(min(31));
      const r4 = tick(r3.timer, min(45), cal);
      expect(r4.nowBreached).toBe(false);
    });
    it("stopping after breach records met_late with overtime", () => {
      const breached = tick(fr, min(31), cal).timer;
      const stopped = stop(breached, min(45), cal);
      expect(stopped.metAt).toEqual(min(45));
      expect(stopped.breachedAt).toEqual(min(31));
      expect(timerState(stopped, min(60), cal)).toBe("met_late");
      expect(elapsedMs(stopped, min(999), cal)).toBe(45 * 60_000);
    });
    it("stop before breach = met; stop exactly at target = breached", () => {
      expect(timerState(stop(fr, min(10), cal), min(99), cal)).toBe("met");
      expect(stop(fr, min(30), cal).breachedAt).toEqual(min(30));
    });
  });

  describe("pause / resume (pending_client, on_hold)", () => {
    const res = newTimer("resolution", "p2", "incident", DEFAULT_SLA_TARGETS, cal, t0)!; // 1440 min
    it("pausing freezes elapsed; resuming re-targets from remaining", () => {
      const paused = pause(res, min(60), cal);
      expect(paused.elapsedMs).toBe(60 * 60_000);
      expect(timerState(paused, min(500), cal)).toBe("paused");
      expect(elapsedMs(paused, min(500), cal)).toBe(60 * 60_000);
      const resumed = resume(paused, min(500), cal);
      expect(resumed.pausedAt).toBeNull();
      expect(resumed.startedAt).toEqual(min(500));
      expect(resumed.dueAt).toEqual(min(500 + 1380));
      expect(elapsedMs(resumed, min(560), cal)).toBe(120 * 60_000);
    });
    it("pause/resume are idempotent", () => {
      expect(pause(pause(res, min(1), cal), min(2), cal).pausedAt).toEqual(min(1));
      expect(resume(res, min(1), cal)).toBe(res);
      const stopped = stop(res, min(5), cal);
      expect(pause(stopped, min(6), cal)).toBe(stopped);
      expect(stop(stopped, min(7), cal)).toBe(stopped);
    });
    it("at-risk is never flagged while paused", () => {
      const paused = pause(res, min(1200), cal);
      expect(isAtRisk(paused, min(5000), cal)).toBe(false);
      expect(tick(paused, min(5000), cal)).toMatchObject({ nowAtRisk: false, nowBreached: false });
    });
  });

  it("reopen restarts the resolution clock from remaining time (Jira behaviour)", () => {
    const res = newTimer("resolution", "p1", "incident", DEFAULT_SLA_TARGETS, cal, t0)!; // 240
    const stopped = stop(res, min(100), cal);
    const reopened = restartFromRemaining(stopped, min(1000), cal);
    expect(reopened.metAt).toBeNull();
    expect(reopened.dueAt).toEqual(min(1000 + 140));
    expect(remainingMs(reopened, min(1000), cal)).toBe(140 * 60_000);
  });

  it("lead extension adds to the target and re-targets due", () => {
    const res = newTimer("resolution", "p1", "incident", DEFAULT_SLA_TARGETS, cal, t0)!;
    const ext = extend(res, 60, min(30), cal);
    expect(ext.targetMinutes).toBe(300);
    expect(ext.dueAt).toEqual(min(30 + 270));
    const b = badge(ext, min(30), cal);
    expect(b.state).toBe("running");
    expect(b.ratio).toBeCloseTo(0.1, 2);
  });

  it("business-calendar timers only count working time", () => {
    // Monday 09:00 Colombo = 03:30Z
    const monday = new Date("2026-09-14T03:30:00Z");
    const fr = newTimer("first_response", "p3", "incident", DEFAULT_SLA_TARGETS, cal, monday)!; // 480 business min
    expect(fr.dueAt).toEqual(new Date("2026-09-14T11:30:00Z")); // 17:00 Colombo
    expect(elapsedMs(fr, new Date("2026-09-14T20:00:00Z"), cal)).toBe(480 * 60_000); // after hours: capped
    expect(isBreached(fr, new Date("2026-09-14T20:00:00Z"), cal)).toBe(true);
  });
});
