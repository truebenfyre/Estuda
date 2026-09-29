export const STORAGE_KEY = "estuda.personal.v1";
export const RULES = Object.freeze({
  xp: 25,
  gold: 10,
  levelXp: 100,
  focusMs: 25 * 60 * 1000,
});
export const localDate = (now = Date.now()) => {
  const d = new Date(now);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
export function initialState() {
  return {
    version: 1,
    profile: { name: "", avatar: "🌱" },
    theme: "light",
    subjects: [],
    missions: [],
    awards: [],
    rewards: [],
    redemptions: [],
    focusSessions: [],
    timer: { remainingMs: RULES.focusMs, endsAt: null, sessionId: null },
  };
}
function text(value, label, max = 80) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > max)
    throw new Error(`${label}: preencha até ${max} caracteres.`);
  return value.trim();
}
function integer(value, label, min = 1, max = 10000) {
  if (!Number.isSafeInteger(value) || value < min || value > max)
    throw new Error(`${label}: use um número inteiro entre ${min} e ${max}.`);
  return value;
}
function validId(id) {
  return text(id, "Identificador", 100);
}
export function totals(state) {
  const xp = state.awards.reduce((n, x) => n + x.xp, 0);
  const earned = state.awards.reduce((n, x) => n + x.gold, 0);
  const spent = state.redemptions.reduce((n, x) => n + x.price, 0);
  return {
    xp,
    gold: earned - spent,
    level: Math.floor(xp / RULES.levelXp) + 1,
    levelProgress: xp % RULES.levelXp,
    completed: state.awards.length,
  };
}
export function remaining(timer, now = Date.now()) {
  return Math.max(
    0,
    timer.endsAt === null ? timer.remainingMs : timer.endsAt - now,
  );
}
function settleTimer(s, now) {
  if (s.timer.endsAt !== null && s.timer.endsAt <= now) {
    if (!s.focusSessions.some((x) => x.id === s.timer.sessionId))
      s.focusSessions.push({ id: s.timer.sessionId, endedAt: s.timer.endsAt });
    s.timer = { remainingMs: 0, endsAt: null, sessionId: null };
  }
}
export function transition(state, action, now = Date.now()) {
  const s = structuredClone(state);
  settleTimer(s, now);
  const mission = () => {
    const m = s.missions.find((x) => x.id === action.id);
    if (!m) throw new Error("Esta missão não está mais disponível.");
    return m;
  };
  switch (action.type) {
    case "profile":
      s.profile = {
        name: text(action.name, "Nome", 40),
        avatar: text(action.avatar, "Avatar", 8),
      };
      break;
    case "theme":
      s.theme = action.value === "dark" ? "dark" : "light";
      break;
    case "subject": {
      const name = text(action.name, "Matéria", 40);
      if (
        s.subjects.some(
          (x) =>
            x.name.toLocaleLowerCase() === name.toLocaleLowerCase() &&
            x.id !== action.id,
        )
      )
        throw new Error("Esta matéria já existe.");
      if (action.edit) {
        const sub = s.subjects.find((x) => x.id === action.id);
        if (!sub) throw new Error("Matéria não encontrada.");
        sub.name = name;
      } else if (!s.subjects.some((x) => x.id === action.id))
        s.subjects.push({ id: validId(action.id), name });
      break;
    }
    case "mission": {
      if (!s.subjects.some((x) => x.id === action.subjectId))
        throw new Error("Escolha uma matéria cadastrada.");
      const fields = {
        title: text(action.title, "Título"),
        subjectId: action.subjectId,
        goal: integer(action.goal, "Meta"),
        unit: text(action.unit, "Unidade", 25),
      };
      if (action.edit) {
        const m = mission();
        if (
          s.awards.some((x) => x.missionId === m.id) &&
          fields.goal !== m.goal
        )
          throw new Error("A meta de uma missão já premiada fica preservada.");
        if (fields.goal < m.progress)
          throw new Error(
            "A meta não pode ser menor que o progresso registrado.",
          );
        // Editing a goal cannot itself complete a mission or issue an award.
        if (m.progress < m.goal && fields.goal === m.progress)
          throw new Error(
            "Registre o último passo para concluir; mantenha a meta acima do progresso.",
          );
        Object.assign(m, fields);
      } else if (
        !s.missions.some((x) => x.id === action.id) &&
        !s.awards.some((x) => x.missionId === action.id)
      ) {
        s.missions.push({
          id: validId(action.id),
          ...fields,
          progress: 0,
          today: true,
          createdAt: now,
        });
      }
      break;
    }
    case "today":
      mission().today = !!action.value;
      break;
    case "progress": {
      const m = mission();
      m.progress = Math.max(
        0,
        Math.min(
          m.goal,
          m.progress + integer(action.amount, "Progresso", -10000, 10000),
        ),
      );
      if (
        m.progress === m.goal &&
        !s.awards.some((x) => x.missionId === m.id)
      ) {
        s.awards.push({
          missionId: m.id,
          title: m.title,
          xp: RULES.xp,
          gold: RULES.gold,
          completedAt: now,
          day: localDate(now),
        });
      }
      break;
    }
    case "deleteMission":
      s.missions = s.missions.filter((x) => x.id !== action.id);
      break;
    case "reward": {
      const fields = {
        name: text(action.name, "Recompensa"),
        price: integer(action.price, "Preço", 1, 1000000),
      };
      if (action.edit) {
        const r = s.rewards.find((x) => x.id === action.id);
        if (!r) throw new Error("Recompensa não encontrada.");
        Object.assign(r, fields);
      } else if (!s.rewards.some((x) => x.id === action.id))
        s.rewards.push({ id: validId(action.id), ...fields });
      break;
    }
    case "deleteReward":
      s.rewards = s.rewards.filter((x) => x.id !== action.id);
      break;
    case "redeem": {
      if (s.redemptions.some((x) => x.id === action.id)) break;
      const r = s.rewards.find((x) => x.id === action.rewardId);
      if (!r) throw new Error("Recompensa não encontrada.");
      if (totals(s).gold < r.price)
        throw new Error("Ainda falta ouro para esta recompensa.");
      s.redemptions.push({
        id: validId(action.id),
        rewardId: r.id,
        name: r.name,
        price: r.price,
        redeemedAt: now,
      });
      break;
    }
    case "timerStart":
      if (s.timer.endsAt === null) {
        if (s.timer.remainingMs === 0) s.timer.remainingMs = RULES.focusMs;
        s.timer.sessionId ||= validId(action.id);
        s.timer.endsAt = now + s.timer.remainingMs;
      }
      break;
    case "timerPause":
      s.timer.remainingMs = remaining(s.timer, now);
      s.timer.endsAt = null;
      break;
    case "timerReset":
      s.timer = { remainingMs: RULES.focusMs, endsAt: null, sessionId: null };
      break;
    case "tick":
      break;
    default:
      throw new Error("Ação desconhecida.");
  }
  return s;
}
export function serialize(state) {
  return JSON.stringify(state);
}
export function deserialize(raw) {
  if (raw === null) return initialState();
  let s;
  try {
    s = JSON.parse(raw);
    if (s.version !== 1 || !["light", "dark"].includes(s.theme))
      throw new Error();
    if (
      typeof s.profile.name !== "string" ||
      s.profile.name.length > 40 ||
      typeof s.profile.avatar !== "string"
    )
      throw new Error();
    for (const key of [
      "subjects",
      "missions",
      "awards",
      "rewards",
      "redemptions",
      "focusSessions",
    ])
      if (!Array.isArray(s[key])) throw new Error();
    const unique = (rows, key) =>
      new Set(rows.map((x) => x[key])).size === rows.length;
    for (const key of [
      "subjects",
      "missions",
      "rewards",
      "redemptions",
      "focusSessions",
    ]) {
      if (!unique(s[key], "id")) throw new Error();
      s[key].forEach((x) => validId(x.id));
    }
    if (!unique(s.awards, "missionId")) throw new Error();
    s.subjects.forEach((x) => text(x.name, "Matéria", 40));
    s.missions.forEach((x) => {
      text(x.title, "Missão");
      text(x.unit, "Unidade", 25);
      integer(x.goal, "Meta");
      integer(x.progress, "Progresso", 0, x.goal);
      if (
        typeof x.today !== "boolean" ||
        !s.subjects.some((y) => y.id === x.subjectId)
      )
        throw new Error();
    });
    s.awards.forEach((x) => {
      validId(x.missionId);
      text(x.title, "Missão");
      if (
        x.xp !== RULES.xp ||
        x.gold !== RULES.gold ||
        !Number.isFinite(x.completedAt) ||
        typeof x.day !== "string"
      )
        throw new Error();
    });
    s.rewards.forEach((x) => {
      text(x.name, "Recompensa");
      integer(x.price, "Preço", 1, 1000000);
    });
    s.redemptions.forEach((x) => {
      text(x.name, "Recompensa");
      integer(x.price, "Preço", 1, 1000000);
      if (!Number.isFinite(x.redeemedAt)) throw new Error();
    });
    s.focusSessions.forEach((x) => {
      if (!Number.isFinite(x.endedAt)) throw new Error();
    });
    integer(s.timer.remainingMs, "Tempo", 0, RULES.focusMs);
    if (
      s.timer.endsAt !== null &&
      (!Number.isFinite(s.timer.endsAt) || !s.timer.sessionId)
    )
      throw new Error();
    if (totals(s).gold < 0) throw new Error();
  } catch {
    throw new Error(
      "Os dados salvos não puderam ser lidos. Eles foram preservados. Exporte uma cópia antes de tentar recuperá-los.",
    );
  }
  return s;
}

export function isPristine(state) {
  return (
    !state.profile.name &&
    !state.subjects.length &&
    !state.missions.length &&
    !state.awards.length &&
    !state.rewards.length &&
    !state.redemptions.length &&
    !state.focusSessions.length &&
    state.timer.endsAt === null &&
    state.timer.remainingMs === RULES.focusMs
  );
}
