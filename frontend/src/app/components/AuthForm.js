"use client";

export default function AuthForm({ authForm, authMode, saving, setAuthForm, setAuthMode, onSubmit }) {
  const isRegister = authMode === "register";
  return (
    <div>
      <div className="segmented" role="tablist" aria-label="Autenticacion">
        <button className={authMode === "login" ? "active" : ""} type="button" onClick={() => setAuthMode("login")}>
          Acceder
        </button>
        <button className={isRegister ? "active" : ""} type="button" onClick={() => setAuthMode("register")}>
          Registro
        </button>
      </div>
      <form className="mt-4 flex flex-col gap-3" onSubmit={onSubmit}>
        <label className="field">
          <span>Usuario</span>
          <input autoComplete="username" required value={authForm.username}
            onChange={(e) => setAuthForm((c) => ({ ...c, username: e.target.value }))} />
        </label>
        {isRegister && (
          <>
            <label className="field">
              <span>Email</span>
              <input autoComplete="email" type="email" required value={authForm.email}
                onChange={(e) => setAuthForm((c) => ({ ...c, email: e.target.value }))} />
            </label>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              <label className="field">
                <span>Nombre</span>
                <input value={authForm.first_name} onChange={(e) => setAuthForm((c) => ({ ...c, first_name: e.target.value }))} />
              </label>
              <label className="field">
                <span>Apellidos</span>
                <input value={authForm.last_name} onChange={(e) => setAuthForm((c) => ({ ...c, last_name: e.target.value }))} />
              </label>
            </div>
          </>
        )}
        <label className="field">
          <span>Contraseña</span>
          <input autoComplete={isRegister ? "new-password" : "current-password"} required type="password"
            value={authForm.password} onChange={(e) => setAuthForm((c) => ({ ...c, password: e.target.value }))} />
        </label>
        {isRegister && (
          <label className="field">
            <span>Repetir contraseña</span>
            <input autoComplete="new-password" required type="password"
              value={authForm.password_two} onChange={(e) => setAuthForm((c) => ({ ...c, password_two: e.target.value }))} />
          </label>
        )}
        <button className="btn btn-primary" type="submit" disabled={saving}>
          {saving ? "Procesando..." : isRegister ? "Crear cuenta" : "Entrar"}
        </button>
      </form>
    </div>
  );
}
