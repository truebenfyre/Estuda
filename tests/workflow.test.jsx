import test from "node:test";
import assert from "node:assert/strict";
import { Window } from "happy-dom";
import React, { act, useState } from "react";
import { createRoot } from "react-dom/client";
import StudyApp from "../components/study-app.jsx";
import {
  STORAGE_KEY,
  totals,
  initialState,
  transition,
  serialize,
  deserialize,
} from "../lib/model.js";
function dom() {
  const win = new Window({ url: "http://localhost:3210/" });
  for (const key of [
    "window",
    "document",
    "navigator",
    "localStorage",
    "location",
    "FormData",
    "HTMLElement",
    "HTMLInputElement",
  ])
    Object.defineProperty(globalThis, key, {
      configurable: true,
      value: key === "window" ? win : win[key],
    });
  globalThis.addEventListener = win.addEventListener.bind(win);
  globalThis.removeEventListener = win.removeEventListener.bind(win);
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement("div");
  document.body.appendChild(container);
  return { win, container };
}
test("account workflow saves remotely, preserves legacy data, keeps shell across routes and handles logout", async () => {
  const { win, container } = dom();
  let root = createRoot(container);
  let state = initialState(),
    revision = 0;
  const account = { id: "test-user", email: "qa@example.test" };
  const legacy = serialize({
    ...initialState(),
    profile: { name: "Legacy owner", avatar: "🌱" },
  });
  localStorage.setItem(STORAGE_KEY, legacy);
  const transport = {
    load: async () => ({
      state: deserialize(serialize(state)),
      revision,
      userId: account.id,
    }),
    apply: async (action, expected) => {
      assert.equal(expected, revision);
      state = transition(state, action);
      revision++;
      return { state, revision, userId: account.id };
    },
  };
  let visit;
  let signedOut = false;
  function Harness() {
    const [pathname, setPath] = useState("/meu-dia");
    visit = setPath;
    return (
      <StudyApp
        account={account}
        configured
        auth={{
          signOut: async () => {
            signedOut = true;
            return { ok: true };
          },
        }}
        transport={transport}
        pathname={pathname}
        navigate={setPath}
      />
    );
  }
  const button = (text) =>
    [...document.querySelectorAll("button")].find(
      (b) => b.textContent.trim() === text,
    );
  const click = async (b) => {
    assert.ok(b);
    await act(async () => b.click());
  };
  const field = (name, value) => {
    const el = document.querySelector(`dialog [name="${name}"]`);
    assert.ok(el, name);
    el.value = String(value);
  };
  const submit = async () => {
    await act(async () =>
      document
        .querySelector("dialog form")
        .dispatchEvent(
          new win.Event("submit", { bubbles: true, cancelable: true }),
        ),
    );
  };
  try {
    await act(async () => root.render(<Harness />));
    assert.equal(localStorage.getItem(STORAGE_KEY), legacy);
    assert.equal(state.profile.name, "");
    assert.match(container.textContent, /Revisar importação/);
    const header = document.querySelector(".em-top");
    await click(button("Completar perfil"));
    field("name", "Peterson");
    field("avatar", "🦊");
    await submit();
    assert.equal(state.profile.name, "Peterson");
    await click(button("Nova missão"));
    field("name", "Matemática");
    await submit();
    await act(async () => visit("/missoes"));
    assert.equal(document.querySelector(".em-top"), header);
    assert.equal(
      document.querySelector('a[aria-current="page"]').getAttribute("href"),
      "/missoes",
    );
    await click(button("Nova missão"));
    field("title", "Frações");
    field("goal", 1);
    field("unit", "exercício");
    await submit();
    await click(
      document.querySelector(
        '[aria-label="Registrar mais uma unidade em Frações"]',
      ),
    );
    assert.equal(totals(state).xp, 25);
    await act(async () => visit("/recompensas"));
    await click(button("Criar recompensa"));
    field("name", "Sorvete");
    field("price", 10);
    await submit();
    await click(button("Resgatar"));
    assert.equal(totals(state).gold, 0);
    assert.equal(totals(state).xp, 25);
    await click(document.querySelector('[aria-label="Ativar modo escuro"]'));
    assert.equal(state.theme, "dark");
    await act(async () => root.unmount());
    root = createRoot(container);
    await act(async () => root.render(<Harness />));
    assert.match(container.textContent, /Peterson/);
    assert.equal(document.documentElement.dataset.theme, "dark");
    assert.equal(state.awards.length, 1);
    await click(document.querySelector('[aria-label="Sair da conta"]'));
    assert.equal(signedOut, true);
    assert.equal(localStorage.getItem(STORAGE_KEY), legacy);
  } finally {
    await act(async () => root.unmount());
    await win.happyDOM.close();
  }
});
test("unconfigured login never collects a password or pretends authentication; legacy data remains", async () => {
  const { win, container } = dom();
  const root = createRoot(container);
  localStorage.setItem(STORAGE_KEY, "preserve-me");
  let authCalls = 0;
  try {
    await act(async () =>
      root.render(
        <StudyApp
          pathname="/login"
          navigate={() => {}}
          configured={false}
          auth={{
            signIn: async () => {
              authCalls++;
            },
          }}
        />,
      ),
    );
    assert.match(container.textContent, /Supabase ainda não foi configurado/);
    assert.equal(
      document.querySelector('input[name="password"]').disabled,
      true,
    );
    assert.equal(
      document.querySelector('button[type="submit"]').disabled,
      true,
    );
    assert.equal(localStorage.getItem(STORAGE_KEY), "preserve-me");
    assert.equal(authCalls, 0);
    const signup = [...document.querySelectorAll("button")].find(
      (x) => x.textContent === "Criar uma conta",
    );
    await act(async () => signup.click());
    assert.ok(document.querySelector('input[name="confirmPassword"]'));
    assert.equal(authCalls, 0);
  } finally {
    await act(async () => root.unmount());
    await win.happyDOM.close();
  }
});

test("auth failures stay inline and passwords never enter local storage", async () => {
  const { win, container } = dom();
  const root = createRoot(container);
  let calls = 0;
  try {
    await act(async () =>
      root.render(
        <StudyApp
          pathname="/login"
          navigate={() => {}}
          configured
          auth={{
            signIn: async (data) => {
              calls++;
              assert.equal(data.get("email"), "qa@example.test");
              return { error: "Email ou senha inválidos." };
            },
          }}
        />,
      ),
    );
    document.querySelector('[name="email"]').value = "qa@example.test";
    document.querySelector('[name="password"]').value = "test-password-only";
    await act(async () =>
      document
        .querySelector("form")
        .dispatchEvent(
          new win.Event("submit", { bubbles: true, cancelable: true }),
        ),
    );
    assert.equal(calls, 1);
    assert.match(
      document.querySelector('[role="alert"]').textContent,
      /Email ou senha/,
    );
    assert.equal(localStorage.length, 0);
  } finally {
    await act(async () => root.unmount());
    await win.happyDOM.close();
  }
});
