"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import Alert from "../components/Alert";
import AuthForm from "../components/AuthForm";
import { useAuth } from "../context/AuthContext";
import { isStrongPassword, normalizeError, PASSWORD_RULE_TEXT } from "../lib/utils";

export default function LoginPage() {
  const { auth, updateAuth, request, loadProfile } = useAuth();
  const router = useRouter();
  const [authMode, setAuthMode] = useState("login");
  const [authForm, setAuthForm] = useState({
    username: "",
    email: "",
    password: "",
    password_two: "",
    first_name: "",
    last_name: "",
  });
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (auth) router.replace("/");
  }, [auth, router]);

  if (auth) return null;

  async function handleAuthSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setStatus("");
    try {
      if (authMode === "register") {
        if (!isStrongPassword(authForm.password)) {
          setError(PASSWORD_RULE_TEXT);
          return;
        }
        await request("/auth/register/", { method: "POST", body: JSON.stringify(authForm) }, false);
        setStatus("Cuenta creada. Ya puedes iniciar sesión.");
        setAuthMode("login");
        setAuthForm((current) => ({ ...current, password: "", password_two: "" }));
        return;
      }

      const tokens = await request(
        "/auth/login/",
        {
          method: "POST",
          body: JSON.stringify({
            username: authForm.username,
            password: authForm.password,
          }),
        },
        false,
      );
      const session = await loadProfile(tokens);
      updateAuth(session);
      router.replace("/");
    } catch (err) {
      setError(normalizeError(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen text-slate-950">
      <Alert status={status} error={error} onClose={() => { setError(""); setStatus(""); }} />
      <div className="mx-auto grid w-full max-w-5xl gap-5 px-4 py-8 sm:px-6 lg:grid-cols-[minmax(0,1fr)_420px] lg:px-8">
        <section className="panel flex flex-col justify-center">
          <div className="login-logo-wrap mb-6">
            <Image
              src="/logo_aps.jpeg"
              alt="Logotipo de APS"
              width={112}
              height={112}
              className="login-logo"
              priority
            />
          </div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-700">Acceso</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-normal text-slate-950 sm:text-4xl">
            Inicia sesión en la asociación.
          </h1>
          <p className="mt-4 text-base text-slate-600">
            Entra con tu usuario para volver al calendario, tu perfil, biblioteca, plenos y el resto de secciones.
          </p>
        </section>

        <section className="panel">
          <h2 className="text-2xl font-semibold text-slate-950">Iniciar sesión</h2>
          <p className="mt-2 text-sm text-slate-600">
            También puedes crear una cuenta nueva si aún no tienes acceso.
          </p>
          <div className="mt-5">
            <AuthForm
              authForm={authForm}
              authMode={authMode}
              saving={saving}
              setAuthForm={setAuthForm}
              setAuthMode={setAuthMode}
              onSubmit={handleAuthSubmit}
            />
          </div>
        </section>
      </div>
    </main>
  );
}
