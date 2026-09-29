import test from "node:test";
import assert from "node:assert/strict";
import {
  initialState,
  transition as act,
  totals,
  serialize,
  deserialize,
  remaining,
  RULES,
} from "../lib/model.js";
const NOW = new Date(2026, 8, 26, 12).getTime();
function setup(goal = 2) {
  let s = act(
    initialState(),
    { type: "subject", id: "math", name: "Matemática" },
    NOW,
  );
  return act(
    s,
    {
      type: "mission",
      id: "m1",
      title: "Frações",
      subjectId: "math",
      goal,
      unit: "exercícios",
    },
    NOW,
  );
}
test("completion awards once across reload, undo, re-completion and delete/recreate", () => {
  let s = setup();
  s = act(s, { type: "progress", id: "m1", amount: 99 }, NOW);
  assert.deepEqual(totals(s), {
    xp: 25,
    gold: 10,
    level: 1,
    levelProgress: 25,
    completed: 1,
  });
  s = deserialize(serialize(s));
  s = act(s, { type: "progress", id: "m1", amount: 1 }, NOW);
  s = act(s, { type: "progress", id: "m1", amount: -1 }, NOW);
  s = act(s, { type: "progress", id: "m1", amount: 1 }, NOW);
  assert.equal(s.awards.length, 1);
  s = act(s, { type: "deleteMission", id: "m1" }, NOW);
  s = act(
    s,
    {
      type: "mission",
      id: "m1",
      title: "Again",
      subjectId: "math",
      goal: 1,
      unit: "vez",
    },
    NOW,
  );
  assert.equal(s.missions.length, 0);
  assert.equal(totals(s).gold, 10);
  assert.equal(deserialize(serialize(s)).awards.length, 1);
});
test("editing a target cannot silently complete or re-award work", () => {
  let s = act(setup(3), { type: "progress", id: "m1", amount: 1 }, NOW);
  assert.throws(
    () =>
      act(s, {
        type: "mission",
        id: "m1",
        edit: true,
        title: "Frações",
        subjectId: "math",
        goal: 1,
        unit: "exercícios",
      }),
    /último passo/,
  );
  s = act(s, { type: "progress", id: "m1", amount: 2 }, NOW);
  assert.throws(
    () =>
      act(s, {
        type: "mission",
        id: "m1",
        edit: true,
        title: "Frações",
        subjectId: "math",
        goal: 4,
        unit: "exercícios",
      }),
    /preservada/,
  );
});
test("redemption is idempotent, never negative, snapshots price and does not change XP", () => {
  let s = act(setup(1), { type: "progress", id: "m1", amount: 1 }, NOW);
  s = act(s, { type: "reward", id: "r", name: "Sorvete", price: 7 }, NOW);
  s = act(s, { type: "redeem", id: "purchase1", rewardId: "r" }, NOW);
  s = act(s, { type: "redeem", id: "purchase1", rewardId: "r" }, NOW);
  assert.equal(totals(s).gold, 3);
  assert.equal(totals(s).xp, 25);
  assert.equal(s.redemptions.length, 1);
  assert.throws(
    () => act(s, { type: "redeem", id: "purchase2", rewardId: "r" }, NOW),
    /falta ouro/,
  );
  s = act(
    s,
    { type: "reward", edit: true, id: "r", name: "Outro sorvete", price: 20 },
    NOW,
  );
  s = act(s, { type: "deleteReward", id: "r" }, NOW);
  s = deserialize(serialize(s));
  assert.equal(s.redemptions[0].name, "Sorvete");
  assert.equal(s.redemptions[0].price, 7);
  assert.equal(totals(s).gold, 3);
});
test("level is derived consistently from lifetime XP even after spending", () => {
  let s = setup(1);
  for (let i = 0; i < 4; i++) {
    if (i)
      s = act(
        s,
        {
          type: "mission",
          id: "m" + (i + 1),
          title: "Estudo",
          subjectId: "math",
          goal: 1,
          unit: "página",
        },
        NOW,
      );
    s = act(s, { type: "progress", id: "m" + (i + 1), amount: 1 }, NOW);
  }
  s = act(s, { type: "reward", id: "r", name: "Pausa", price: 40 }, NOW);
  s = act(s, { type: "redeem", id: "p", rewardId: "r" }, NOW);
  assert.equal(totals(s).level, 2);
  assert.equal(totals(s).xp, 100);
  assert.equal(totals(s).gold, 0);
});
test("timer uses timestamps across background/reload, pause/resume and completion", () => {
  let s = act(initialState(), { type: "timerStart", id: "session1" }, NOW);
  assert.equal(remaining(s.timer, NOW + 60000), RULES.focusMs - 60000);
  s = act(s, { type: "timerPause" }, NOW + 60000);
  assert.equal(remaining(s.timer, NOW + 90000), RULES.focusMs - 60000);
  s = deserialize(serialize(s));
  s = act(s, { type: "timerStart", id: "ignored" }, NOW + 100000);
  s = deserialize(serialize(s));
  s = act(s, { type: "tick" }, NOW + 100000 + RULES.focusMs);
  assert.equal(s.timer.remainingMs, 0);
  assert.equal(s.focusSessions.length, 1);
  assert.equal(totals(s).xp, 0);
  s = act(s, { type: "tick" }, NOW + 9999999);
  assert.equal(s.focusSessions.length, 1);
  s = act(s, { type: "timerReset" }, NOW + 9999999);
  assert.equal(s.timer.remainingMs, RULES.focusMs);
});
test("reset abandons unfinished timer and does not award a session", () => {
  let s = act(initialState(), { type: "timerStart", id: "s" }, NOW);
  s = act(s, { type: "timerReset" }, NOW + 1000);
  assert.equal(s.focusSessions.length, 0);
  assert.equal(s.timer.endsAt, null);
});
test("versioned persistence round-trips actual data and rejects corrupt/unsupported data", () => {
  let s = act(
    setup(),
    { type: "profile", name: "Peterson", avatar: "🦊" },
    NOW,
  );
  s = act(s, { type: "theme", value: "dark" }, NOW);
  assert.deepEqual(deserialize(serialize(s)), s);
  assert.deepEqual(deserialize(null), initialState());
  for (const raw of [
    "bad",
    "{}",
    JSON.stringify({ ...s, version: 2 }),
    JSON.stringify({ ...s, missions: [{ ...s.missions[0], progress: -1 }] }),
    JSON.stringify({ ...s, subjects: [] }),
  ])
    assert.throws(() => deserialize(raw), /preservados/);
});
test("invalid quantities, duplicate subjects and missing subjects are rejected", () => {
  const s = setup();
  assert.throws(() =>
    act(s, { type: "reward", id: "r", name: "A", price: -1 }),
  );
  assert.throws(() =>
    act(s, { type: "reward", id: "r", name: "A", price: 1.5 }),
  );
  assert.throws(
    () => act(s, { type: "subject", id: "new", name: "matemática" }),
    /já existe/,
  );
  assert.throws(() =>
    act(s, {
      type: "mission",
      id: "bad",
      title: "A",
      goal: 1,
      unit: "x",
      subjectId: "missing",
    }),
  );
});
