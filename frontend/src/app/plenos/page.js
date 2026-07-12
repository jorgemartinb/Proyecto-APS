"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import Alert from "../components/Alert";
import { translateText, normalizeError } from "../lib/utils";

function getPedidoPropuesta(propuesta) {
  return propuesta.numero_pedido || (propuesta.id ? `PL-${String(propuesta.id).padStart(6, "0")}` : "Pendiente");
}

export default function PlenosPage() {
  const { auth, request, isAdmin } = useAuth();
  const [propuestas, setPropuestas] = useState([]);
  const [loadingPropuestas, setLoadingPropuestas] = useState(false);
  const [editingPropuestaId, setEditingPropuestaId] = useState(null);
  const [onlyPendingPropuestas, setOnlyPendingPropuestas] = useState(false);
  const [onlyPresentedPropuestas, setOnlyPresentedPropuestas] = useState(false);
  const [onlyFinalizedPropuestas, setOnlyFinalizedPropuestas] = useState(false);
  const [propuestaSearch, setPropuestaSearch] = useState("");
  const [propuestaForm, setPropuestaForm] = useState({ titulo: "", descripcion: "", estado: "PENDIENTE", fecha_registro: "", numero_registro: "", respuesta_admin: "" });
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const loadPropuestas = useCallback(async () => {
    if (!auth) return;
    setLoadingPropuestas(true);
    try {
      const data = await request("/propuestas/");
      setPropuestas(data);
    } catch (err) {
      setError(`No se pudieron cargar las propuestas. ${normalizeError(err)}`);
    } finally {
      setLoadingPropuestas(false);
    }
  }, [auth, request]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void loadPropuestas(); }, [loadPropuestas]);

  const filteredPropuestas = useMemo(() => {
    let result = propuestas;
    if (onlyPendingPropuestas || onlyPresentedPropuestas || onlyFinalizedPropuestas) {
      result = result.filter((p) =>
        (onlyPendingPropuestas && p.estado === "PENDIENTE") ||
        (onlyPresentedPropuestas && p.estado === "PRESENTADA") ||
        (onlyFinalizedPropuestas && p.estado === "FINALIZADA")
      );
    }
    const term = propuestaSearch.trim().toLowerCase();
    if (!term) return result;
    return result.filter((p) => [p.titulo, p.vecino_username].filter(Boolean).join(" ").toLowerCase().includes(term));
  }, [propuestas, onlyPendingPropuestas, onlyPresentedPropuestas, onlyFinalizedPropuestas, propuestaSearch]);

  function cancelEditingPropuesta() {
    setEditingPropuestaId(null);
    setPropuestaForm({ titulo: "", descripcion: "", estado: "PENDIENTE", fecha_registro: "", numero_registro: "", respuesta_admin: "" });
  }

  function startEditingPropuesta(p) {
    setEditingPropuestaId(p.id);
    setPropuestaForm({ ...p });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handlePropuestaSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setStatus("");
    try {
      const path = editingPropuestaId ? `/propuestas/${editingPropuestaId}/` : "/propuestas/";
      const payload = { ...propuestaForm, fecha_registro: propuestaForm.fecha_registro === "" ? null : propuestaForm.fecha_registro };
      const savedPropuesta = await request(path, { method: editingPropuestaId ? "PUT" : "POST", body: JSON.stringify(payload) });
      setStatus(editingPropuestaId ? "Propuesta actualizada." : `Propuesta enviada correctamente. Nº de pedido: ${getPedidoPropuesta(savedPropuesta)}`);
      cancelEditingPropuesta();
      await loadPropuestas();
    } catch (err) {
      setError(normalizeError(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleDeletePropuesta(id) {
    if (!window.confirm("¿Borrar esta propuesta?")) return;
    setSaving(true);
    try {
      await request(`/propuestas/${id}/`, { method: "DELETE" });
      setStatus("Propuesta eliminada.");
      await loadPropuestas();
      if (editingPropuestaId === id) cancelEditingPropuesta();
    } catch (err) {
      setError(normalizeError(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen text-slate-950">
      <Alert status={status} error={error} onClose={() => { setError(""); setStatus(""); }} />
      <div className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 lg:px-8 space-y-8">
        {!auth ? (
          <section className="panel text-center py-12">
            <p className="text-slate-600 text-lg">Inicia sesión para ver y enviar propuestas.</p>
          </section>
        ) : (
          <section className="panel">
            <h1 className="text-xl font-bold text-slate-950 mb-1">Propuestas para el Pleno Municipal</h1>
            <p className="text-sm text-slate-600 mb-6">
              {isAdmin ? "Gestión de las peticiones ciudadanas para presentar al Ayuntamiento." : "Envía tus propuestas o quejas para que la asociación las presente en el próximo pleno."}
            </p>

            <div className="mb-6 flex flex-col sm:flex-row sm:items-end gap-6">
              <label className="field max-w-md flex-1">
                <span>Buscar propuesta</span>
                <input value={propuestaSearch} onChange={(e) => setPropuestaSearch(e.target.value)}
                  placeholder={isAdmin ? "Buscar por título o usuario..." : "Buscar por título..."} />
              </label>
              <div className="flex flex-wrap gap-4 items-center pb-2">
                {[["filterPending", "Solo pendientes", onlyPendingPropuestas, setOnlyPendingPropuestas],
                  ["filterPresented", "Solo presentadas", onlyPresentedPropuestas, setOnlyPresentedPropuestas],
                  ["filterFinalized", "Solo finalizadas", onlyFinalizedPropuestas, setOnlyFinalizedPropuestas]
                ].map(([id, label, checked, setter]) => (
                  <div key={id} className="flex items-center gap-2">
                    <input type="checkbox" id={id} className="w-4 h-4 accent-emerald-600 cursor-pointer"
                      checked={checked} onChange={(e) => setter(e.target.checked)} />
                    <label htmlFor={id} className="text-sm font-semibold text-slate-700 cursor-pointer select-none">{label}</label>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
              <div className="space-y-4">
                <h3 className="font-bold text-slate-800">{isAdmin ? "Todas las propuestas" : "Mis propuestas"}</h3>
                {loadingPropuestas ? <p className="empty">Cargando propuestas...</p> : null}
                {!loadingPropuestas && filteredPropuestas.length === 0 ? <p className="empty">No hay propuestas que coincidan con los filtros.</p> : null}
                {filteredPropuestas.map((p) => (
                  <div key={p.id} className="bg-white border rounded-xl p-4 shadow-sm hover:border-emerald-200 transition">
                    <div className="flex justify-between items-start mb-2">
                      <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${
                        p.estado === "FINALIZADA" ? "bg-emerald-100 text-emerald-800"
                        : p.estado === "PRESENTADA" ? "bg-blue-100 text-blue-800"
                        : p.estado === "RECHAZADA" ? "bg-rose-100 text-rose-800"
                        : p.estado === "PENDIENTE" ? "bg-amber-100 text-amber-800"
                        : "bg-slate-100 text-slate-700"}`}>
                        {translateText(p.estado)}
                      </span>
                      <span className="text-[10px] text-slate-400 font-medium">{new Date(p.fecha_creacion).toLocaleDateString()}</span>
                    </div>
                    <h4 className="font-bold text-slate-900 mb-1">{p.titulo}</h4>
                    <p className="mb-2 text-xs font-bold text-emerald-700">Nº pedido: {getPedidoPropuesta(p)}</p>
                    <p className="text-sm text-slate-600 line-clamp-2 mb-3">{p.descripcion}</p>
                    {isAdmin && <p className="text-[10px] text-slate-500 mb-3">Vecino: <span className="font-bold">@{p.vecino_username}</span></p>}
                    {(p.numero_registro || p.respuesta_admin) && (
                      <div className="bg-slate-50 p-2 rounded text-xs border border-dashed mb-3">
                        {p.numero_registro && <p><b>Registro:</b> {p.numero_registro} ({p.fecha_registro})</p>}
                        {p.respuesta_admin && <p className="mt-1"><b>Respuesta:</b> {p.respuesta_admin}</p>}
                      </div>
                    )}
                    <div className="flex gap-2">
                      <button className="icon-action" onClick={() => startEditingPropuesta(p)}>{isAdmin ? "Gestionar" : "Ver / Editar"}</button>
                      <button className="icon-action danger" onClick={() => handleDeletePropuesta(p.id)}>Borrar</button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-4">
                <div className="panel bg-emerald-50/50 border-emerald-100 sticky top-20">
                  <h3 className="font-bold text-slate-800 mb-4">{editingPropuestaId ? (isAdmin ? "Gestionar Propuesta" : "Editar Propuesta") : "Nueva Propuesta"}</h3>
                  <form className="flex flex-col gap-3" onSubmit={handlePropuestaSubmit}>
                    <label className="field"><span>Título corto</span>
                      <input required value={propuestaForm.titulo} onChange={(e) => setPropuestaForm({ ...propuestaForm, titulo: e.target.value })} placeholder="Ej: Arreglo de baches" disabled={saving} /></label>
                    <label className="field"><span>Descripción</span>
                      <textarea required rows="4" className="w-full p-2 border rounded text-sm" value={propuestaForm.descripcion} onChange={(e) => setPropuestaForm({ ...propuestaForm, descripcion: e.target.value })} placeholder="Detalla aquí tu petición. Si es una actividad presencial o una actuación en un lugar concreto, incluye la dirección completa." disabled={saving} /></label>
                    {isAdmin && editingPropuestaId && (
                      <div className="mt-4 pt-4 border-t border-emerald-200 space-y-3">
                        <h4 className="text-xs font-bold text-emerald-800 uppercase">Gestión Administrativa</h4>
                        <label className="field"><span>Estado</span>
                          <select className="w-full p-2 border rounded text-sm bg-white" value={propuestaForm.estado} onChange={(e) => setPropuestaForm({ ...propuestaForm, estado: e.target.value })}>
                            <option value="PENDIENTE">Pendiente</option>
                            <option value="RECHAZADA">Rechazada</option>
                            <option value="PRESENTADA">Presentada por Registro</option>
                            <option value="FINALIZADA">Respondida / Finalizada</option>
                          </select>
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          <label className="field"><span>Nº Registro</span><input value={propuestaForm.numero_registro || ""} onChange={(e) => setPropuestaForm({ ...propuestaForm, numero_registro: e.target.value })} /></label>
                          <label className="field"><span>Fecha Registro</span><input type="date" value={propuestaForm.fecha_registro || ""} onChange={(e) => setPropuestaForm({ ...propuestaForm, fecha_registro: e.target.value })} /></label>
                        </div>
                        <label className="field"><span>Respuesta Ayuntamiento</span>
                          <textarea rows="3" className="w-full p-2 border rounded text-sm" value={propuestaForm.respuesta_admin || ""} onChange={(e) => setPropuestaForm({ ...propuestaForm, respuesta_admin: e.target.value })} placeholder="Resumen de la respuesta..." /></label>
                      </div>
                    )}
                    <div className="flex gap-2 pt-2">
                      <button className="btn btn-primary flex-1" type="submit" disabled={saving}>{saving ? "Guardando..." : "Guardar Propuesta"}</button>
                      {editingPropuestaId && <button className="btn btn-secondary" type="button" onClick={cancelEditingPropuesta}>Cancelar</button>}
                    </div>
                  </form>
                </div>
              </div>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
