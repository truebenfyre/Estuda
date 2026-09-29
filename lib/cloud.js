async function request(endpoint, options) {
  let response;
  try {
    response = await fetch(endpoint, {
      cache: "no-store",
      credentials: "same-origin",
      ...options,
    });
  } catch {
    throw new Error(
      "Sem conexão com o servidor. A alteração não foi salva; tente novamente.",
    );
  }
  const result = await response.json();
  if (!response.ok) {
    const error = new Error(
      result.error || "Não foi possível acessar seus dados.",
    );
    error.status = response.status;
    throw error;
  }
  return result;
}
export const createTransport = (endpoint) => ({
  load: () => request(endpoint),
  apply: (action, revision) =>
    request(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, revision }),
    }),
  importLegacy: (state, revision, confirmEmail) =>
    request(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ importState: state, revision, confirmEmail }),
    }),
});
export const cloud = createTransport("/api/state");
export const local = createTransport("/api/local/state");
