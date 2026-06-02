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
const FIELD_LABELS = {
  username: "Usuario",
  email: "Email",
  password: "Contraseña",
  password_two: "Repetir contraseña",
  first_name: "Nombre",
  last_name: "Apellidos",
  start_time: "Inicio",
  end_time: "Fin",
  title: "Título",
  non_field_errors: "Error",
  detail: "Error",
  dni_nif: "DNI/NIF",
  telefono: "Teléfono",
  numero_socio: "Número de socio",
};
const ERROR_TRANSLATIONS = [
  ["No active account found with the given credentials", "No existe una cuenta activa con ese usuario y contraseña."],
  ["Given token not valid for any token type", "La sesión no es válida. Vuelve a iniciar sesión."],
  ["Token is invalid or expired", "La sesión ha caducado. Vuelve a iniciar sesión."],
  ["This field is required.", "Este campo es obligatorio."],
  ["This field may not be blank.", "Este campo no puede estar vacío."],
  ["Enter a valid email address.", "Introduce un email válido."],
  ["A user with that username already exists.", "Ya existe un usuario con ese nombre."],
  ["No refresh token provided.", "No se recibió el token de sesión."],
  ["Logout successful", "Sesión cerrada correctamente."],
  ["Invalid password", "Contraseña incorrecta."],
  ["Unauthorized", "No tienes autorización."],
  ["Forbidden", "No tienes permiso para hacer esta acción."],
  ["Not found.", "No se encontró el recurso."],
  ["Bad Request", "Solicitud incorrecta."],
];

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

function translateText(value) {
  if (value === null || value === undefined) return "";

  let text = String(value);
  for (const [source, target] of ERROR_TRANSLATIONS) {
    text = text.replaceAll(source, target);
  }
  return text;
}

function normalizeError(error) {
  if (!error || typeof error !== "object") return "No se pudo completar la accion.";
  if (error.detail) return translateText(error.detail);
  if (error.non_field_errors) {
    const value = Array.isArray(error.non_field_errors) ? error.non_field_errors.join(" ") : error.non_field_errors;
    return translateText(value);
  }

  return Object.entries(error)
    .map(([field, value]) => `${FIELD_LABELS[field] || field}: ${translateText(Array.isArray(value) ? value.join(" ") : value)}`)
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

function overlapsReservation(reservation, start, end, editingId) {
  if (editingId && reservation.id === editingId) return false;
  // Si la reserva ya fue rechazada por administración, no bloquea el calendario
  if (reservation.estado === "RECHAZADA") return false;

  const reservationStart = new Date(reservation.start_time);
  const reservationEnd = new Date(reservation.end_time);
  return reservationStart < end && reservationEnd > start;
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

  // 🔑 NUEVOS ESTADOS PARA GESTIÓN DE ROLES Y SOCIOS (Vistas de tu compañero)
  const [activeTab, setActiveTab] = useState("calendar"); // Opciones: "calendar", "admin_reservations", "admin_socios"
  const [socios, setSocios] = useState([]);
  const [loadingSocios, setLoadingSocios] = useState(false);
  const [socioForm, setSocioForm] = useState({
    username: "",
    email: "",
    password: "",
    password_two: "",
    first_name: "",
    last_name: "",
    dni_nif: "",
    telefono: "",
    numero_socio: "",
    es_socio: true,
  });

  // Identificador de Admin basado en el backend de Django (is_staff)
  const isAdmin = auth?.profile?.is_staff || false;
  const currentUser = auth?.profile?.username;

  const updateAuth = useCallback((nextAuth) => {
    setAuth(nextAuth);
    saveStoredAuth(nextAuth);
    // Si cerramos sesión, devolvemos al usuario al calendario normal
    if (!nextAuth) setActiveTab("calendar");
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

  // 👥 CARGAR SOCIOS DESDE EL ENDPOINT DE TU COMPAÑERO (IsAdminUser)
  const loadSocios = useCallback(async () => {
    if (!isAdmin) return;
    setLoadingSocios(true);
    try {
      const data = await request("/admin/users/");
      setSocios(data);
    } catch (err) {
      setError(`No se pudieron cargar los socios. ${normalizeError(err)}`);
    } finally {
      setLoadingSocios(false);
    }
  }, [isAdmin, request]);

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

  // Disparador para refrescar socios al entrar a su pestaña
  useEffect(() => {
    if (activeTab === "admin_socios") {
      void loadSocios();
    }
  }, [activeTab, loadSocios]);

  const calendarDays = useMemo(() => buildCalendarDays(viewDate), [viewDate]);
  const reservationsByDay = useMemo(() => groupByDay(reservations), [reservations]);
  const selectedKey = dateKey(selectedDate);
  const todaysReservations = reservationsByDay[selectedKey] || [];
  const myReservations = useMemo(
    () => reservations.filter((reservation) => reservation.user_username === currentUser),
    [currentUser, reservations],
  );
  const upcomingReservations = useMemo(
    () => reservations.filter((reservation) => new Date(reservation.end_time) >= new Date() && reservation.estado !== "RECHAZADA").slice(0, 6),
    [reservations],
  );
  const conflictingReservation = useMemo(() => {
    if (!form.start_time || !form.end_time) return null;

    const start = new Date(form.start_time);
    const end = new Date(form.end_time);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start >= end) return null;

    return reservations.find((reservation) => overlapsReservation(reservation, start, end, editingId)) || null;
  }, [editingId, form.end_time, form.start_time, reservations]);

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
    if (conflictingReservation) {
      setError("Ese tramo ya esta reservado o solicitado. Elige otra hora.");
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
      setStatus(editingId ? "Reserva actualizada." : "Solicitud de reserva enviada (Queda pendiente de aprobación).");
    } catch (err) {
      setError(normalizeError(err));
    } finally {
      setSaving(false);
    }
  }

  // 👑 NUEVA ACCIÓN: CAMBIAR ESTADO DESDE EL DASHBOARD DE ADMIN (Aprobar / Rechazar)
  async function handleUpdateStatus(id, nuevoEstado) {
    setSaving(true);
    setError("");
    setStatus("");
    try {
      await request(`/reservations/${id}/`, {
        method: "PATCH",
        body: JSON.stringify({ estado: nuevoEstado }),
      });
      await loadReservations();
      setStatus(`Reserva actualizada a: ${nuevoEstado}`);
    } catch (err) {
      setError(normalizeError(err));
    } finally {
      setSaving(false);
    }
  }

  // 📝 NUEVA ACCIÓN: CREAR UN SOCIO MANUALMENTE (Hojas de papel)
  async function handleCreateSocioSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setStatus("");

    try {
      await request("/usuarios/admin-list/", {
        method: "POST",
        body: JSON.stringify(socioForm),
      });
      setStatus("Socio registrado con éxito en el sistema digital.");
      setSocioForm({
        username: "",
        email: "",
        password: "",
        password_two: "",
        first_name: "",
        last_name: "",
        dni_nif: "",
        telefono: "",
        numero_socio: "",
        es_socio: true,
      });
      await loadSocios();
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
      {/* HEADER PRINCIPAL */}
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-5 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-700">
                Centro de reservas {isAdmin && "• Panel de Control"}
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-normal text-slate-950 sm:text-4xl">
                Calendario de sala comunitaria
              </h1>
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
            <Metric label="Reservas totales" value={reservations.filter(r => r.estado !== "RECHAZADA").length} />
            <Metric label="Proximas aprobadas" value={upcomingReservations.length} />
            <Metric label="Mis reservas" value={auth ? myReservations.length : "-"} />
          </div>
        </div>
      </section>

      {/* 👑 BARRA DE PESTAÑAS MÁGICA PARA ADMINISTRADORES */}
      {isAdmin && (
        <section className="bg-white border-b border-slate-200">
          <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex gap-4">
              <button
                className={`py-3 px-1 font-semibold text-sm border-b-2 transition ${activeTab === "calendar" ? "border-emerald-600 text-emerald-700" : "border-transparent text-slate-500 hover:text-slate-800"}`}
                onClick={() => setActiveTab("calendar")}
              >
                📅 Ver Calendario General
              </button>
              <button
                className={`py-3 px-1 font-semibold text-sm border-b-2 transition relative ${activeTab === "admin_reservations" ? "border-emerald-600 text-emerald-700" : "border-transparent text-slate-500 hover:text-slate-800"}`}
                onClick={() => setActiveTab("admin_reservations")}
              >
                ⏳ Validar Solicitudes
                {reservations.filter((r) => r.estado === "PENDIENTE").length > 0 && (
                  <span className="ml-2 bg-amber-500 text-white text-xs px-1.5 py-0.5 rounded-full font-bold">
                    {reservations.filter((r) => r.estado === "PENDIENTE").length}
                  </span>
                )}
              </button>
              <button
                className={`py-3 px-1 font-semibold text-sm border-b-2 transition ${activeTab === "admin_socios" ? "border-emerald-600 text-emerald-700" : "border-transparent text-slate-500 hover:text-slate-800"}`}
                onClick={() => setActiveTab("admin_socios")}
              >
                👥 Libro Registro de Socios
              </button>
            </div>
          </div>
        </section>
      )}

      {/* ALERTAS */}
      {(status || error) && (
        <section className={`app-alert ${error ? "app-alert-error" : "app-alert-ok"}`} role={error ? "alert" : "status"}>
          <div>
            <strong>{error ? "Error" : "Correcto"}</strong>
            <span>{error || status}</span>
          </div>
          <button
            type="button"
            onClick={() => {
              setError("");
              setStatus("");
            }}
            aria-label="Cerrar alerta"
          >
            ×
          </button>
        </section>
      )}

      {/* ======================================================== */}
      {/* VISTA 1: CALENDARIO TRADICIONAL (Para todos los usuarios) */}
      {/* ======================================================== */}
      {activeTab === "calendar" && (
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
                      {dayReservations.slice(0, 3).map((reservation) => {
                        const est = reservation.estado || "PENDIENTE";
                        let statusIndicator = "";
                        let pillClass = "reservation-pill";
                        
                        if (est === "PENDIENTE") {
                          statusIndicator = " ⏳";
                          pillClass += " bg-amber-100 text-amber-900 border border-amber-300 font-medium";
                        } else if (est === "RECHAZADA") {
                          statusIndicator = " ✕";
                          pillClass += " bg-rose-100 text-rose-900 line-through opacity-50";
                        }

                        return (
                          <span className={pillClass} key={reservation.id}>
                            {TIME_FORMAT.format(new Date(reservation.start_time))} {reservation.title}{statusIndicator}
                          </span>
                        );
                      })}
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
                    <p className="text-sm text-slate-600">Sesion activa {isAdmin && "👑"}</p>
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
                    isAdmin={isAdmin}
                    key={reservation.id}
                    reservation={reservation}
                    saving={saving}
                    onDelete={handleDelete}
                    onEdit={startEditing}
                    onUpdateStatus={handleUpdateStatus}
                  />
                ))}
              </div>
            </section>

            <section className="panel">
              <div className="section-title">
                <h2 className="text-lg font-semibold text-slate-950">{editingId ? "Editar reserva" : "Crear reserva"}</h2>
                <p className="text-sm text-slate-600">{auth ? "La solicitud se enviará a revisión." : "Inicia sesion para guardar cambios."}</p>
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

                {conflictingReservation ? (
                  <div className="conflict-warning" role="alert">
                    <strong>Tramo ocupado</strong>
                    <span>
                      {TIME_FORMAT.format(new Date(conflictingReservation.start_time))} - {TIME_FORMAT.format(new Date(conflictingReservation.end_time))} por{" "}
                      {conflictingReservation.user_username || "otro usuario"}.
                    </span>
                  </div>
                ) : (
                  <div className="availability-ok" role="status">
                    Tramo disponible segun las reservas cargadas.
                  </div>
                )}

                <div className="flex flex-wrap gap-2 pt-1">
                  <button className="btn btn-primary" type="submit" disabled={!auth || saving || Boolean(conflictingReservation)}>
                    {saving ? "Guardando..." : editingId ? "Actualizar" : "Enviar Solicitud"}
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
          </aside>
        </div>
      )}

      {/* ======================================================== */}
      {/* VISTA 2: BANDEJA DE VALIDACIÓN (Exclusivo Administradores)*/}
      {/* ======================================================== */}
      {activeTab === "admin_reservations" && (
        <div className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
          <div className="panel">
            <h2 className="text-xl font-bold text-slate-950 mb-2">Solicitudes de Reserva Pendientes</h2>
            <p className="text-sm text-slate-600 mb-6">Aquí se listan los huecos que los vecinos han pedido pero aún no están aprobados oficialmente.</p>
            
            {reservations.filter((r) => r.estado === "PENDIENTE").length === 0 ? (
              <p className="text-center py-8 text-slate-500 font-medium bg-slate-50 border border-dashed rounded-lg">
                🎉 ¡Todo al día! No quedan solicitudes pendientes de aprobación.
              </p>
            ) : (
              <div className="flex flex-col gap-4">
                {reservations.filter((r) => r.estado === "PENDIENTE").map((r) => (
                  <div key={r.id} className="bg-white border border-amber-200 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm hover:border-amber-300 transition">
                    <div>
                      <span className="bg-amber-100 text-amber-800 text-xs px-2 py-0.5 rounded font-semibold uppercase tracking-wide">Pendiente</span>
                      <h3 className="font-bold text-slate-900 text-lg mt-1">{r.title}</h3>
                      <p className="text-sm text-slate-600">Solicitado por: <span className="font-semibold text-slate-800">@{r.user_username}</span></p>
                      <p className="text-sm text-emerald-800 font-medium mt-2 flex items-center gap-1">
                        📅 {DAY_FORMAT.format(new Date(r.start_time))} | ⏰ {TIME_FORMAT.format(new Date(r.start_time))} - {TIME_FORMAT.format(new Date(r.end_time))}
                      </p>
                    </div>
                    <div className="flex sm:flex-col gap-2 shrink-0">
                      <button className="bg-emerald-600 text-white px-4 py-2 rounded-lg font-semibold text-sm hover:bg-emerald-700 shadow-sm transition" onClick={() => handleUpdateStatus(r.id, "ACEPTADA")} disabled={saving}>
                        Aceptar Reserva
                      </button>
                      <button className="bg-rose-50 text-rose-700 border border-rose-200 px-4 py-2 rounded-lg font-semibold text-sm hover:bg-rose-100 transition" onClick={() => handleUpdateStatus(r.id, "RECHAZADA")} disabled={saving}>
                        Rechazar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* VISTA 3: LIBRO DE SOCIOS / EXCEL (Exclusivo Administradores)*/}
      {/* ======================================================== */}
      {activeTab === "admin_socios" && (
        <div className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_400px] lg:px-8">
          {/* TABLA PRINCIPAL DE SOCIOS (GET) */}
          <section className="panel">
            <h2 className="text-xl font-bold text-slate-950 mb-1">Libro Registro de Socios digital</h2>
            <p className="text-sm text-slate-600 mb-6">Base de datos sincronizada en tiempo real desde Neon. Sustituye las antiguas hojas de cálculo.</p>
            
            {loadingSocios ? <p className="empty">Cargando base de datos de socios...</p> : null}
            {!loadingSocios && socios.length === 0 ? <p className="empty">No hay ningún usuario registrado.</p> : null}
            
            {!loadingSocios && socios.length > 0 && (
              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full border-collapse text-sm text-slate-900">
                  <thead>
                    <tr className="bg-slate-100 text-left border-b border-slate-200">
                      <th className="p-3 font-semibold text-slate-700">Socio / Datos de acceso</th>
                      <th className="p-3 font-semibold text-slate-700">DNI / NIF</th>
                      <th className="p-3 font-semibold text-slate-700">Teléfono</th>
                      <th className="p-3 font-semibold text-slate-700">Carnet</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {socios.map((s) => (
                      <tr key={s.id} className="hover:bg-slate-50/70 transition">
                        <td className="p-3">
                          <div className="font-bold text-slate-900">{s.last_name ? `${s.last_name}, ${s.first_name}` : s.username}</div>
                          <div className="text-xs text-slate-500">@{s.username} • {s.email}</div>
                        </td>
                        <td className="p-3 text-slate-700 font-mono">{s.dni_nif || "—"}</td>
                        <td className="p-3 text-slate-700">{s.telefono || "—"}</td>
                        <td className="p-3">
                          {s.es_socio ? (
                            <span className="bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded text-xs">
                              Nº {s.numero_socio || "Asig."}
                            </span>
                          ) : (
                            <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-xs">No socio</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* FORMULARIO DE PASO DE PAPEL A WEB (POST) */}
          <section className="panel h-fit">
            <h2 className="text-lg font-bold text-slate-950">➕ Registro Manual (Desde Papel)</h2>
            <p className="text-sm text-slate-600 mb-4">Utiliza este panel cuando un vecino os entregue la hoja de inscripción física firmada.</p>
            
            <form className="flex flex-col gap-3" onSubmit={handleCreateSocioSubmit}>
              <label className="field">
                <span>Usuario (Para iniciar sesión)</span>
                <input required value={socioForm.username} onChange={(e) => setSocioForm(c => ({...c, username: e.target.value}))} placeholder="ej: javier92" />
              </label>
              <label className="field">
                <span>Email oficial</span>
                <input type="email" required value={socioForm.email} onChange={(e) => setSocioForm(c => ({...c, email: e.target.value}))} placeholder="vecino@correo.com" />
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="field">
                  <span>Nombre</span>
                  <input required value={socioForm.first_name} onChange={(e) => setSocioForm(c => ({...c, first_name: e.target.value}))} placeholder="Javier" />
                </label>
                <label className="field">
                  <span>Apellidos</span>
                  <input required value={socioForm.last_name} onChange={(e) => setSocioForm(c => ({...c, last_name: e.target.value}))} placeholder="García López" />
                </label>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label className="field">
                  <span>DNI / NIF</span>
                  <input required value={socioForm.dni_nif} onChange={(e) => setSocioForm(c => ({...c, dni_nif: e.target.value}))} placeholder="12345678X" />
                </label>
                <label className="field">
                  <span>Teléfono</span>
                  <input required value={socioForm.telefono} onChange={(e) => setSocioForm(c => ({...c, telefono: e.target.value}))} placeholder="600123456" />
                </label>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label className="field">
                  <span>Número de Socio</span>
                  <input value={socioForm.numero_socio} onChange={(e) => setSocioForm(c => ({...c, numero_socio: e.target.value}))} placeholder="S-241" />
                </label>
                <label className="field">
                  <span>Contraseña inicial</span>
                  <input type="password" required value={socioForm.password} onChange={(e) => setSocioForm(c => ({...c, password: e.target.value}))} placeholder="••••••••" />
                </label>
              </div>
              
              <button className="btn btn-primary mt-2" type="submit" disabled={saving}>
                {saving ? "Registrando en Neon..." : "Guardar en Base de Datos"}
              </button>
            </form>
          </section>
        </div>
      )}
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
                required
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

function ReservationItem({ currentUser, reservation, saving, onDelete, onEdit, isAdmin, onUpdateStatus }) {
  const start = new Date(reservation.start_time);
  const end = new Date(reservation.end_time);
  const isMine = currentUser && reservation.user_username === currentUser;
  const est = reservation.estado || "PENDIENTE";

  return (
    <article className={`reservation-item ${isMine ? "mine" : ""} border-l-4 ${est === "PENDIENTE" ? "border-l-amber-500" : est === "RECHAZADA" ? "border-l-rose-500" : "border-l-emerald-500"}`}>
      <div className="reservation-time">
        <strong>{TIME_FORMAT.format(start)}</strong>
        <span>{TIME_FORMAT.format(end)}</span>
      </div>
      <div className="min-w-0 flex-1">
        <h3 className={est === "RECHAZADA" ? "line-through opacity-50" : ""}>{reservation.title}</h3>
        <p className="flex items-center gap-1.5 text-xs text-slate-600">
          <span>{reservation.user_username || "Usuario"}</span>
          {est === "PENDIENTE" && <span className="bg-amber-100 text-amber-800 text-[10px] px-1.5 py-0.2 rounded font-medium">Pendiente</span>}
          {est === "RECHAZADA" && <span className="bg-rose-100 text-rose-800 text-[10px] px-1.5 py-0.2 rounded font-medium">Rechazada</span>}
          {est === "ACEPTADA" && <span className="bg-emerald-100 text-emerald-800 text-[10px] px-1.5 py-0.2 rounded font-medium">Aceptada</span>}
        </p>
      </div>
      <div className="reservation-actions flex flex-col gap-1 items-end">
        {/* Los usuarios pueden editar/borrar solo si están en estado PENDIENTE */}
        {isMine && est === "PENDIENTE" ? (
          <div className="flex gap-2">
            <button className="icon-action" type="button" onClick={() => onEdit(reservation)} disabled={saving} aria-label="Editar reserva">
              Editar
            </button>
            <button className="icon-action danger" type="button" onClick={() => onDelete(reservation.id)} disabled={saving} aria-label="Eliminar reserva">
              Borrar
            </button>
          </div>
        ) : isMine ? (
          <button className="icon-action danger" type="button" onClick={() => onDelete(reservation.id)} disabled={saving} aria-label="Eliminar reserva">
            Eliminar
          </button>
        ) : null}

        {/* 👑 Acciones directas si el que mira la agenda es Admin */}
        {isAdmin && (
          <div className="flex flex-col gap-1 mt-1 items-end">
            {/* Si está pendiente, muestra botones de Aprobar/Rechazar */}
            {est === "PENDIENTE" && (
              <div className="flex gap-1.5 mb-1">
                <button className="text-[11px] bg-emerald-600 text-white px-2 py-0.5 rounded hover:bg-emerald-700 transition" onClick={() => onUpdateStatus(reservation.id, "ACEPTADA")} disabled={saving} title="Aprobar de inmediato">
                  Aprobar
                </button>
                <button className="text-[11px] bg-rose-600 text-white px-2 py-0.5 rounded hover:bg-rose-700 transition" onClick={() => onUpdateStatus(reservation.id, "RECHAZADA")} disabled={saving} title="Rechazar solicitud">
                  Rechazar
                </button>
              </div>
            )}
            
            {/* 🔥 BOTÓN ROJO DE ADMIN: Usa la clase "icon-action danger" para ser idéntico al de arriba */}
            <button 
              className="icon-action danger" 
              type="button"
              onClick={() => {
                if (confirm("¿Estás seguro de que deseas eliminar esta reserva definitivamente del sistema?")) {
                  onDelete(reservation.id);
                }
              }} 
              disabled={saving}
              title="Borrar reserva como Administrador"
            >
              Borrar
            </button>
          </div>
        )}
      </div>
    </article>
  );
}