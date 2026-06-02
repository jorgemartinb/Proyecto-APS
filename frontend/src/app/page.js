"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "/api";
const STORAGE_KEY = "aps_reservas_auth";
const DAY_FORMAT = new Intl.DateTimeFormat("es-ES", {
  weekday: "long",
  day: "numeric",
  month: "long",
});
const MONTH_FORMAT = new Intl.DateTimeFormat("es-ES", {
  month: "long",
  year: "numeric",
});
const TIME_FORMAT = new Intl.DateTimeFormat("es-ES", {
  hour: "2-digit",
  minute: "2-digit",
});
const WEEKDAYS = ["Lun", "Mar", "Mie", "Jue", "Vie", "Sab", "Dom"];

function pad(value) {
  return String(value).padStart(2, "0");
}

function dateKey(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function monthKey(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
}

function toDateTimeLocal(value) {
  const date = value ? new Date(value) : new Date();
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function addMinutes(localValue, minutes) {
  const date = new Date(localValue);
  date.setMinutes(date.getMinutes() + minutes);
  return toDateTimeLocal(date);
}

function createDefaultForm(selectedDate) {
  const start = new Date(selectedDate);
  start.setHours(9, 0, 0, 0);
  const end = new Date(start);
  end.setHours(10, 0, 0, 0);

  return {
    title: "",
    start_time: toDateTimeLocal(start),
    end_time: toDateTimeLocal(end),
  };
}

function getStoredAuth() {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveStoredAuth(auth) {
  if (typeof window === "undefined") return;

  if (auth) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(auth));
  } else {
    window.localStorage.removeItem(STORAGE_KEY);
  }
}

function normalizeError(error) {
  if (!error || typeof error !== "object") return "No se pudo completar la accion.";
  if (error.detail) return error.detail;
  if (error.non_field_errors) return Array.isArray(error.non_field_errors) ? error.non_field_errors.join(" ") : error.non_field_errors;

  return Object.entries(error)
    .map(([field, value]) => `${field}: ${Array.isArray(value) ? value.join(" ") : value}`)
    .join(" ");
}

function buildCalendarDays(viewDate) {
  const first = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1);
  const start = new Date(first);
  const day = (first.getDay() + 6) % 7;
  start.setDate(first.getDate() - day);

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return date;
  });
}

function groupByDay(reservations) {
  return reservations.reduce((days, reservation) => {
    const key = dateKey(new Date(reservation.start_time));
    days[key] = days[key] || [];
    days[key].push(reservation);
    return days;
  }, {});
}

function sortReservations(reservations) {
  return [...reservations].sort((a, b) => new Date(a.start_time) - new Date(b.start_time));
}

export default function Home() {
  const today = useMemo(() => new Date(), []);
  const [auth, setAuth] = useState(null);
  const [authMode, setAuthMode] = useState("login");
  const [authForm, setAuthForm] = useState({
    username: "",
    email: "",
    password: "",
    password_two: "",
    first_name: "",
    last_name: "",
  });
  const [reservations, setReservations] = useState([]);
  const [selectedDate, setSelectedDate] = useState(today);
  const [viewDate, setViewDate] = useState(today);
  const [form, setForm] = useState(() => createDefaultForm(today));
  const [editingId, setEditingId] = useState(null);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const currentUser = auth?.profile?.username;

  const updateAuth = useCallback((nextAuth) => {
    setAuth(nextAuth);
    saveStoredAuth(nextAuth);
  }, []);

  const request = useCallback(
    async (path, options = {}, retry = true) => {
      const send = (accessToken) => {
        const headers = new Headers(options.headers || {});
        if (!(options.body instanceof FormData)) {
          headers.set("Content-Type", "application/json");
        }
        if (accessToken) {
          headers.set("Authorization", `Bearer ${accessToken}`);
        }

        return fetch(`${API_BASE}${path}`, {
          ...options,
          headers,
        });
      };

      let response = await send(auth?.access);

      if (response.status === 401 && retry && auth?.refresh) {
        const refreshResponse = await fetch(`${API_BASE}/auth/token/refresh/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refresh: auth.refresh }),
        });

        if (refreshResponse.ok) {
          const tokenData = await refreshResponse.json();
          const refreshedAuth = { ...auth, access: tokenData.access };
          updateAuth(refreshedAuth);
          response = await send(tokenData.access);
        } else {
          updateAuth(null);
        }
      }

      if (!response.ok) {
        let payload = null;
        try {
          payload = await response.json();
        } catch {
          payload = { detail: response.statusText };
        }
        throw payload;
      }

      if (response.status === 204 || response.status === 205) return null;
      return response.json();
    },
    [auth, updateAuth],
  );

  const loadReservations = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const data = await request("/reservations/");
      setReservations(sortReservations(data));
    } catch (err) {
      setError(`No se pudieron cargar las reservas. ${normalizeError(err)}`);
    } finally {
      setLoading(false);
    }
  }, [request]);

  const loadProfile = useCallback(
    async (session) => {
      const profileResponse = await fetch(`${API_BASE}/user/profile/`, {
        headers: { Authorization: `Bearer ${session.access}` },
      });

      if (!profileResponse.ok) throw new Error("No se pudo cargar el perfil");
      const profile = await profileResponse.json();
      return { ...session, profile };
    },
    [],
  );

  useEffect(() => {
    const stored = getStoredAuth();
    if (!stored?.access) return;

    loadProfile(stored)
      .then(updateAuth)
      .catch(() => updateAuth(null));
  }, [loadProfile, updateAuth]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadReservations();
  }, [loadReservations]);

  const calendarDays = useMemo(() => buildCalendarDays(viewDate), [viewDate]);
  const reservationsByDay = useMemo(() => groupByDay(reservations), [reservations]);
  const selectedKey = dateKey(selectedDate);
  const todaysReservations = reservationsByDay[selectedKey] || [];
  const myReservations = useMemo(
    () => reservations.filter((reservation) => reservation.user_username === currentUser),
    [currentUser, reservations],
  );
  const upcomingReservations = useMemo(
    () => reservations.filter((reservation) => new Date(reservation.end_time) >= new Date()).slice(0, 6),
    [reservations],
  );

  async function handleAuthSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setStatus("");

    try {
      if (authMode === "register") {
        await request(
          "/auth/register/",
          {
            method: "POST",
            body: JSON.stringify(authForm),
          },
          false,
        );
        setStatus("Cuenta creada. Ya puedes iniciar sesion.");
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
      setStatus("Sesion iniciada.");
      setAuthForm({
        username: "",
        email: "",
        password: "",
        password_two: "",
        first_name: "",
        last_name: "",
      });
    } catch (err) {
      setError(normalizeError(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleLogout() {
    setSaving(true);
    setError("");
    setStatus("");

    try {
      if (auth?.refresh) {
        await request("/auth/logout/", {
          method: "POST",
          body: JSON.stringify({ refresh: auth.refresh }),
        });
      }
    } catch {
      // The local session is cleared even if the token is already invalid.
    } finally {
      updateAuth(null);
      setSaving(false);
      setStatus("Sesion cerrada.");
    }
  }

  async function handleReservationSubmit(event) {
    event.preventDefault();
    if (!auth) {
      setError("Inicia sesion para crear una reserva.");
      return;
    }

    setSaving(true);
    setError("");
    setStatus("");

    try {
      const payload = {
        title: form.title.trim(),
        start_time: new Date(form.start_time).toISOString(),
        end_time: new Date(form.end_time).toISOString(),
      };
      await request(`/reservations/${editingId ? `${editingId}/` : ""}`, {
        method: editingId ? "PUT" : "POST",
        body: JSON.stringify(payload),
      });
      await loadReservations();
      setEditingId(null);
      setForm(createDefaultForm(selectedDate));
      setStatus(editingId ? "Reserva actualizada." : "Reserva creada.");
    } catch (err) {
      setError(normalizeError(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    setSaving(true);
    setError("");
    setStatus("");

    try {
      await request(`/reservations/${id}/`, { method: "DELETE" });
      await loadReservations();
      if (editingId === id) setEditingId(null);
      setStatus("Reserva eliminada.");
    } catch (err) {
      setError(normalizeError(err));
    } finally {
      setSaving(false);
    }
  }

  function startEditing(reservation) {
    setEditingId(reservation.id);
    setSelectedDate(new Date(reservation.start_time));
    setViewDate(new Date(reservation.start_time));
    setForm({
      title: reservation.title,
      start_time: toDateTimeLocal(reservation.start_time),
      end_time: toDateTimeLocal(reservation.end_time),
    });
  }

  function changeMonth(offset) {
    setViewDate((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1));
  }

  function handleSelectDate(day) {
    setSelectedDate(day);
    if (!editingId) {
      setForm(createDefaultForm(day));
    }
  }

  function selectToday() {
    const now = new Date();
    setSelectedDate(now);
    setViewDate(now);
  }

  return (
    <main className="min-h-screen bg-[#f4f7f5] text-slate-950">
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-5 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-700">Centro de reservas</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-normal text-slate-950 sm:text-4xl">Calendario de sala comunitaria</h1>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button className="btn btn-secondary" type="button" onClick={selectToday}>
                Hoy
              </button>
              <button className="btn btn-secondary icon-btn" type="button" onClick={() => changeMonth(-1)} aria-label="Mes anterior">
                ‹
              </button>
              <button className="btn btn-secondary icon-btn" type="button" onClick={() => changeMonth(1)} aria-label="Mes siguiente">
                ›
              </button>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Metric label="Reservas visibles" value={reservations.length} />
            <Metric label="Proximas" value={upcomingReservations.length} />
            <Metric label="Mis reservas" value={auth ? myReservations.length : "-"} />
          </div>
        </div>
      </section>

      <div className="mx-auto grid w-full max-w-7xl gap-5 px-4 py-5 sm:px-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:px-8">
        <section className="panel">
          <div className="calendar-head">
            <div>
              <h2 className="text-xl font-semibold capitalize text-slate-950">{MONTH_FORMAT.format(viewDate)}</h2>
              <p className="mt-1 text-sm text-slate-600">Selecciona un dia para ver su agenda y crear reservas.</p>
            </div>
            <button className="btn btn-primary" type="button" onClick={() => setForm(createDefaultForm(selectedDate))} disabled={!auth}>
              + Nueva reserva
            </button>
          </div>

          <div className="calendar-grid mt-5">
            {WEEKDAYS.map((day) => (
              <div className="weekday" key={day}>
                {day}
              </div>
            ))}
            {calendarDays.map((day) => {
              const key = dateKey(day);
              const dayReservations = reservationsByDay[key] || [];
              const isCurrentMonth = monthKey(day) === monthKey(viewDate);
              const isSelected = key === selectedKey;
              const isToday = key === dateKey(new Date());

              return (
                <button
                  className={`calendar-day ${isCurrentMonth ? "" : "muted"} ${isSelected ? "selected" : ""}`}
                  key={key}
                  type="button"
                  onClick={() => handleSelectDate(day)}
                >
                  <span className="day-number">
                    {day.getDate()}
                    {isToday ? <span className="today-dot" aria-label="Hoy" /> : null}
                  </span>
                  <span className="day-stack">
                    {dayReservations.slice(0, 3).map((reservation) => (
                      <span className="reservation-pill" key={reservation.id}>
                        {TIME_FORMAT.format(new Date(reservation.start_time))} {reservation.title}
                      </span>
                    ))}
                    {dayReservations.length > 3 ? <span className="more-pill">+{dayReservations.length - 3} mas</span> : null}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <aside className="flex flex-col gap-5">
          <section className="panel">
            {auth ? (
              <div className="account">
                <div>
                  <p className="text-sm text-slate-600">Sesion activa</p>
                  <h2 className="text-lg font-semibold text-slate-950">{auth.profile?.first_name || auth.profile?.username}</h2>
                  <p className="text-sm text-slate-500">{auth.profile?.email || "Sin email registrado"}</p>
                </div>
                <button className="btn btn-secondary" type="button" onClick={handleLogout} disabled={saving}>
                  Salir
                </button>
              </div>
            ) : (
              <AuthForm
                authForm={authForm}
                authMode={authMode}
                saving={saving}
                setAuthForm={setAuthForm}
                setAuthMode={setAuthMode}
                onSubmit={handleAuthSubmit}
              />
            )}
          </section>

          <section className="panel">
            <div className="section-title">
              <h2 className="text-lg font-semibold text-slate-950">Agenda del dia</h2>
              <p className="text-sm capitalize text-slate-600">{DAY_FORMAT.format(selectedDate)}</p>
            </div>

            <div className="mt-4 flex flex-col gap-3">
              {loading ? <p className="empty">Cargando reservas...</p> : null}
              {!loading && todaysReservations.length === 0 ? <p className="empty">No hay reservas para este dia.</p> : null}
              {todaysReservations.map((reservation) => (
                <ReservationItem
                  currentUser={currentUser}
                  key={reservation.id}
                  reservation={reservation}
                  saving={saving}
                  onDelete={handleDelete}
                  onEdit={startEditing}
                />
              ))}
            </div>
          </section>

          <section className="panel">
            <div className="section-title">
              <h2 className="text-lg font-semibold text-slate-950">{editingId ? "Editar reserva" : "Crear reserva"}</h2>
              <p className="text-sm text-slate-600">{auth ? "El usuario se asigna automaticamente." : "Inicia sesion para guardar cambios."}</p>
            </div>

            <form className="mt-4 flex flex-col gap-3" onSubmit={handleReservationSubmit}>
              <label className="field">
                <span>Titulo</span>
                <input
                  required
                  disabled={!auth || saving}
                  maxLength={100}
                  value={form.title}
                  onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                  placeholder="Reunion de vecinos"
                />
              </label>
              <label className="field">
                <span>Inicio</span>
                <input
                  required
                  disabled={!auth || saving}
                  type="datetime-local"
                  value={form.start_time}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      start_time: event.target.value,
                      end_time: current.end_time <= event.target.value ? addMinutes(event.target.value, 60) : current.end_time,
                    }))
                  }
                />
              </label>
              <label className="field">
                <span>Fin</span>
                <input
                  required
                  disabled={!auth || saving}
                  type="datetime-local"
                  value={form.end_time}
                  onChange={(event) => setForm((current) => ({ ...current, end_time: event.target.value }))}
                />
              </label>

              <div className="flex flex-wrap gap-2 pt-1">
                <button className="btn btn-primary" type="submit" disabled={!auth || saving}>
                  {saving ? "Guardando..." : editingId ? "Actualizar" : "Reservar"}
                </button>
                {editingId ? (
                  <button
                    className="btn btn-secondary"
                    type="button"
                    onClick={() => {
                      setEditingId(null);
                      setForm(createDefaultForm(selectedDate));
                    }}
                  >
                    Cancelar
                  </button>
                ) : null}
              </div>
            </form>
          </section>

          {(status || error) && (
            <section className={`notice ${error ? "notice-error" : "notice-ok"}`} role="status">
              {error || status}
            </section>
          )}
        </aside>
      </div>
    </main>
  );
}

function Metric({ label, value }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function AuthForm({ authForm, authMode, saving, setAuthForm, setAuthMode, onSubmit }) {
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
          <input
            autoComplete="username"
            required
            value={authForm.username}
            onChange={(event) => setAuthForm((current) => ({ ...current, username: event.target.value }))}
          />
        </label>
        {isRegister ? (
          <>
            <label className="field">
              <span>Email</span>
              <input
                autoComplete="email"
                type="email"
                value={authForm.email}
                onChange={(event) => setAuthForm((current) => ({ ...current, email: event.target.value }))}
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              <label className="field">
                <span>Nombre</span>
                <input value={authForm.first_name} onChange={(event) => setAuthForm((current) => ({ ...current, first_name: event.target.value }))} />
              </label>
              <label className="field">
                <span>Apellidos</span>
                <input value={authForm.last_name} onChange={(event) => setAuthForm((current) => ({ ...current, last_name: event.target.value }))} />
              </label>
            </div>
          </>
        ) : null}
        <label className="field">
          <span>Contrasena</span>
          <input
            autoComplete={isRegister ? "new-password" : "current-password"}
            required
            type="password"
            value={authForm.password}
            onChange={(event) => setAuthForm((current) => ({ ...current, password: event.target.value }))}
          />
        </label>
        {isRegister ? (
          <label className="field">
            <span>Repetir contrasena</span>
            <input
              autoComplete="new-password"
              required
              type="password"
              value={authForm.password_two}
              onChange={(event) => setAuthForm((current) => ({ ...current, password_two: event.target.value }))}
            />
          </label>
        ) : null}
        <button className="btn btn-primary" type="submit" disabled={saving}>
          {saving ? "Procesando..." : isRegister ? "Crear cuenta" : "Entrar"}
        </button>
      </form>
    </div>
  );
}

function ReservationItem({ currentUser, reservation, saving, onDelete, onEdit }) {
  const start = new Date(reservation.start_time);
  const end = new Date(reservation.end_time);
  const isMine = currentUser && reservation.user_username === currentUser;

  return (
    <article className={`reservation-item ${isMine ? "mine" : ""}`}>
      <div className="reservation-time">
        <strong>{TIME_FORMAT.format(start)}</strong>
        <span>{TIME_FORMAT.format(end)}</span>
      </div>
      <div className="min-w-0 flex-1">
        <h3>{reservation.title}</h3>
        <p>{reservation.user_username || "Usuario"}</p>
      </div>
      {isMine ? (
        <div className="reservation-actions">
          <button className="icon-action" type="button" onClick={() => onEdit(reservation)} disabled={saving} aria-label="Editar reserva">
            Editar
          </button>
          <button className="icon-action danger" type="button" onClick={() => onDelete(reservation.id)} disabled={saving} aria-label="Eliminar reserva">
            Borrar
          </button>
        </div>
      ) : null}
    </article>
  );
}
