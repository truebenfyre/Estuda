// Browser-only visual test harness. Not imported by Next.js or served by the application.
import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import StudyApp from "../components/study-app";
import { initialState, transition, deserialize, serialize } from "../lib/model";
import "../app/globals.css";
const account = { id: "visual-test-only", email: "layout-qa@example.test" };
let state = transition(initialState(), {
    type: "profile",
    name: "Estudante QA",
    avatar: "🦉",
  }),
  revision = 0;
state = transition(state, { type: "subject", id: "math", name: "Matemática" });
for (let i = 0; i < 12; i++)
  state = transition(state, {
    type: "mission",
    id: "m" + i,
    title:
      i === 0 ? "Resolver exercícios de frações" : `Revisar capítulo ${i + 1}`,
    subjectId: "math",
    goal: 5,
    unit: "exercícios",
  });
state = transition(state, {
  type: "reward",
  id: "r1",
  name: "Uma pausa para sorvete",
  price: 20,
});
const transport = {
  load: async () => ({
    state: deserialize(serialize(state)),
    revision,
    userId: account.id,
  }),
  apply: async (action, expected) => {
    if (expected !== revision) throw new Error("Dados mudaram");
    state = transition(state, action);
    revision++;
    return { state, revision, userId: account.id };
  },
};
function Fixture() {
  const [path, setPath] = useState("/meu-dia");
  useEffect(() => {
    const onPop = () => setPath(location.pathname);
    addEventListener("popstate", onPop);
    return () => removeEventListener("popstate", onPop);
  }, []);
  function navigate(next, replace = false) {
    history[replace ? "replaceState" : "pushState"]({}, "", next);
    setPath(next);
  }
  function Link({ href, onClick, children, ...props }) {
    return (
      <a
        {...props}
        href={href}
        onClick={(e) => {
          e.preventDefault();
          onClick?.();
          navigate(href);
        }}
      >
        {children}
      </a>
    );
  }
  return (
    <>
      <div
        style={{
          position: "fixed",
          bottom: 2,
          right: 10,
          zIndex: 100,
          fontSize: 10,
          pointerEvents: "none",
          color: "#777",
        }}
      >
        QA visual · dados fictícios · sem autenticação real
      </div>
      <StudyApp
        account={account}
        configured
        transport={transport}
        auth={{
          signOut: async () => ({
            error: "Este é apenas o cenário de QA visual.",
          }),
        }}
        pathname={path}
        navigate={navigate}
        LinkComponent={Link}
      />
    </>
  );
}
createRoot(document.getElementById("root")).render(<Fixture />);
