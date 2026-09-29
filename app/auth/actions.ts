"use server";
import { revalidatePath } from "next/cache";
import {
  authConfigured,
  appUrl,
  supabaseServer,
} from "../../lib/supabase/server";

function credentials(data: FormData) {
  const email = String(data.get("email") || "").trim();
  const password = String(data.get("password") || "");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254)
    throw new Error("Informe um email válido.");
  if (password.length < 8 || password.length > 128)
    throw new Error("Use uma senha entre 8 e 128 caracteres.");
  return { email, password };
}
const missing = () => ({
  error:
    "O acesso ainda não está configurado. Falta conectar o projeto Supabase de Estuda.",
});
export async function signIn(data: FormData) {
  if (!authConfigured()) return missing();
  try {
    const values = credentials(data);
    const client = await supabaseServer();
    const { error } = await client.auth.signInWithPassword(values);
    if (error)
      return {
        error:
          error.code === "email_not_confirmed"
            ? "Confirme seu email antes de entrar."
            : "Não foi possível entrar. Confira email e senha ou tente novamente mais tarde.",
      };
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    return {
      error:
        (e instanceof Error && e.message.startsWith("Informe")) ||
        (e instanceof Error && e.message.startsWith("Use uma"))
          ? (e as Error).message
          : "Não foi possível conectar. Tente novamente.",
    };
  }
}
export async function signUp(data: FormData) {
  if (!authConfigured()) return missing();
  try {
    const values = credentials(data);
    if (values.password !== String(data.get("confirmPassword") || ""))
      return { error: "As senhas precisam ser iguais." };
    const client = await supabaseServer();
    const { data: result, error } = await client.auth.signUp({
      ...values,
      options: { emailRedirectTo: `${appUrl()}/auth/callback` },
    });
    if (error)
      return {
        error:
          "Não foi possível criar a conta. Verifique os dados e tente novamente mais tarde.",
      };
    revalidatePath("/", "layout");
    return result.session
      ? { ok: true }
      : {
          message:
            "Se o cadastro puder ser concluído, você receberá um email de confirmação. Abra o link neste navegador para continuar.",
        };
  } catch {
    return {
      error: "Confira o email e use uma senha entre 8 e 128 caracteres.",
    };
  }
}
export async function signOut() {
  if (!authConfigured()) return missing();
  try {
    const client = await supabaseServer();
    const { error } = await client.auth.signOut({ scope: "local" });
    if (error) return { error: "Não foi possível sair. Tente novamente." };
    revalidatePath("/", "layout");
    return { ok: true };
  } catch {
    return { error: "Não foi possível conectar para sair." };
  }
}
export async function requestPasswordReset(data: FormData) {
  if (!authConfigured()) return missing();
  const email = String(data.get("email") || "").trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return { error: "Informe um email válido." };
  try {
    const client = await supabaseServer();
    const { error } = await client.auth.resetPasswordForEmail(email, {
      redirectTo: `${appUrl()}/auth/callback?next=/recuperar-senha`,
    });
    if (error)
      return {
        error:
          "Não foi possível solicitar a recuperação agora. Tente novamente mais tarde.",
      };
    return {
      message:
        "Se houver uma conta para esse email, você receberá o link para redefinir sua senha.",
    };
  } catch {
    return { error: "Não foi possível conectar. Tente novamente." };
  }
}
export async function updatePassword(data: FormData) {
  if (!authConfigured()) return missing();
  const password = String(data.get("password") || "");
  if (password.length < 8 || password.length > 128)
    return { error: "Use uma senha entre 8 e 128 caracteres." };
  if (password !== String(data.get("confirmPassword") || ""))
    return { error: "As senhas precisam ser iguais." };
  try {
    const client = await supabaseServer();
    const {
      data: { user },
    } = await client.auth.getUser();
    if (!user)
      return { error: "O link expirou. Solicite outro link de recuperação." };
    const { error } = await client.auth.updateUser({ password });
    if (error)
      return {
        error:
          "Não foi possível atualizar a senha. Escolha outra senha ou solicite um novo link.",
      };
    revalidatePath("/", "layout");
    return { ok: true };
  } catch {
    return { error: "Não foi possível conectar. Tente novamente." };
  }
}
