"use client";
import React, { useEffect, useId, useRef, useState } from "react";
import {
  Sparkles,
  LayoutDashboard,
  ListChecks,
  BookOpen,
  Gift,
  Trophy,
  Coins,
  Moon,
  Sun,
  Plus,
  Timer,
  Play,
  Pause,
  RotateCcw,
  Check,
  Trash2,
  Pencil,
  Star,
  UserRound,
  X,
  Download,
  LogOut,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";
import {
  STORAGE_KEY,
  RULES,
  initialState,
  deserialize,
  serialize,
  transition,
  totals,
  remaining,
  localDate,
} from "../lib/model";

import { PATHS } from "../lib/routes";

const NAV = [
  ["dia", "Meu dia", LayoutDashboard],
  ["missoes", "Missões", ListChecks],
  ["materias", "Matérias", BookOpen],
  ["recompensas", "Recompensas", Gift],
  ["conquistas", "Conquistas", Trophy],
];
const AVATARS = ["🌱", "🦊", "🐱", "🦉", "🚀", "🌻"];
const id = () => crypto.randomUUID();
const formatDate = (value) =>
  new Date(value).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });

function Modal({ title, children, close }) {
  const ref = useRef(null);
  const titleId = useId();
  useEffect(() => {
    ref.current?.showModal();
    ref.current
      ?.querySelector(
        "input:not([disabled]),select:not([disabled]),textarea:not([disabled])",
      )
      ?.focus();
  }, []);
  return (
    <dialog
      className="em-modal"
      aria-labelledby={titleId}
      ref={ref}
      onCancel={close}
      onClick={(e) => {
        if (e.target === ref.current) close();
      }}
    >
      <div className="em-modal-head">
        <h2 id={titleId}>{title}</h2>
        <button className="em-icon-btn" onClick={close} aria-label="Fechar">
          <X />
        </button>
      </div>
      {children}
    </dialog>
  );
}
function Bar({ value, max, label, xp = false }) {
  return (
    <div
      className={xp ? "em-xpbar" : "em-progress"}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
    >
      <span style={{ width: `${Math.min(100, (value / max) * 100)}%` }} />
    </div>
  );
}

export default function StudyApp({
  pathname = "/login",
  navigate,
  LinkComponent = "a",
  account = null,
  configured = false,
  localAvailable = false,
  auth,
  transport,
}) {
  const [state, setState] = useState(initialState);
  const [ready, setReady] = useState(false);
  const [fatal, setFatal] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const view =
    Object.keys(PATHS).find((key) => PATHS[key] === pathname) || "dia";
  const [authMode, setAuthMode] = useState("signIn");
  const [authMessage, setAuthMessage] = useState("");
  const [legacyAvailable, setLegacyAvailable] = useState(false);
  const revisionRef = useRef(0);
  const nextTickAttempt = useRef(0);
  const headingRef = useRef(null);
  const contentRef = useRef(null);
  const [modal, setModal] = useState(null);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(0);
  const [filter, setFilter] = useState("ativas");
  const queue = useRef(Promise.resolve());
  const ticking = useRef(false);

  function adopt(snapshot) {
    if (snapshot.userId !== account?.id)
      throw new Error("A conta mudou. Entre novamente antes de continuar.");
    revisionRef.current = snapshot.revision;
    setState(deserialize(JSON.stringify(snapshot.state)));
  }
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        if (account) {
          const snapshot = await transport.load();
          if (!cancelled) adopt(snapshot);
        } else {
          let theme = "light";
          try {
            theme =
              localStorage.getItem("estuda.theme.v1") === "dark"
                ? "dark"
                : "light";
          } catch {
            /* Account access does not require local storage. */
          }
          if (!cancelled) setState({ ...initialState(), theme });
        }
        if (!cancelled) setFatal("");
      } catch (e) {
        if (!cancelled) setFatal(e.message);
      } finally {
        if (!cancelled) setReady(true);
      }
    }
    try {
      setLegacyAvailable(!!localStorage.getItem(STORAGE_KEY));
    } catch {
      /* Cloud accounts don't depend on local storage. */
    }
    if (new URLSearchParams(location.search).get("error") === "confirmation")
      setAuthMessage(
        "O link de confirmação expirou ou não pôde ser verificado. Solicite um novo link de recuperação ou tente entrar novamente.",
      );
    load();
    setNow(Date.now());
    const interval = setInterval(() => setNow(Date.now()), 1000);
    const visible = () => {
      setNow(Date.now());
      if (document.visibilityState === "visible" && account) load();
    };
    document.addEventListener("visibilitychange", visible);
    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [account?.id]);
  useEffect(() => {
    document.documentElement.dataset.theme = state.theme;
    document.documentElement.style.colorScheme = state.theme;
  }, [state.theme]);

  useEffect(() => {
    if (!ready || fatal) return;
    if (!account && pathname !== "/login") navigate("/login", true);
    else if (account && pathname === "/") navigate("/meu-dia", true);
  }, [ready, account?.id, pathname, fatal]);
  useEffect(() => {
    contentRef.current?.scrollTo?.({ top: 0 });
    headingRef.current?.focus({ preventScroll: true });
    setNotice("");
    setError("");
  }, [pathname]);
  useEffect(() => {
    setError("");
  }, [modal?.type]);
  async function submitAuth(event) {
    event.preventDefault();
    setError("");
    setAuthMessage("");
    setBusy(true);
    const data = new FormData(event.currentTarget);
    const method =
      pathname === "/recuperar-senha" ? "updatePassword" : authMode;
    try {
      const result = await auth[method](data);
      if (result.error) setError(result.error);
      else if (result.message) {
        setAuthMessage(result.message);
        event.target.reset();
      } else if (result.ok) navigate("/meu-dia", true, true);
    } catch {
      setError("Não foi possível conectar. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }
  async function enterLocal() {
    setBusy(true);
    setError("");
    try {
      const result = await auth.enterLocal();
      if (result.error) setError(result.error);
      else navigate("/meu-dia", true, true);
    } catch { setError("Não foi possível entrar no modo local."); }
    finally { setBusy(false); }
  }
  async function exitAccount() {
    setBusy(true);
    setError("");
    try {
      const result = await auth.signOut();
      if (result.error) setError(result.error);
      else {
        setState(initialState());
        navigate("/login", true, true);
      }
    } catch {
      setError("Não foi possível sair. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }
  function toggleTheme() {
    const value = state.theme === "light" ? "dark" : "light";
    if (account) mutate({ type: "theme", value });
    else {
      setState((s) => ({ ...s, theme: value }));
      try {
        localStorage.setItem("estuda.theme.v1", value);
      } catch {
        /* Theme remains usable in memory. */
      }
    }
  }
  function mutate(action, message = "") {
    const run = async () => {
      if (!account) return false;
      setBusy(true);
      setError("");
      try {
        const snapshot = await transport.apply(action, revisionRef.current);
        adopt(snapshot);
        setNow(Date.now());
        setNotice(message);
        return true;
      } catch (e) {
        setError(e.message);
        if (e.status === 401) navigate("/login", true, true);
        if (e.status === 409) {
          try {
            adopt(await transport.load());
          } catch {
            /* Keep visible data intact if refresh also fails. */
          }
        }
        return false;
      } finally {
        setBusy(false);
      }
    };
    const pending = queue.current.then(run, run);
    queue.current = pending;
    return pending;
  }
  useEffect(() => {
    if (
      ready &&
      account &&
      !fatal &&
      now >= nextTickAttempt.current &&
      state.timer.endsAt !== null &&
      now >= state.timer.endsAt &&
      !ticking.current
    ) {
      ticking.current = true;
      nextTickAttempt.current = now + 30000;
      mutate(
        { type: "tick" },
        "Tempo de foco encerrado. Faça uma pausa.",
      ).finally(() => {
        ticking.current = false;
      });
    }
  }, [now, state.timer.endsAt, ready, fatal]);

  function go(next) {
    setModal(null);
    navigate(PATHS[next]);
  }
  function openMission(mission) {
    setError("");
    if (!state.subjects.length) {
      go("materias");
      setModal({ type: "subject" });
      setNotice("Cadastre sua primeira matéria para criar uma missão.");
      return;
    }
    setModal({ type: "mission", item: mission });
  }
  async function submit(e) {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.currentTarget));
    const item = modal.item;
    if (modal.type === "import") {
      setBusy(true);
      setError("");
      try {
        const legacy = deserialize(localStorage.getItem(STORAGE_KEY));
        const result = await transport.importLegacy(
          legacy,
          revisionRef.current,
          data.confirmEmail,
        );
        adopt(result);
        setNotice(
          "Dados locais importados para sua conta. A cópia antiga foi preservada.",
        );
        setModal(null);
      } catch (e) {
        setError(e.message);
      } finally {
        setBusy(false);
      }
      return;
    }
    let action;
    if (modal.type === "deleteMission" || modal.type === "deleteReward")
      action = { type: modal.type, id: item.id };
    if (modal.type === "progress")
      action = { type: "progress", id: item.id, amount: Number(data.amount) };
    if (modal.type === "profile")
      action = { type: "profile", name: data.name, avatar: data.avatar };
    if (modal.type === "subject")
      action = {
        type: "subject",
        id: item?.id || id(),
        name: data.name,
        edit: !!item,
      };
    if (modal.type === "mission")
      action = {
        type: "mission",
        id: item?.id || id(),
        edit: !!item,
        title: data.title,
        subjectId: data.subjectId,
        goal: Number(data.goal ?? item.goal),
        unit: data.unit,
      };
    if (modal.type === "reward")
      action = {
        type: "reward",
        id: item?.id || id(),
        edit: !!item,
        name: data.name,
        price: Number(data.price),
      };
    if (await mutate(action, account.mode === "local" ? "Alteração salva neste computador." : "Alteração salva na sua conta.")) setModal(null);
  }
  function removeMission(m) {
    setModal({ type: "deleteMission", item: m });
  }
  function exportBackup(legacy = false) {
    try {
      const blob = new Blob(
        [legacy ? localStorage.getItem(STORAGE_KEY) || "{}" : serialize(state)],
        {
          type: "application/json",
        },
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "estuda-backup.json";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setError("Não foi possível acessar os dados para exportar.");
    }
  }

  const stats = totals(state);
  const active = state.missions.filter((m) => m.progress < m.goal);
  const today = active.filter((m) => m.today);
  const completedToday = state.awards.filter(
    (a) => a.day === localDate(now || Date.now()),
  ).length;
  const seconds = Math.ceil(remaining(state.timer, now || Date.now()) / 1000);
  const clock = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  const nextReward = state.rewards[0];
  const achievements = [
    {
      icon: "🌱",
      name: "Primeiro passo",
      description: "Conclua sua primeira missão.",
      unlocked: stats.completed >= 1,
      progress: `${Math.min(stats.completed, 1)}/1`,
    },
    {
      icon: "⭐",
      name: "Cinco pequenas vitórias",
      description: "Conclua cinco missões diferentes.",
      unlocked: stats.completed >= 5,
      progress: `${Math.min(stats.completed, 5)}/5`,
    },
    {
      icon: "📅",
      name: "Três dias de dedicação",
      description: "Conclua missões em três dias diferentes.",
      unlocked: new Set(state.awards.map((a) => a.day)).size >= 3,
      progress: `${Math.min(new Set(state.awards.map((a) => a.day)).size, 3)}/3`,
    },
  ];
  function nav(mobile = false) {
    return (
      <nav
        className={mobile ? "em-bottom" : "em-nav"}
        aria-label={mobile ? "Navegação no celular" : "Navegação principal"}
      >
        {NAV.map(([key, label, Icon]) => (
          <LinkComponent
            href={PATHS[key]}
            onClick={() => setModal(null)}
            key={key}
            className={view === key ? "em-active" : ""}
            aria-current={view === key ? "page" : undefined}
          >
            <Icon aria-hidden="true" />
            <span>{label}</span>
          </LinkComponent>
        ))}
      </nav>
    );
  }
  function missionCard(m) {
    const subject = state.subjects.find((x) => x.id === m.subjectId);
    const awarded = state.awards.some((a) => a.missionId === m.id);
    const done = m.progress >= m.goal;
    return (
      <article className="em-mission" key={m.id}>
        <div className="em-mission-head">
          <span className="em-mission-icon">
            <BookOpen aria-hidden="true" />
          </span>
          <div className="em-mission-text">
            <div className="em-subject">{subject?.name}</div>
            <h3>{m.title}</h3>
            <p>
              Complete {m.goal} {m.unit}.
            </p>
          </div>
          <div className="em-prize">
            <span className="em-star">
              <Star aria-hidden="true" />
            </span>
            <div>
              {awarded ? "Recebido" : `+${RULES.xp} XP`}
              <small>{awarded ? "Prêmio único" : `+${RULES.gold} ouro`}</small>
            </div>
          </div>
        </div>
        <div className="em-progress-row">
          <span className="em-fraction">
            {m.progress}/{m.goal}
          </span>
          <Bar
            value={m.progress}
            max={m.goal}
            label={`Progresso de ${m.title}`}
          />
          <button
            className="em-plus"
            disabled={busy || done}
            onClick={() =>
              mutate(
                { type: "progress", id: m.id, amount: 1 },
                done ? "" : "Progresso salvo.",
              )
            }
            aria-label={`Registrar mais uma unidade em ${m.title}`}
          >
            {done ? <Check /> : <Plus />}
          </button>
        </div>
        <div className="em-row-actions">
          {!done && (
            <button
              className="em-link"
              onClick={() => setModal({ type: "progress", item: m })}
            >
              Registrar quantidade
            </button>
          )}
          <label className="em-check">
            <input
              type="checkbox"
              checked={m.today}
              onChange={(e) =>
                mutate({ type: "today", id: m.id, value: e.target.checked })
              }
              disabled={busy}
            />
            Na lista do dia
          </label>
          <button className="em-link" onClick={() => openMission(m)}>
            <Pencil />
            Editar
          </button>
          <button
            className="em-link"
            disabled={busy || m.progress === 0}
            onClick={() =>
              mutate(
                { type: "progress", id: m.id, amount: -1 },
                "Passo desfeito. Uma missão só recebe o prêmio uma vez.",
              )
            }
          >
            Desfazer passo
          </button>
          <button
            className="em-icon-btn"
            aria-label={`Excluir ${m.title}`}
            onClick={() => removeMission(m)}
            disabled={busy}
          >
            <Trash2 />
          </button>
        </div>
      </article>
    );
  }
  function focusPanel() {
    return (
      <section className="em-focus" aria-label="Timer de foco">
        <span className="em-focus-icon">
          <Timer />
        </span>
        <div className="em-focus-copy">
          <strong>Seu momento de foco</strong>
          <small>25 minutos, uma coisa de cada vez.</small>
          <small>O timer não valida o estudo nem concede XP.</small>
        </div>
        <div className="em-timer-controls">
          <output aria-label="Tempo restante">{clock}</output>
          <button
            disabled={busy}
            onClick={() =>
              mutate({
                type: state.timer.endsAt ? "timerPause" : "timerStart",
                id: id(),
              })
            }
          >
            {state.timer.endsAt ? <Pause /> : <Play />}
            {state.timer.endsAt
              ? "Pausar"
              : state.timer.remainingMs < RULES.focusMs &&
                  state.timer.remainingMs > 0
                ? "Retomar"
                : "Iniciar"}
          </button>
          <button
            disabled={busy}
            aria-label="Reiniciar timer em 25 minutos"
            onClick={() => mutate({ type: "timerReset" })}
          >
            <RotateCcw />
          </button>
        </div>
      </section>
    );
  }
  function empty(title, description, button, action) {
    return (
      <div className="em-empty">
        <Sparkles />
        <h2>{title}</h2>
        <p>{description}</p>
        {button && (
          <button className="em-create" onClick={action}>
            {button}
          </button>
        )}
      </div>
    );
  }

  if (fatal)
    return (
      <main id="estuda-app" className="em-loading">
        <h1>Seus dados precisam de atenção</h1>
        <p role="alert">{fatal}</p>
        <button className="em-create" onClick={() => location.reload()}>
          Tentar novamente
        </button>
        {legacyAvailable && (
          <button className="em-link" onClick={() => exportBackup(true)}>
            Exportar cópia local antiga
          </button>
        )}
        <button className="em-link" onClick={exitAccount}>
          Sair
        </button>
        <p>
          Nenhum dado foi substituído. Verifique a conexão e tente novamente.
        </p>
      </main>
    );

  const recovery = pathname === "/recuperar-senha";
  const pristine =
    !state.profile.name &&
    !state.missions.length &&
    !state.subjects.length &&
    !state.awards.length &&
    !state.rewards.length &&
    !state.redemptions.length;
  if (!account || pathname === "/login" || pathname === "/" || recovery)
    return (
      <div id="estuda-app" data-theme={state.theme} className="em-entry">
        <header className="em-entry-header">
          <div className="em-logo">
            <span className="em-logo-mark">
              <Sparkles />
            </span>
            estuda<span className="em-purple">.</span>
          </div>
          <button
            className="em-theme"
            disabled={busy}
            aria-label={
              state.theme === "light"
                ? "Ativar modo escuro"
                : "Ativar modo claro"
            }
            onClick={toggleTheme}
          >
            {state.theme === "light" ? <Moon /> : <Sun />}
          </button>
        </header>
        <main className="em-entry-main">
          <section className="em-entry-story">
            <span className="em-eyebrow">UM PASSO DE CADA VEZ</span>
            <h1>
              Seu esforço
              <br />
              vira <span>progresso.</span>
            </h1>
            <p>
              Organize seus estudos, acompanhe suas pequenas vitórias e celebre
              o que você aprendeu.
            </p>
            <div className="em-entry-points">
              <div>
                <ListChecks />
                <span>Missões que cabem no seu dia</span>
              </div>
              <div>
                <Timer />
                <span>Um tempo só para focar</span>
              </div>
              <div>
                <Gift />
                <span>Recompensas escolhidas por você</span>
              </div>
            </div>
          </section>
          <section className="em-entry-card" aria-labelledby="entry-title">
            <span className="em-entry-symbol">
              <BookOpen />
            </span>
            <h2 id="entry-title">
              {recovery
                ? "Escolha uma nova senha"
                : authMode === "signUp"
                  ? "Crie sua conta"
                  : authMode === "requestPasswordReset"
                    ? "Recupere seu acesso"
                    : "Entre no seu espaço"}
            </h2>
            <p>
              {authMode === "requestPasswordReset"
                ? "Vamos enviar um link para seu email."
                : "Um lugar para organizar seus estudos e acompanhar seu progresso."}
            </p>
            {localAvailable && !account && !recovery && (
              <div className="em-local-entry">
                <button className="em-create em-enter" disabled={busy} onClick={enterLocal}>
                  Entrar no modo local <ArrowRight />
                </button>
                <p>Sem senha. Seus dados ficam neste computador, separados das contas online.</p>
              </div>
            )}
            {!configured && (
              <div className="em-setup-note" role="status">
                <strong>Conexão de contas em preparação</strong>
                <p>
                  O projeto Supabase ainda não foi configurado. Login e cadastro
                  serão liberados após essa conexão. Nenhuma senha será enviada
                  ou salva agora.
                </p>
              </div>
            )}
            {account && !recovery ? (
              <>
                <p className="em-account-email">{account.email}</p>
                <button
                  className="em-create em-enter"
                  onClick={() => navigate("/meu-dia", true)}
                >
                  Continuar
                  <ArrowRight />
                </button>
                <button className="em-link" onClick={exitAccount}>
                  Sair desta conta
                </button>
              </>
            ) : (
              <form
                onSubmit={submitAuth}
                aria-describedby={error ? "auth-error" : undefined}
              >
                {!recovery && (
                  <label>
                    Email
                    <input
                      type="email"
                      name="email"
                      autoComplete="email"
                      required
                      maxLength={254}
                      placeholder="voce@exemplo.com"
                      disabled={!configured || busy}
                    />
                  </label>
                )}
                {(recovery || authMode !== "requestPasswordReset") && (
                  <label>
                    Senha
                    <input
                      type="password"
                      name="password"
                      autoComplete={
                        authMode === "signIn" && !recovery
                          ? "current-password"
                          : "new-password"
                      }
                      required
                      minLength={8}
                      maxLength={128}
                      disabled={!configured || busy}
                    />
                  </label>
                )}
                {(recovery || authMode === "signUp") && (
                  <>
                    <label>
                      Confirme a senha
                      <input
                        type="password"
                        name="confirmPassword"
                        autoComplete="new-password"
                        required
                        minLength={8}
                        maxLength={128}
                        disabled={!configured || busy}
                      />
                    </label>
                    <p className="em-help">Use pelo menos 8 caracteres.</p>
                  </>
                )}
                {error && (
                  <p id="auth-error" role="alert" className="em-error">
                    {error}
                  </p>
                )}
                {authMessage && (
                  <p className="em-auth-success" role="status">
                    {authMessage}
                  </p>
                )}
                <button
                  className="em-create em-enter"
                  disabled={!configured || busy}
                  type="submit"
                >
                  {busy
                    ? "Aguarde…"
                    : recovery
                      ? "Salvar nova senha"
                      : authMode === "signUp"
                        ? "Criar conta"
                        : authMode === "requestPasswordReset"
                          ? "Enviar link"
                          : "Entrar"}
                  <ArrowRight />
                </button>
                {!recovery && (
                  <div className="em-auth-links">
                    <button
                      className="em-link"
                      type="button"
                      onClick={() => {
                        setAuthMode(
                          authMode === "signUp" ? "signIn" : "signUp",
                        );
                        setError("");
                        setAuthMessage("");
                      }}
                    >
                      {authMode === "signUp"
                        ? "Já tenho uma conta"
                        : "Criar uma conta"}
                    </button>
                    <button
                      className="em-link"
                      type="button"
                      onClick={() => {
                        setAuthMode(
                          authMode === "requestPasswordReset"
                            ? "signIn"
                            : "requestPasswordReset",
                        );
                        setError("");
                        setAuthMessage("");
                      }}
                    >
                      {authMode === "requestPasswordReset"
                        ? "Voltar para entrar"
                        : "Esqueci minha senha"}
                    </button>
                  </div>
                )}
              </form>
            )}
            <div className="em-entry-privacy">
              <ShieldCheck />
              <p>
                Acesso por email e senha. Seus dados ficam associados à sua
                conta; senhas não são salvas no armazenamento local.
              </p>
            </div>
            {legacyAvailable && (
              <p className="em-help">
                Os dados da versão local continuam preservados. Você poderá
                confirmar uma importação depois de entrar.{" "}
                <button className="em-link" onClick={() => exportBackup(true)}>
                  Exportar cópia antiga
                </button>
              </p>
            )}
          </section>
        </main>
        <footer className="em-entry-footer">
          Seu espaço pessoal para aprender.{" "}
          <span>Estuda · nome provisório</span>
        </footer>
      </div>
    );
  if (!ready)
    return (
      <main id="estuda-app" className="em-loading" aria-busy="true">
        <Sparkles />
        <h1>Carregando seu espaço</h1>
        <p>Buscando seus dados com segurança…</p>
      </main>
    );

  return (
    <div id="estuda-app" data-theme={state.theme}>
      <div className="em-shell">
        <aside className="em-rail">
          <div className="em-logo">
            <span className="em-logo-mark">
              <Sparkles />
            </span>
            estuda<span className="em-purple">.</span>
          </div>
          {nav()}
          <div className="em-rail-foot">
            Seu esforço vira progresso.
            <br />
            <br />
            Sua conta · nome provisório
            <button
              className="em-link"
              onClick={() => setModal({ type: "profile" })}
            >
              Editar perfil
            </button>
            <button className="em-link" onClick={() => exportBackup()}>
              <Download />
              Exportar dados
            </button>
          </div>
        </aside>
        <div className="em-main-shell">
          <header className="em-top">
            <div className="em-greeting">
              <strong>Oi, {state.profile.name || "estudante"} 👋</strong>
              <span className={account.mode === "local" ? "em-local-badge" : ""}>{account.mode === "local" ? "Modo local" : "Seu espaço, seu ritmo."}</span>
            </div>
            <div className="em-top-right">
              <span className="em-account-label">{account.mode === "local" ? "Modo local · neste computador" : "Sua conta"}</span>
              <span className="em-wallet">
                <Coins />
                {stats.gold} ouro
              </span>
              <button
                className="em-theme"
                aria-label={
                  state.theme === "light"
                    ? "Ativar modo escuro"
                    : "Ativar modo claro"
                }
                aria-pressed={state.theme === "dark"}
                onClick={() =>
                  mutate({
                    type: "theme",
                    value: state.theme === "light" ? "dark" : "light",
                  })
                }
                disabled={busy}
              >
                {state.theme === "light" ? <Moon /> : <Sun />}
              </button>
              <button
                className="em-avatar-small"
                onClick={() => setModal({ type: "profile" })}
                aria-label="Editar perfil"
              >
                {state.profile.avatar}
              </button>
              <button
                className="em-exit"
                onClick={exitAccount}
                disabled={busy}
                aria-label="Sair da conta"
              >
                <LogOut />
                <span>Sair</span>
              </button>
            </div>
          </header>
          <div className="em-body" ref={contentRef}>
            <main className="em-center" id="main-content">
              <div className="em-title-line">
                <h1 ref={headingRef} tabIndex={-1}>
                  {NAV.find((x) => x[0] === view)?.[1]}
                </h1>
                {(view === "dia" || view === "missoes") && (
                  <button className="em-create" onClick={() => openMission()}>
                    <Plus />
                    Nova missão
                  </button>
                )}
              </div>
              <p className="em-subtitle">
                {
                  {
                    dia: "Escolha um próximo passo e estude no seu ritmo.",
                    missoes: "Metas pequenas. Progresso de verdade.",
                    materias: "Organize os assuntos que você quer aprender.",
                    recompensas: "Escolha algo bom para celebrar seu esforço.",
                    conquistas: "Cada selo conta uma parte do seu caminho.",
                  }[view]
                }
              </p>
              <div className="em-mobile-xp">
                <span>Nível {stats.level}</span>
                <Bar
                  value={stats.levelProgress}
                  max={RULES.levelXp}
                  label="XP do nível"
                  xp
                />
                <span>
                  {stats.levelProgress}/{RULES.levelXp} XP
                </span>
              </div>
              <div className="em-live" aria-live="polite">
                {notice}
              </div>
              {error && !modal && (
                <p id="form-error" className="em-error" role="alert">
                  {error}
                </p>
              )}
              {legacyAvailable && pristine && (
                <section className="em-import-note">
                  <h2>Você tem dados da versão local</h2>
                  <p>
                    Eles não foram enviados para nenhuma conta. Importe somente
                    se forem seus; o destino será{" "}
                    <strong>{account.email}</strong>.
                  </p>
                  <button
                    className="em-link"
                    onClick={() => setModal({ type: "import" })}
                  >
                    Revisar importação
                  </button>
                </section>
              )}
              {!state.profile.name && (
                <section className="em-onboard">
                  <h2>Comece com seu nome</h2>
                  <p>
                    Escolha como quer aparecer. Seu progresso começa do zero e
                    fica associado à sua conta.
                  </p>
                  <button
                    className="em-create"
                    onClick={() => setModal({ type: "profile" })}
                  >
                    <UserRound />
                    Completar perfil
                  </button>
                </section>
              )}
              {view === "dia" && (
                <>
                  <section className="em-summary" aria-label="Resumo do dia">
                    <div>
                      <strong>{today.length}</strong>
                      <span>na lista do dia</span>
                    </div>
                    <div>
                      <strong>{completedToday}</strong>
                      <span>concluídas hoje</span>
                    </div>
                    <div>
                      <strong>{stats.xp}</strong>
                      <span>XP conquistados</span>
                    </div>
                  </section>
                  {focusPanel()}
                  <div className="em-section-head">
                    <h2>Seu próximo estudo</h2>
                    <button className="em-link" onClick={() => go("missoes")}>
                      Ver todas as missões →
                    </button>
                  </div>
                  {today.length ? (
                    <div className="em-missions">{missionCard(today[0])}</div>
                  ) : (
                    empty(
                      "Um espaço para seu próximo passo",
                      "Crie uma missão ou marque uma existente para sua lista do dia.",
                      active.length ? "Escolher missão" : "Criar missão",
                      () => (active.length ? go("missoes") : openMission()),
                    )
                  )}
                  {today.length > 1 && (
                    <section className="em-panel em-day-list">
                      <h2>Também na sua lista</h2>
                      <ul>
                        {today.slice(1, 4).map((m) => (
                          <li key={m.id}>
                            <span>{m.title}</span>
                            <small>
                              {m.progress}/{m.goal} {m.unit}
                            </small>
                          </li>
                        ))}
                      </ul>
                      {today.length > 4 && (
                        <p className="em-help">
                          Mais {today.length - 4} na tela de Missões.
                        </p>
                      )}
                    </section>
                  )}
                  <p className="em-help">
                    Sua lista do dia mantém o que você marcou até concluir ou
                    remover da lista. Agendamento por data virá depois.
                  </p>
                </>
              )}
              {view === "missoes" && (
                <>
                  <div className="em-tabs" aria-label="Filtrar missões">
                    {["ativas", "concluídas", "todas"].map((f) => (
                      <button
                        key={f}
                        aria-pressed={filter === f}
                        onClick={() => setFilter(f)}
                      >
                        {f[0].toUpperCase() + f.slice(1)} (
                        {
                          state.missions.filter(
                            (m) =>
                              f === "todas" ||
                              (f === "ativas"
                                ? m.progress < m.goal
                                : m.progress === m.goal),
                          ).length
                        }
                        )
                      </button>
                    ))}
                  </div>
                  <p className="em-help">
                    Regra inicial do protótipo: cada missão concede {RULES.xp}{" "}
                    XP e {RULES.gold} ouro uma única vez, ao atingir a meta.
                  </p>
                  {state.missions.filter(
                    (m) =>
                      filter === "todas" ||
                      (filter === "ativas"
                        ? m.progress < m.goal
                        : m.progress === m.goal),
                  ).length ? (
                    <div className="em-missions">
                      {state.missions
                        .filter(
                          (m) =>
                            filter === "todas" ||
                            (filter === "ativas"
                              ? m.progress < m.goal
                              : m.progress === m.goal),
                        )
                        .map(missionCard)}
                    </div>
                  ) : (
                    empty(
                      "Nenhuma missão por aqui",
                      "Comece com uma meta simples e possível.",
                      "Nova missão",
                      () => openMission(),
                    )
                  )}
                </>
              )}
              {view === "materias" && (
                <>
                  <button
                    className="em-create em-spaced"
                    onClick={() => setModal({ type: "subject" })}
                  >
                    <Plus />
                    Adicionar matéria
                  </button>
                  {state.subjects.length ? (
                    <div className="em-missions">
                      {state.subjects.map((s) => (
                        <article
                          className="em-mission em-subject-row"
                          key={s.id}
                        >
                          <span className="em-mission-icon">
                            <BookOpen />
                          </span>
                          <div>
                            <h2>{s.name}</h2>
                            <p>
                              {
                                state.missions.filter(
                                  (m) =>
                                    m.subjectId === s.id && m.progress < m.goal,
                                ).length
                              }{" "}
                              missões ativas
                            </p>
                          </div>
                          <button
                            className="em-icon-btn"
                            aria-label={`Editar ${s.name}`}
                            onClick={() =>
                              setModal({ type: "subject", item: s })
                            }
                          >
                            <Pencil />
                          </button>
                        </article>
                      ))}
                    </div>
                  ) : (
                    empty(
                      "O que você quer estudar?",
                      "Cadastre suas matérias para organizar as próximas missões.",
                    )
                  )}
                </>
              )}
              {view === "recompensas" && (
                <>
                  <button
                    className="em-create em-spaced"
                    onClick={() => setModal({ type: "reward" })}
                  >
                    <Plus />
                    Criar recompensa
                  </button>
                  <p className="em-help">
                    Você define o nome e o preço. O resgate é um registro
                    pessoal; não compra nem entrega produtos.
                  </p>
                  {state.rewards.length ? (
                    <div className="em-missions">
                      {state.rewards.map((r) => (
                        <article className="em-mission" key={r.id}>
                          <div className="em-mission-head">
                            <span className="em-mission-icon">
                              <Gift />
                            </span>
                            <div className="em-mission-text">
                              <h3>{r.name}</h3>
                              <p>{r.price} ouro</p>
                            </div>
                            <button
                              className="em-create"
                              disabled={busy || stats.gold < r.price}
                              onClick={() =>
                                mutate(
                                  { type: "redeem", id: id(), rewardId: r.id },
                                  `Resgate de “${r.name}” salvo no histórico.`,
                                )
                              }
                            >
                              {stats.gold < r.price
                                ? `Faltam ${r.price - stats.gold}`
                                : "Resgatar"}
                            </button>
                          </div>
                          <div className="em-row-actions">
                            <button
                              className="em-link"
                              onClick={() =>
                                setModal({ type: "reward", item: r })
                              }
                            >
                              <Pencil />
                              Editar
                            </button>
                            <button
                              className="em-link"
                              onClick={() =>
                                setModal({ type: "deleteReward", item: r })
                              }
                            >
                              <Trash2 />
                              Excluir
                            </button>
                          </div>
                        </article>
                      ))}
                    </div>
                  ) : (
                    empty(
                      "Uma recompensa com a sua cara",
                      "Pode ser um sorvete ou uma hora de videogame. Escolha algo que faça sentido para você.",
                    )
                  )}
                  <section className="em-panel em-spaced">
                    <h2>Histórico de resgates</h2>
                    {state.redemptions.length ? (
                      <ul className="em-history">
                        {[...state.redemptions].reverse().map((r) => (
                          <li key={r.id}>
                            <strong>{r.name}</strong>
                            <span>
                              −{r.price} ouro · {formatDate(r.redeemedAt)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="em-help">
                        Seus resgates aparecerão aqui. Ouro gasto não muda seu
                        XP ou nível.
                      </p>
                    )}
                  </section>
                </>
              )}
              {view === "conquistas" && (
                <>
                  <div className="em-achievements">
                    {achievements.map((a) => (
                      <article
                        key={a.name}
                        className={`em-panel ${a.unlocked ? "em-unlocked" : ""}`}
                      >
                        <span className="em-award-icon">{a.icon}</span>
                        <h2>{a.name}</h2>
                        <p>{a.description}</p>
                        <strong>
                          {a.unlocked
                            ? "Conquistada"
                            : `Em progresso · ${a.progress}`}
                        </strong>
                      </article>
                    ))}
                  </div>
                  <section className="em-panel em-spaced">
                    <h2>Seu histórico de estudo</h2>
                    <p className="em-help">
                      {stats.completed} missões premiadas ·{" "}
                      {state.focusSessions.length} sessões de foco encerradas.
                      Tempo de foco é apenas um registro do timer.
                    </p>
                    {state.awards.length ? (
                      <ul className="em-history">
                        {[...state.awards].reverse().map((a) => (
                          <li key={a.missionId}>
                            <strong>{a.title}</strong>
                            <span>
                              +{a.xp} XP · +{a.gold} ouro ·{" "}
                              {formatDate(a.completedAt)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="em-help">
                        Nenhuma missão concluída ainda. Seu primeiro passo
                        conta.
                      </p>
                    )}
                  </section>
                </>
              )}
              <footer className="em-local-note">
                Dados associados a {account.email}. Alterações só são
                confirmadas depois de salvas.{" "}
                <button className="em-link" onClick={() => exportBackup()}>
                  Exportar cópia
                </button>
              </footer>
            </main>
            <aside className="em-side" aria-label="Seu progresso">
              <section className="em-panel">
                <div className="em-profile-header">
                  <div className="em-avatar">
                    {state.profile.avatar}
                    <span className="em-level-badge">{stats.level}</span>
                  </div>
                  <div>
                    <div className="em-person-name">
                      {state.profile.name || "Seu perfil"}
                    </div>
                    <div className="em-level-name">Nível {stats.level}</div>
                  </div>
                </div>
                <div className="em-xp-label">
                  <span>Próximo nível</span>
                  <span>
                    {stats.levelProgress}/{RULES.levelXp} XP
                  </span>
                </div>
                <Bar
                  value={stats.levelProgress}
                  max={RULES.levelXp}
                  label="Experiência no nível"
                  xp
                />
                <p className="em-help">
                  Faltam {RULES.levelXp - stats.levelProgress} XP para o nível{" "}
                  {stats.level + 1}.
                </p>
                <button
                  className="em-link"
                  onClick={() => setModal({ type: "profile" })}
                >
                  Editar perfil →
                </button>
              </section>
              <section className="em-panel">
                <h2>Seu caminho</h2>
                <p className="em-help">{stats.completed} missões premiadas.</p>
                <p className="em-help">
                  {new Set(state.awards.map((a) => a.day)).size} dias com
                  conclusões.
                </p>
                <p className="em-help">
                  {state.focusSessions.length} sessões de foco encerradas.
                </p>
              </section>
              <section className="em-panel">
                <h2>Uma recompensa sua</h2>
                <div className="em-reward-icon">
                  <Gift />
                </div>
                <div className="em-reward-line">
                  <span>{nextReward?.name || "Você escolhe"}</span>
                  {nextReward && <span>{nextReward.price} ouro</span>}
                </div>
                <p className="em-help">
                  {nextReward
                    ? stats.gold >= nextReward.price
                      ? "Seu saldo já permite esse resgate."
                      : `Faltam ${nextReward.price - stats.gold} ouro.`
                    : "Crie sua primeira recompensa pessoal."}
                </p>
                <button className="em-link" onClick={() => go("recompensas")}>
                  Ver recompensas →
                </button>
              </section>
              <p className="em-help">
                Regras iniciais: {RULES.xp} XP + {RULES.gold} ouro por missão;
                um nível a cada {RULES.levelXp} XP. Valores do protótipo,
                sujeitos a revisão.
              </p>
            </aside>
          </div>
          {nav(true)}
        </div>
      </div>
      {modal && (
        <Modal
          title={
            {
              progress: "Registrar progresso",
              import: "Importar dados locais",
              deleteMission: "Excluir missão?",
              deleteReward: "Excluir recompensa?",
              profile: "Seu perfil",
              subject: modal.item ? "Editar matéria" : "Nova matéria",
              mission: modal.item ? "Editar missão" : "Nova missão",
              reward: modal.item ? "Editar recompensa" : "Nova recompensa",
            }[modal.type]
          }
          close={() => setModal(null)}
        >
          <form
            onSubmit={submit}
            aria-describedby={error ? "form-error" : undefined}
          >
            {modal.type === "import" && (
              <>
                <p>
                  Essa importação copia os dados locais antigos para{" "}
                  <strong>{account.email}</strong>. A cópia original permanece
                  no navegador. Contas com dados não serão sobrescritas.
                </p>
                <label>
                  Digite o email da conta para confirmar
                  <input
                    name="confirmEmail"
                    type="email"
                    required
                    autoComplete="off"
                  />
                </label>
                <label className="em-import-consent">
                  <input type="checkbox" required />
                  Confirmo que os dados locais são meus e devem ir para esta
                  conta.
                </label>
              </>
            )}
            {(modal.type === "deleteMission" ||
              modal.type === "deleteReward") && (
              <div className="em-delete-copy">
                <strong>{modal.item.title || modal.item.name}</strong>
                <p>
                  Essa ação remove o item. O histórico de XP, ouro e resgates já
                  registrados permanece preservado.
                </p>
              </div>
            )}
            {modal.type === "progress" && (
              <>
                <p>{modal.item.title}</p>
                <label>
                  Quantidade de {modal.item.unit} concluídos agora
                  <input
                    name="amount"
                    type="number"
                    min={1}
                    max={modal.item.goal - modal.item.progress}
                    step={1}
                    defaultValue={1}
                    required
                    autoFocus
                  />
                </label>
                <p className="em-help">
                  {modal.item.progress}/{modal.item.goal} registrados. Ao
                  atingir a meta, a missão é concluída.
                </p>
              </>
            )}
            {modal.type === "profile" && (
              <>
                <label>
                  Como você quer ser chamado?
                  <input
                    name="name"
                    defaultValue={state.profile.name}
                    required
                    maxLength={40}
                    autoFocus
                  />
                </label>
                <label>
                  Seu avatar
                  <select name="avatar" defaultValue={state.profile.avatar}>
                    {AVATARS.map((a) => (
                      <option key={a}>{a}</option>
                    ))}
                  </select>
                </label>
                <p className="em-help">
                  Perfil de {account.email}. Alterações serão salvas {account.mode === "local" ? "neste computador." : "no Supabase."}
                </p>
              </>
            )}
            {modal.type === "subject" && (
              <label>
                Nome da matéria
                <input
                  name="name"
                  defaultValue={modal.item?.name || ""}
                  placeholder="Ex.: Matemática"
                  required
                  maxLength={40}
                  autoFocus
                />
              </label>
            )}
            {modal.type === "mission" && (
              <>
                <label>
                  Título
                  <input
                    name="title"
                    defaultValue={modal.item?.title || ""}
                    required
                    maxLength={80}
                    placeholder="Ex.: Resolver exercícios de frações"
                    autoFocus
                  />
                </label>
                <label>
                  Matéria
                  <select
                    name="subjectId"
                    defaultValue={
                      modal.item?.subjectId || state.subjects[0]?.id
                    }
                  >
                    {state.subjects.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="em-fields">
                  <label>
                    Meta
                    <input
                      name="goal"
                      type="number"
                      min={1}
                      max={10000}
                      step={1}
                      defaultValue={modal.item?.goal || 5}
                      required
                      disabled={
                        !!modal.item &&
                        state.awards.some((a) => a.missionId === modal.item.id)
                      }
                    />
                  </label>
                  <label>
                    Unidade
                    <input
                      name="unit"
                      defaultValue={modal.item?.unit || "exercícios"}
                      maxLength={25}
                      required
                      placeholder="páginas, exercícios…"
                    />
                  </label>
                </div>
                <p className="em-help">
                  {RULES.xp} XP e {RULES.gold} ouro ao atingir a meta, apenas
                  uma vez. A meta fica fixa depois da primeira premiação.
                </p>
              </>
            )}
            {modal.type === "reward" && (
              <>
                <label>
                  Nome da recompensa
                  <input
                    name="name"
                    required
                    maxLength={80}
                    defaultValue={modal.item?.name || ""}
                    placeholder="Ex.: Uma hora de videogame"
                    autoFocus
                  />
                </label>
                <label>
                  Preço em ouro
                  <input
                    type="number"
                    name="price"
                    min={1}
                    max={1000000}
                    step={1}
                    required
                    defaultValue={modal.item?.price || 20}
                  />
                </label>
                <p className="em-help">
                  Você decide o preço. O valor sugerido é só um exemplo.
                </p>
              </>
            )}
            {error && (
              <p id="form-error" className="em-error" role="alert">
                {error}
              </p>
            )}
            <div className="em-dialog-actions">
              <button className="em-create" type="submit" disabled={busy}>
                {busy
                  ? "Salvando…"
                  : modal.type.startsWith("delete")
                    ? "Confirmar exclusão"
                    : "Salvar"}
              </button>
              <button
                className="em-cancel"
                type="button"
                onClick={() => setModal(null)}
              >
                Cancelar
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
