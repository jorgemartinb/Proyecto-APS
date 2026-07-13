"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useAuth } from "./context/AuthContext";
import Alert from "./components/Alert";
import AuthForm from "./components/AuthForm";
import ReservationItem from "./components/ReservationItem";
import Metric from "./components/Metric";
import {
  DAY_FORMAT, MONTH_FORMAT, TIME_FORMAT, WEEKDAYS,
  dateKey, monthKey, toDateTimeLocal, addMinutes,
  createDefaultForm, buildCalendarDays, groupByDay,
  sortReservations, overlapsReservation, normalizeError,
  expandRecurringReservations, WEEKDAY_LONG_FORMAT,
  isStrongPassword, PASSWORD_RULE_TEXT,
} from "./lib/utils";

export default function Home() {
  const { auth, updateAuth, request, loadProfile, isAdmin, currentUser } = useAuth();
  const today = useMemo(() => new Date(), []);
  const reservationFormRef = useRef(null);

  const [authMode, setAuthMode] = useState("login");
  const [authForm, setAuthForm] = useState({ username: "", email: "", password: "", password_two: "", first_name: "", last_name: "" });
  const [reservations, setReservations] = useState([]);
  const [selectedDate, setSelectedDate] = useState(today);
  const [viewDate, setViewDate] = useState(today);
  const [form, setForm] = useState(() => createDefaultForm(today));
  const [editingId, setEditingId] = useState(null);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

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

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void loadReservations(); }, [loadReservations]);

  const calendarDays = useMemo(() => buildCalendarDays(viewDate), [viewDate]);
  const visibleReservations = useMemo(() => {
    const rangeStart = calendarDays[0] || viewDate;
    const rangeEnd = new Date(calendarDays[calendarDays.length - 1] || viewDate);
    rangeEnd.setHours(23, 59, 59, 999);
    return expandRecurringReservations(reservations, rangeStart, rangeEnd);
  }, [calendarDays, reservations, viewDate]);
  const reservationsByDay = useMemo(() => groupByDay(visibleReservations), [visibleReservations]);
  const selectedKey = dateKey(selectedDate);
  const todaysReservations = reservationsByDay[selectedKey] || [];
  const myReservations = useMemo(
    () => reservations.filter((r) => r.user_username === currentUser),
    [currentUser, reservations],
  );
  const upcomingReservations = useMemo(
    () => reservations.filter((r) => new Date(r.end_time) >= new Date() && r.estado !== "RECHAZADA").slice(0, 6),
    [reservations],
  );
  const conflictingReservation = useMemo(() => {
    if (!form.start_time || !form.end_time) return null;
    const start = new Date(form.start_time);
    const end = new Date(form.end_time);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start >= end) return null;
    return visibleReservations.find((r) => overlapsReservation(r, start, end, editingId)) || null;
  }, [editingId, form.end_time, form.start_time, visibleReservations]);

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
        setStatus("Cuenta creada. Ya puedes iniciar sesion.");
        setAuthMode("login");
        setAuthForm((c) => ({ ...c, password: "", password_two: "" }));
        return;
      }
      const tokens = await request("/auth/login/", { method: "POST", body: JSON.stringify({ username: authForm.username, password: authForm.password }) }, false);
      const session = await loadProfile(tokens);
      updateAuth(session);
      setStatus("Sesion iniciada.");
      setAuthForm({ username: "", email: "", password: "", password_two: "", first_name: "", last_name: "" });
    } catch (err) {
      setError(normalizeError(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleReservationSubmit(event) {
    event.preventDefault();
    if (!auth) { setError("Inicia sesion para crear una reserva."); return; }
    if (conflictingReservation) { setError("Ese tramo ya esta reservado o solicitado. Elige otra hora."); return; }
    setSaving(true);
    setError("");
    setStatus("");
    try {
      const payload = {
        title: form.title.trim(),
        start_time: new Date(form.start_time).toISOString(),
        end_time: new Date(form.end_time).toISOString(),
        is_recurring: Boolean(form.is_recurring),
        recurrence_type: form.is_recurring ? form.recurrence_type : null,
      };
      await request(`/reservations/${editingId ? `${editingId}/` : ""}`, { method: editingId ? "PUT" : "POST", body: JSON.stringify(payload) });
      await loadReservations();
      setEditingId(null);
      setForm(createDefaultForm(selectedDate));
      setStatus(editingId ? "Reserva actualizada." : "Solicitud enviada (pendiente de aprobación).");
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

  async function handleUpdateStatus(id, nuevoEstado) {
    setSaving(true);
    setError("");
    setStatus("");
    try {
      await request(`/reservations/${id}/`, { method: "PATCH", body: JSON.stringify({ estado: nuevoEstado }) });
      await loadReservations();
      setStatus(`Reserva ${nuevoEstado === "ACEPTADA" ? "aceptada" : "rechazada"}.`);
    } catch (err) {
      setError(normalizeError(err));
    } finally {
      setSaving(false);
    }
  }

  function startEditing(reservation) {
    const sourceId = reservation.source_id || reservation.id;
    setEditingId(sourceId);
    setSelectedDate(new Date(reservation.start_time));
    setViewDate(new Date(reservation.start_time));
    setForm({
      title: reservation.title,
      start_time: toDateTimeLocal(reservation.start_time),
      end_time: toDateTimeLocal(reservation.end_time),
      is_recurring: Boolean(reservation.is_recurring),
      recurrence_type: reservation.recurrence_type || "SEMANAL",
    });
  }

  function changeMonth(offset) {
    setViewDate((c) => new Date(c.getFullYear(), c.getMonth() + offset, 1));
  }

  function handleSelectDate(day) {
    setSelectedDate(day);
    if (!editingId) setForm(createDefaultForm(day));
  }

  function selectToday() {
    const now = new Date();
    setSelectedDate(now);
    setViewDate(now);
  }

  function handleStartNewReservation() {
    setEditingId(null);
    setForm(createDefaultForm(selectedDate));
    reservationFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function recurrenceSummary() {
    const start = new Date(form.start_time);
    if (Number.isNaN(start.getTime())) return "Selecciona fecha y hora de inicio para calcular la periodicidad.";
    if (form.recurrence_type === "SEMANAL") {
      return `Se repetirá cada ${WEEKDAY_LONG_FORMAT.format(start)} a las ${TIME_FORMAT.format(start)}.`;
    }
    if (form.recurrence_type === "MENSUAL") {
      return `Se repetirá cada mes el día ${start.getDate()} a las ${TIME_FORMAT.format(start)}.`;
    }
    return `Se repetirá cada 3 meses el día ${start.getDate()} a las ${TIME_FORMAT.format(start)}.`;
  }

  if (!auth) {
    return (
      <main className="min-h-screen text-slate-950">
        <Alert status={status} error={error} onClose={() => { setError(""); setStatus(""); }} />
        <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_420px]">
            <section className="panel flex flex-col justify-between gap-6">
              <div>
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
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-700">Bienvenido</p>
                <h1 className="mt-3 text-3xl font-semibold tracking-normal text-slate-950 sm:text-4xl">
                  Gestiona reservas, compras y vida del centro desde un solo sitio.
                </h1>
                <p className="mt-4 max-w-2xl text-base text-slate-600">
                  Al iniciar sesión verás tus pestañas disponibles según tu rol: calendario, perfil, biblioteca, plenos y las herramientas de administración si te corresponden.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm font-semibold text-slate-900">Reservas</p>
                  <p className="mt-2 text-sm text-slate-600">Consulta agenda, solicita espacios y revisa tus reservas.</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm font-semibold text-slate-900">Socios</p>
                  <p className="mt-2 text-sm text-slate-600">Accede a tu perfil, solicitudes y secciones internas del centro.</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm font-semibold text-slate-900">Administración</p>
                  <p className="mt-2 text-sm text-slate-600">Gestión centralizada para aprobaciones, compras y registro de socios.</p>
                </div>
              </div>
            </section>

            <section className="panel">
              <h2 className="text-2xl font-semibold text-slate-950">Acceso</h2>
              <p className="mt-2 text-sm text-slate-600">
                Entra con tu cuenta o regístrate para solicitar el alta y empezar a usar la plataforma.
              </p>
              <div className="mt-5">
                <AuthForm authForm={authForm} authMode={authMode} saving={saving}
                  setAuthForm={setAuthForm} setAuthMode={setAuthMode} onSubmit={handleAuthSubmit} />
              </div>
            </section>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen text-slate-950">
      <Alert status={status} error={error} onClose={() => { setError(""); setStatus(""); }} />

      <div className="mx-auto w-full max-w-7xl space-y-5 px-4 py-5 sm:px-6 lg:px-8">
        <section className="panel">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-3xl font-semibold tracking-normal text-slate-950 sm:text-4xl">
                Calendario de sala comunitaria
              </h1>
              <p className="mt-2 text-sm text-slate-600">Reserva la sala para tu actividad.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button className="btn btn-secondary" type="button" onClick={selectToday}>Hoy</button>
              <button className="btn btn-secondary icon-btn" type="button" onClick={() => changeMonth(-1)} aria-label="Mes anterior">‹</button>
              <button className="btn btn-secondary icon-btn" type="button" onClick={() => changeMonth(1)} aria-label="Mes siguiente">›</button>
              <button className="btn btn-primary" type="button" onClick={handleStartNewReservation} disabled={!auth}>
                + Nueva reserva
              </button>
            </div>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <Metric label="Reservas totales" value={reservations.filter((r) => r.estado !== "RECHAZADA").length} />
            <Metric label="Proximas aprobadas" value={upcomingReservations.length} />
            <Metric label="Mis reservas" value={auth ? myReservations.length : "-"} />
          </div>
        </section>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
          <section className="panel">
            <div className="calendar-head">
              <div>
                <h2 className="text-xl font-semibold capitalize text-slate-950">{MONTH_FORMAT.format(viewDate)}</h2>
                <p className="mt-1 text-sm text-slate-600">Selecciona un dia para ver su agenda y crear reservas.</p>
              </div>
            </div>
            <div className="calendar-grid mt-5">
              {WEEKDAYS.map((day) => <div className="weekday" key={day}>{day}</div>)}
              {calendarDays.map((day) => {
                const key = dateKey(day);
                const dayReservations = reservationsByDay[key] || [];
                const isCurrentMonth = monthKey(day) === monthKey(viewDate);
                const isSelected = key === selectedKey;
                const isToday = key === dateKey(new Date());
                return (
                  <button
                    className={`calendar-day ${isCurrentMonth ? "" : "muted"} ${isSelected ? "selected" : ""}`}
                    key={key} type="button" onClick={() => handleSelectDate(day)}
                  >
                    <span className="day-number">
                      {day.getDate()}
                      {isToday ? <span className="today-dot" aria-label="Hoy" /> : null}
                    </span>
                    <span className="day-stack">
                      {dayReservations.slice(0, 3).map((r) => {
                        const est = r.estado || "PENDIENTE";
                        let pillClass = "reservation-pill";
                        let indicator = "";
                        if (r.user_username === currentUser) pillClass += " reservation-pill-mine";
                        if (est === "PENDIENTE") { indicator = " ⏳"; pillClass += " reservation-pill-pending"; }
                        else if (est === "RECHAZADA") { indicator = " ✕"; pillClass += " reservation-pill-rejected"; }
                        else if (est === "ACEPTADA") pillClass += " reservation-pill-accepted";
                        return <span className={pillClass} key={r.id}>{TIME_FORMAT.format(new Date(r.start_time))} {r.title}{indicator}</span>;
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
              <div className="account">
                <div>
                  <p className="text-sm text-slate-600">Sesión activa {isAdmin && "👑"}</p>
                  <h2 className="text-lg font-semibold text-slate-950">{auth.profile?.first_name || auth.profile?.username}</h2>
                  <p className="text-sm text-slate-500">{auth.profile?.email || "Sin email registrado"}</p>
                </div>
              </div>
            </section>

            <section className="panel">
              <div className="section-title">
                <h2 className="text-lg font-semibold text-slate-950">Agenda del dia</h2>
                <p className="text-sm capitalize text-slate-600">{DAY_FORMAT.format(selectedDate)}</p>
              </div>
              <div className="mt-4 flex flex-col gap-3">
                {loading ? <p className="empty">Cargando reservas...</p> : null}
                {!loading && todaysReservations.length === 0 ? <p className="empty">No hay reservas para este dia.</p> : null}
                {todaysReservations.map((r) => (
                  <ReservationItem key={r.id} currentUser={currentUser} isAdmin={isAdmin}
                    reservation={r} saving={saving} onDelete={handleDelete}
                    onEdit={startEditing} onUpdateStatus={handleUpdateStatus} />
                ))}
              </div>
            </section>

            <section className="panel" ref={reservationFormRef}>
              <div className="section-title">
                <h2 className="text-lg font-semibold text-slate-950">{editingId ? "Editar reserva" : "Crear reserva"}</h2>
                <p className="text-sm text-slate-600">{auth ? "La solicitud se enviará a revisión." : "Inicia sesion para guardar cambios."}</p>
              </div>
              <form className="mt-4 flex flex-col gap-3" onSubmit={handleReservationSubmit}>
                <label className="field">
                  <span>Titulo</span>
                  <input required disabled={!auth || saving} maxLength={100} value={form.title}
                    onChange={(e) => setForm((c) => ({ ...c, title: e.target.value }))} placeholder="Reunion de vecinos" />
                </label>
                <label className="field">
                  <span>Inicio</span>
                  <input required disabled={!auth || saving} type="datetime-local" value={form.start_time}
                    onChange={(e) => setForm((c) => ({
                      ...c, start_time: e.target.value,
                      end_time: c.end_time <= e.target.value ? addMinutes(e.target.value, 60) : c.end_time,
                    }))} />
                </label>
                <label className="field">
                  <span>Fin</span>
                  <input required disabled={!auth || saving} type="datetime-local" value={form.end_time}
                    onChange={(e) => setForm((c) => ({ ...c, end_time: e.target.value }))} />
                </label>
                <label className="checkbox-field">
                  <input type="checkbox" checked={form.is_recurring} disabled={!auth || saving}
                    onChange={(e) => setForm((c) => ({ ...c, is_recurring: e.target.checked }))} />
                  <span>Repetir cita</span>
                </label>
                {form.is_recurring ? (
                  <div className="recurrence-panel">
                    <label className="field">
                      <span>Periodicidad</span>
                      <select disabled={!auth || saving} value={form.recurrence_type}
                        onChange={(e) => setForm((c) => ({ ...c, recurrence_type: e.target.value }))}>
                        <option value="SEMANAL">Semanal</option>
                        <option value="MENSUAL">Mensual</option>
                        <option value="TRIMESTRAL">Trimestral</option>
                      </select>
                    </label>
                    <p>{recurrenceSummary()}</p>
                  </div>
                ) : null}
                {conflictingReservation ? (
                  <div className="conflict-warning" role="alert">
                    <strong>Tramo ocupado</strong>
                    <span>{TIME_FORMAT.format(new Date(conflictingReservation.start_time))} - {TIME_FORMAT.format(new Date(conflictingReservation.end_time))} por {conflictingReservation.user_username || "otro usuario"}.</span>
                  </div>
                ) : (
                  <div className="availability-ok" role="status">Tramo disponible segun las reservas cargadas.</div>
                )}
                <div className="flex flex-wrap gap-2 pt-1">
                  <button className="btn btn-primary" type="submit" disabled={!auth || saving || Boolean(conflictingReservation)}>
                    {saving ? "Guardando..." : editingId ? "Actualizar" : "Enviar Solicitud"}
                  </button>
                  {editingId && (
                    <button className="btn btn-secondary" type="button"
                      onClick={() => { setEditingId(null); setForm(createDefaultForm(selectedDate)); }}>
                      Cancelar
                    </button>
                  )}
                </div>
              </form>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}
