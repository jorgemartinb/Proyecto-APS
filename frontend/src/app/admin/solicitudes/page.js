"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { redirect } from "next/navigation";
import { useAuth } from "../../context/AuthContext";
import Alert from "../../components/Alert";
import { DAY_FORMAT, TIME_FORMAT, CURRENCY_FORMAT, normalizeError } from "../../lib/utils";

function getPedidoPropuesta(propuesta) {
  return propuesta.numero_pedido || (propuesta.id ? `PL-${String(propuesta.id).padStart(6, "0")}` : "Pendiente");
}

export default function SolicitudesPage() {
  const { auth, request, isAdmin } = useAuth();
  const [reservations, setReservations] = useState([]);
  const [socios, setSocios] = useState([]);
  const [propuestas, setPropuestas] = useState([]);
  const [prestamosLibros, setPrestamosLibros] = useState([]);
  const [compras, setCompras] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  if (!auth || !isAdmin) redirect("/");

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [res, soc, prop, prest, comp] = await Promise.all([
        request("/reservations/"),
        request("/admin/users/"),
        request("/propuestas/"),
        request("/admin/prestamos/libros/"),
        request("/compras/"),
      ]);
      setReservations(res);
      setSocios(soc);
      setPropuestas(prop);
      setPrestamosLibros(prest);
      setCompras(comp);
    } catch (err) {
      setError(`Error al cargar los datos. ${normalizeError(err)}`);
    } finally {
      setLoading(false);
    }
  }, [request]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void loadAll(); }, [loadAll]);

  const reservasPendientes = useMemo(() => reservations.filter((r) => r.estado === "PENDIENTE"), [reservations]);
  const sociosPendientes = useMemo(() => socios.filter((s) => s.estado_socio === "PENDIENTE"), [socios]);
  const propuestasPendientes = useMemo(() => propuestas.filter((p) => p.estado === "PENDIENTE"), [propuestas]);
  const prestamosPendientes = useMemo(() => prestamosLibros.filter((p) => p.estado === "PENDIENTE"), [prestamosLibros]);
  const comprasPendientes = useMemo(() => compras.filter((c) => c.estado === "SOLICITADO"), [compras]);

  async function handleReserva(id, estado) {
    setSaving(true);
    try {
      await request(`/reservations/${id}/`, { method: "PATCH", body: JSON.stringify({ estado }) });
      await loadAll();
      setStatus(`Reserva ${estado === "ACEPTADA" ? "aceptada" : "rechazada"}.`);
    } catch (err) { setError(normalizeError(err)); } finally { setSaving(false); }
  }

  async function handleSocio(id, estado) {
    setSaving(true);
    try {
      await request(`/admin/users/${id}/`, { method: "PATCH", body: JSON.stringify({ estado_socio: estado }) });
      await loadAll();
      setStatus("Estado de socio actualizado.");
    } catch (err) { setError(normalizeError(err)); } finally { setSaving(false); }
  }

  async function handlePrestamo(id, action, payload = {}) {
    setSaving(true);
    try {
      await request(`/admin/prestamos/libros/${id}/${action}/`, { method: "POST", body: JSON.stringify(payload) });
      await loadAll();
      setStatus("Préstamo actualizado.");
    } catch (err) { setError(normalizeError(err)); } finally { setSaving(false); }
  }

  async function handleCompra(id, action, nombre) {
    setSaving(true);
    try {
      await request(`/admin/compras/${id}/${action}/`, { method: "POST" });
      await loadAll();
      setStatus(`"${nombre}" actualizado.`);
    } catch (err) { setError(normalizeError(err)); } finally { setSaving(false); }
  }

  async function handlePropuesta(id, estado) {
    setSaving(true);
    try {
      await request(`/propuestas/${id}/`, { method: "PATCH", body: JSON.stringify({ estado }) });
      await loadAll();
      setStatus("Propuesta actualizada.");
    } catch (err) { setError(normalizeError(err)); } finally { setSaving(false); }
  }

  const totalPendiente = reservasPendientes.length + sociosPendientes.length + propuestasPendientes.length + prestamosPendientes.length + comprasPendientes.length;

  return (
    <main className="min-h-screen text-slate-950">
      <Alert status={status} error={error} onClose={() => { setError(""); setStatus(""); }} />
      <div className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 lg:px-8 space-y-8">
        <div className="panel">
          <h1 className="text-2xl font-bold text-slate-950">Solicitudes Pendientes</h1>
          <p className="mt-1 text-sm text-slate-600">{loading ? "Cargando..." : `${totalPendiente} elemento${totalPendiente !== 1 ? "s" : ""} pendiente${totalPendiente !== 1 ? "s" : ""} de revisión.`}</p>
        </div>

        {/* Reservas */}
        <section className="panel">
          <h2 className="text-xl font-bold text-slate-950 mb-2">Solicitudes de Reserva</h2>
          {reservasPendientes.length === 0 ? <p className="text-center py-8 text-slate-500 bg-slate-50 border border-dashed rounded-lg">🎉 No quedan solicitudes pendientes de aprobación.</p> : (
            <div className="flex flex-col gap-4">
              {reservasPendientes.map((r) => (
                <div key={r.id} className="bg-white border border-amber-200 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
                  <div>
                    <span className="bg-amber-100 text-amber-800 text-xs px-2 py-0.5 rounded font-semibold uppercase">Pendiente</span>
                    <h3 className="font-bold text-slate-900 text-lg mt-1">{r.title}</h3>
                    <p className="text-sm text-slate-600">Solicitado por: <span className="font-semibold">@{r.user_username}</span></p>
                    <p className="text-sm text-emerald-800 font-medium mt-2">📅 {DAY_FORMAT.format(new Date(r.start_time))} | ⏰ {TIME_FORMAT.format(new Date(r.start_time))} - {TIME_FORMAT.format(new Date(r.end_time))}</p>
                  </div>
                  <div className="flex sm:flex-col gap-2 shrink-0">
                    <button className="bg-emerald-600 text-white px-4 py-2 rounded-lg font-semibold text-sm hover:bg-emerald-700 transition" onClick={() => handleReserva(r.id, "ACEPTADA")} disabled={saving}>Aceptar</button>
                    <button className="bg-rose-50 text-rose-700 border border-rose-200 px-4 py-2 rounded-lg font-semibold text-sm hover:bg-rose-100 transition" onClick={() => handleReserva(r.id, "RECHAZADA")} disabled={saving}>Rechazar</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Socios */}
        <section className="panel">
          <h2 className="text-xl font-bold text-slate-950 mb-2">Solicitudes de Alta como Socio</h2>
          {sociosPendientes.length === 0 ? <p className="text-center py-8 text-slate-500 bg-slate-50 border border-dashed rounded-lg">🎉 No hay nuevas solicitudes de alta como socio.</p> : (
            <div className="flex flex-col gap-4">
              {sociosPendientes.map((s) => (
                <div key={s.id} className="bg-white border border-emerald-200 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
                  <div>
                    <span className="bg-emerald-100 text-emerald-800 text-xs px-2 py-0.5 rounded font-semibold uppercase">Alta Solicitada</span>
                    <h3 className="font-bold text-slate-900 text-lg mt-1">{s.last_name ? `${s.last_name}, ${s.first_name}` : s.first_name || s.username}</h3>
                    <p className="text-sm text-slate-600">@{s.username} | {s.email}</p>
                    <p className="text-sm text-emerald-800 font-medium mt-2">DNI: {s.dni_nif} | Tel: {s.telefono}</p>
                  </div>
                  <div className="flex flex-wrap sm:flex-col gap-2 shrink-0">
                    <button className="bg-emerald-600 text-white px-4 py-2 rounded-lg font-semibold text-sm hover:bg-emerald-700 transition" onClick={() => handleSocio(s.id, "ACEPTADA")} disabled={saving}>Aprobar Socio</button>
                    <button className="bg-rose-50 text-rose-700 border border-rose-200 px-4 py-2 rounded-lg font-semibold text-sm hover:bg-rose-100 transition" onClick={() => { if (confirm(`¿Rechazar @${s.username}?`)) handleSocio(s.id, "RECHAZADA"); }} disabled={saving}>Rechazar</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Préstamos */}
        <section className="panel">
          <h2 className="text-xl font-bold text-slate-950 mb-2">Solicitudes de Préstamo de Libros</h2>
          {prestamosPendientes.length === 0 ? <p className="text-center py-8 text-slate-500 bg-slate-50 border border-dashed rounded-lg">No hay solicitudes de libros pendientes.</p> : (
            <div className="flex flex-col gap-4">
              {prestamosPendientes.map((p) => (
                <div key={p.id} className="bg-white border border-amber-200 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
                  <div>
                    <span className="bg-amber-100 text-amber-800 text-xs px-2 py-0.5 rounded font-semibold uppercase">Libro pendiente</span>
                    <h3 className="font-bold text-slate-900 text-lg mt-1">{p.libro_titulo}</h3>
                    <p className="text-sm text-slate-600">Solicitado por: <span className="font-semibold">@{p.usuario_username}</span></p>
                  </div>
                  <div className="flex flex-wrap sm:flex-col gap-2 shrink-0">
                    <button className="bg-emerald-600 text-white px-4 py-2 rounded-lg font-semibold text-sm hover:bg-emerald-700 transition" onClick={() => handlePrestamo(p.id, "aprobar")} disabled={saving}>Aprobar</button>
                    <button className="bg-blue-50 text-blue-700 border border-blue-200 px-4 py-2 rounded-lg font-semibold text-sm hover:bg-blue-100 transition" onClick={() => handlePrestamo(p.id, "prestar")} disabled={saving}>Marcar entregado</button>
                    <button className="bg-rose-50 text-rose-700 border border-rose-200 px-4 py-2 rounded-lg font-semibold text-sm hover:bg-rose-100 transition" onClick={() => { const m = window.prompt("Motivo (opcional)") || ""; handlePrestamo(p.id, "rechazar", { motivo_rechazo: m }); }} disabled={saving}>Rechazar</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Compras */}
        <section className="panel">
          <h2 className="text-xl font-bold text-slate-950 mb-2">Solicitudes de Lista de la Compra</h2>
          {comprasPendientes.length === 0 ? <p className="text-center py-8 text-slate-500 bg-slate-50 border border-dashed rounded-lg">No hay objetos pendientes en la lista de la compra.</p> : (
            <div className="flex flex-col gap-4">
              {comprasPendientes.map((c) => (
                <div key={c.id} className="bg-white border border-amber-200 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
                  <div>
                    <span className="bg-amber-100 text-amber-800 text-xs px-2 py-0.5 rounded font-semibold uppercase">Compra solicitada</span>
                    <h3 className="font-bold text-slate-900 text-lg mt-1">{c.nombre}</h3>
                    <p className="text-sm text-slate-600">Solicitado por: <span className="font-semibold">@{c.solicitante_username}</span></p>
                    <p className="text-sm text-emerald-800 font-medium mt-2">{CURRENCY_FORMAT.format(Number(c.precio_aproximado || 0))}</p>
                    {c.descripcion && <p className="text-sm text-slate-500 mt-2">{c.descripcion}</p>}
                  </div>
                  <div className="flex flex-wrap sm:flex-col gap-2 shrink-0">
                    <button className="bg-emerald-600 text-white px-4 py-2 rounded-lg font-semibold text-sm hover:bg-emerald-700 transition" onClick={() => handleCompra(c.id, "aprobar", c.nombre)} disabled={saving}>Aprobar</button>
                    <button className="bg-blue-50 text-blue-700 border border-blue-200 px-4 py-2 rounded-lg font-semibold text-sm hover:bg-blue-100 transition" onClick={() => handleCompra(c.id, "comprado", c.nombre)} disabled={saving}>Marcar comprada</button>
                    <button className="bg-rose-50 text-rose-700 border border-rose-200 px-4 py-2 rounded-lg font-semibold text-sm hover:bg-rose-100 transition" onClick={() => handleCompra(c.id, "rechazar", c.nombre)} disabled={saving}>Rechazar</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Propuestas */}
        <section className="panel">
          <h2 className="text-xl font-bold text-slate-950 mb-2">Propuestas de Pleno Pendientes</h2>
          {propuestasPendientes.length === 0 ? <p className="text-center py-8 text-slate-500 bg-slate-50 border border-dashed rounded-lg">🎉 No hay propuestas de pleno pendientes.</p> : (
            <div className="flex flex-col gap-4">
              {propuestasPendientes.map((p) => (
                <div key={p.id} className="bg-white border border-emerald-200 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
                  <div>
                    <span className="bg-amber-100 text-amber-800 text-xs px-2 py-0.5 rounded font-semibold uppercase">Propuesta Pendiente</span>
                    <h3 className="font-bold text-slate-900 text-lg mt-1">{p.titulo}</h3>
                    <p className="text-xs font-bold text-emerald-700 mt-1">Nº pedido: {getPedidoPropuesta(p)}</p>
                    <p className="text-sm text-slate-600">Enviada por: <span className="font-semibold">@{p.vecino_username}</span></p>
                    <p className="text-sm text-slate-500 mt-2 italic line-clamp-1">&quot;{p.descripcion}&quot;</p>
                  </div>
                  <div className="flex flex-wrap sm:flex-col gap-2 shrink-0">
                    <button className="bg-emerald-600 text-white px-4 py-2 rounded-lg font-semibold text-sm hover:bg-emerald-700 transition" onClick={() => handlePropuesta(p.id, "PRESENTADA")} disabled={saving}>Marcar Presentada</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
