"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../context/AuthContext";
import Alert from "../components/Alert";
import { normalizeError } from "../lib/utils";

export default function LoginPage() {
  const { auth, updateAuth, request, loadProfile } = useAuth();
  const router = useRouter();

  const [authMode, setAuthMode] = useState("login");
  const [form, setForm] = useState({ username: "", email: "", password: "", password_two: "", first_name: "", last_name: "" });
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (auth) router.replace("/");
  }, [auth, router]);

  const isRegister = authMode === "register";

  if (auth) return null;

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setStatus("");
    try {
      if (isRegister) {
        if (form.password !== form.password_two) {
          setError("Las contraseñas no coinciden.");
          setSaving(false);
          return;
        }
        await request("/auth/register/", { method: "POST", body: JSON.stringify(form) }, false);
        setStatus("Cuenta creada. Ya puedes iniciar sesión.");
        setAuthMode("login");
        setForm((c) => ({ ...c, password: "", password_two: "" }));
        return;
      }
      const tokens = await request("/auth/login/", {
        method: "POST",
        body: JSON.stringify({ username: form.username, password: form.password }),
      }, false);
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
    <main className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-slate-900">Asociación Vecinal 3C</h1>
          <p className="text-sm text-slate-500 mt-1">Accede a tu cuenta o regístrate</p>
        </div>

        <Alert status={status} error={error} onClose={() => { setError(""); setStatus(""); }} />

        <div className="panel mt-4">
          <div className="segmented mb-6" role="tablist">
            <button className={authMode === "login" ? "active" : ""} type="button" onClick={() => setAuthMode("login")}>
              Acceder
            </button>
            <button className={isRegister ? "active" : ""} type="button" onClick={() => setAuthMode("register")}>
              Registro
            </button>
          </div>

          <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
            <label className="field">
              <span>Usuario</span>
              <input autoComplete="username" required value={form.username}
                onChange={(e) => setForm((c) => ({ ...c, username: e.target.value }))}
                disabled={saving} />
            </label>

            {isRegister && (
              <>
                <label className="field">
                  <span>Email</span>
                  <input autoComplete="email" type="email" required value={form.email}
                    onChange={(e) => setForm((c) => ({ ...c, email: e.target.value }))}
                    disabled={saving} />
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="field">
                    <span>Nombre</span>
                    <input value={form.first_name}
                      onChange={(e) => setForm((c) => ({ ...c, first_name: e.target.value }))}
                      disabled={saving} />
                  </label>
                  <label className="field">
                    <span>Apellidos</span>
                    <input value={form.last_name}
                      onChange={(e) => setForm((c) => ({ ...c, last_name: e.target.value }))}
                      disabled={saving} />
                  </label>
                </div>
              </>
            )}

            <label className="field">
              <span>Contraseña</span>
              <input autoComplete={isRegister ? "new-password" : "current-password"}
                required type="password" value={form.password}
                onChange={(e) => setForm((c) => ({ ...c, password: e.target.value }))}
                disabled={saving} />
            </label>

            {isRegister && (
              <label className="field">
                <span>Repetir contraseña</span>
                <input autoComplete="new-password" required type="password" value={form.password_two}
                  onChange={(e) => setForm((c) => ({ ...c, password_two: e.target.value }))}
                  disabled={saving} />
              </label>
            )}

            <button className="btn btn-primary mt-1" type="submit" disabled={saving}>
              {saving ? "Procesando..." : isRegister ? "Crear cuenta" : "Entrar"}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
