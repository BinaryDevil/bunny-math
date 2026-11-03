import { describe, expect, it } from 'vitest';
import { CARROTS, maxRunCarrots, START_HEARTS, worth } from './carrots';
import {
  answer, BAG_SIZE, canUse, choosePath, current, depthFor, featuresFor, meadowSpec, perfectBonus, perfectEarned,
  pickTreat, practiceFor, preview, showdownSpec, startRun, useTreat, type Outcome, type Run,
} from './run';

/** Answers until the stage kind changes (or `limit` answers), always with the same outcome. */
function playUntilStageChanges(run: Run, outcome: Outcome, limit = 100): Run {
  const kind = run.stage.kind;
  for (let i = 0; i < limit && run.stage.kind === kind; i++) run = answer(run, outcome);
  return run;
}

/** Plays a whole run right first time, taking the first treat and the Sunny path. */
function perfectRun(level: Parameters<typeof startRun>[0]['level'], depth: number, path: 'sunny' | 'tricky' = 'sunny'): Run {
  let run = startRun({ level, seed: 4242, depth });
  for (let i = 0; i < 500 && run.stage.kind !== 'won' && run.stage.kind !== 'lost'; i++) {
    if (run.stage.kind === 'rest') run = pickTreat(run, run.stage.offer[0]);
    else if (run.stage.kind === 'doors') run = choosePath(run, path);
    else run = answer(run, 'first');
  }
  return run;
}

describe('features unlock one per run', () => {
  it('depth from history', () => {
    expect(depthFor(0, 0)).toBe(0);
    expect(depthFor(1, 0)).toBe(1);
    expect(depthFor(2, 0)).toBe(2);
    expect(depthFor(9, 2)).toBe(2);
    expect(depthFor(3, 3)).toBe(3);
  });
  it('features for each depth', () => {
    expect(featuresFor(0)).toEqual({ treats: false, paths: false, rascalHearts: 3 });
    expect(featuresFor(1).treats).toBe(true);
    expect(featuresFor(2).paths).toBe(true);
    expect(featuresFor(3).rascalHearts).toBe(4);
  });
});

describe('a run', () => {
  it('starts in meadow 1 with 3 hearts and 5 questions', () => {
    const run = startRun({ level: 1, seed: 1, depth: 0 });
    expect(run.hearts).toBe(START_HEARTS);
    expect(run.stage.kind).toBe('meadow');
    if (run.stage.kind === 'meadow') expect(run.stage.items).toHaveLength(5);
    // Ease in: the first questions are plain sums.
    expect(current(run)?.q.kind).toBe('type');
  });

  it('is the same for the same seed', () => {
    const a = startRun({ level: 3, seed: 77, depth: 2 });
    const b = startRun({ level: 3, seed: 77, depth: 2 });
    expect(current(a)?.q).toEqual(current(b)?.q);
    expect(current(startRun({ level: 3, seed: 78, depth: 2 }))?.q).not.toEqual(current(a)?.q);
  });

  it('meadow → showdown → (no treats or paths at depth 0) next meadow → … → won', () => {
    let run = startRun({ level: 2, seed: 9, depth: 0 });
    run = playUntilStageChanges(run, 'first');
    expect(run.stage.kind).toBe('showdown');
    if (run.stage.kind === 'showdown') expect(run.stage.rascal).toBe(3);
    run = playUntilStageChanges(run, 'first');
    expect(run.stage).toMatchObject({ kind: 'meadow', meadow: 1 });
    expect(perfectRun(2, 0).stage.kind).toBe('won');
  });

  it('rest stops and doors come in at depth 1 and 2', () => {
    let run = startRun({ level: 2, seed: 9, depth: 2 });
    run = playUntilStageChanges(playUntilStageChanges(run, 'first'), 'first');
    expect(run.stage).toMatchObject({ kind: 'rest', meadow: 1 });
    if (run.stage.kind === 'rest') expect(run.stage.offer).toHaveLength(3);
    run = pickTreat(run, 'clover');
    expect(run.bag).toEqual(['clover']);
    expect(run.stage).toEqual({ kind: 'doors', meadow: 1 });
    run = choosePath(run, 'tricky');
    expect(run.stage).toMatchObject({ kind: 'meadow', meadow: 1, path: 'tricky' });
  });

  it('a question missed twice costs a heart and comes back once at the end', () => {
    let run = startRun({ level: 1, seed: 3, depth: 0 });
    const first = current(run)!.q;
    run = answer(run, 'fail');
    expect(run.hearts).toBe(2);
    expect(run.missed).toEqual([{ skill: first.skill, level: 1 }]);
    for (let i = 0; i < 4; i++) run = answer(run, 'first');
    const back = current(run)!;
    expect(back.comeback).toBe(true);
    expect(back.q).toEqual(first);
    // Getting it right earns comeback carrots; failing it again costs nothing.
    expect(preview(run, 'first').carrots).toBe(CARROTS.comeback(worth(first.tier!)));
    const after = answer(run, 'fail');
    expect(after.hearts).toBe(2);
    expect(after.stage.kind).toBe('showdown');
  });

  it('pays the perfect-meadow bonus only when no heart was lost, and says so before the next meadow resets it', () => {
    // Depth 0: winning a showdown goes straight into the next meadow, which starts its count again.
    const lost = playUntilStageChanges(answer(startRun({ level: 2, seed: 9, depth: 0 }), 'fail'), 'first');
    expect(lost.stage.kind).toBe('showdown');
    let sd = lost;
    while (sd.stage.kind === 'showdown' && sd.stage.rascal > 1) sd = answer(sd, 'first');
    expect(perfectEarned(sd)).toBe(0);
    const after = answer(sd, 'first');
    expect(after.stage).toMatchObject({ kind: 'meadow', meadow: 1 });
    expect(after.lostThisMeadow).toBe(0); // the reset that fooled the banner
    expect(after.carrots - sd.carrots).toBe(preview(sd, 'first').carrots);

    let clean = playUntilStageChanges(startRun({ level: 2, seed: 9, depth: 0 }), 'first');
    while (clean.stage.kind === 'showdown' && clean.stage.rascal > 1) clean = answer(clean, 'first');
    const bonus = perfectBonus(clean, 0, 'sunny');
    expect(perfectEarned(clean)).toBe(bonus);
    expect(answer(clean, 'first').carrots - clean.carrots).toBe(preview(clean, 'first').carrots + bonus);
  });

  it('practices missed skills at the level they were missed at', () => {
    expect(practiceFor(startRun({ level: 1, seed: 1, depth: 0 }))).toBeNull();
    // Meadow 3 and every showdown ask a level up, so their misses practice that level.
    let run = playUntilStageChanges(startRun({ level: 1, seed: 3, depth: 0 }), 'first');
    expect(run.stage.kind).toBe('showdown');
    const missed = current(run)!.q.skill;
    run = answer(run, 'fail');
    expect(run.missed).toEqual([{ skill: missed, level: showdownSpec(1, 0, 'sunny').level }]);
    expect(practiceFor(run)).toEqual({ level: 2, skills: [missed] });
    // Only skills from that one level go in, since one quiz has one level.
    const mixed = { ...run, missed: [...run.missed, { skill: 'add20' as const, level: 1 as const }, { skill: missed, level: 2 as const }] };
    expect(practiceFor(mixed)).toEqual({ level: 2, skills: [missed] });
  });

  it('ends when the hearts run out, and keeps the carrots', () => {
    let run = startRun({ level: 1, seed: 3, depth: 0 });
    run = answer(run, 'first');
    const carrots = run.carrots;
    expect(carrots).toBeGreaterThan(0);
    run = answer(answer(answer(run, 'fail'), 'fail'), 'fail');
    expect(run.stage.kind).toBe('lost');
    expect(run.hearts).toBe(0);
    expect(run.carrots).toBe(carrots);
  });

  it('a clover saves one heart', () => {
    let run = startRun({ level: 1, seed: 3, depth: 1 });
    run = { ...run, bag: ['clover'] };
    expect(canUse(run, 'clover')).toBe(true);
    run = useTreat(run, 'clover');
    expect(run.bag).toEqual([]);
    expect(preview(run, 'fail')).toMatchObject({ heartLost: false, saved: true });
    run = answer(run, 'fail');
    expect(run.hearts).toBe(3);
    expect(run.clover).toBe(false);
    expect(answer(run, 'fail').hearts).toBe(2);
  });

  it('cake adds a heart up to 5; the magnifier only works on choice and compare questions', () => {
    let run = { ...startRun({ level: 1, seed: 3, depth: 1 }), bag: ['cake', 'magnifier'] as Run['bag'] };
    run = useTreat(run, 'cake');
    expect(run.hearts).toBe(4);
    expect(current(run)!.q.kind).toBe('type');
    expect(canUse(run, 'magnifier')).toBe(false);
    expect(canUse({ ...run, hearts: 5, bag: ['cake'] }, 'cake')).toBe(false);
  });

  it('a full bag skips the treat', () => {
    let run = perfectRun(1, 1);
    expect(run.bag).toHaveLength(2);
    run = { ...startRun({ level: 1, seed: 3, depth: 1 }), bag: ['cake', 'cake', 'cake'] };
    run = { ...run, stage: { kind: 'rest', meadow: 1, offer: ['clover', 'cake', 'magnifier'] } };
    expect(pickTreat(run, 'clover').bag).toHaveLength(BAG_SIZE);
  });

  it('streaks pay a bonus from the third right answer in a row', () => {
    let run = startRun({ level: 1, seed: 3, depth: 0 });
    expect(preview(run, 'first').streakBonus).toBe(0);
    run = answer(answer(run, 'first'), 'first');
    expect(preview(run, 'first').streakBonus).toBeGreaterThan(0);
    expect(answer(run, 'second').streak).toBe(0);
  });

  it('second tries and "Show me how" still pay, never nothing', () => {
    const run = startRun({ level: 1, seed: 3, depth: 0 });
    expect(preview(run, 'second').carrots).toBeGreaterThanOrEqual(1);
    expect(preview(run, 'helped').carrots).toBe(preview(run, 'second').carrots);
  });
});

describe('where the challenge comes from', () => {
  it('meadow 3 and showdowns are a step up; Tricky is harder than Sunny', () => {
    expect(meadowSpec(1, 0, 'sunny')).toEqual({ level: 1, hard: false });
    expect(meadowSpec(1, 1, 'tricky')).toEqual({ level: 2, hard: false });
    expect(meadowSpec(1, 2, 'sunny')).toEqual({ level: 2, hard: false });
    expect(meadowSpec(1, 2, 'tricky')).toEqual({ level: 2, hard: true });
    expect(showdownSpec(1, 0, 'sunny')).toEqual({ level: 2, hard: false });
  });
  it('at the top level, hard picks stand in for the next level', () => {
    expect(meadowSpec(6, 1, 'tricky')).toEqual({ level: 6, hard: true });
    expect(meadowSpec(6, 2, 'sunny')).toEqual({ level: 6, hard: true });
    expect(showdownSpec(6, 0, 'sunny')).toEqual({ level: 6, hard: true });
  });
});

describe('carrots', () => {
  it('harder levels pay more for the same play', () => {
    expect(perfectRun(6, 0).carrots).toBeGreaterThan(perfectRun(1, 0).carrots * 2);
    expect(perfectRun(14, 0).carrots).toBeGreaterThan(perfectRun(11, 0).carrots);
  });
  it('a perfect run never goes over the server limit', () => {
    for (const level of [1, 2, 3, 4, 5, 6, 11, 12, 13, 14] as const) {
      for (const depth of [0, 3]) {
        for (const path of ['sunny', 'tricky'] as const) {
          const run = perfectRun(level, depth, path);
          expect(run.stage.kind).toBe('won');
          expect(run.carrots).toBeLessThanOrEqual(maxRunCarrots(level));
        }
      }
    }
  });
});
