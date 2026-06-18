"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import Alert from "../components/Alert";
import CompraStatusBadge from "../components/CompraStatusBadge";
import Metric from "../components/Metric";
import { CURRENCY_FORMAT, normalizeError } from "../lib/utils";

export default function ComprasPage() {
  const { auth, request, isAdmin, socioActivo, canRequestCompras } = useAuth();
  const [compras, setCompras] = useState([]);
  const [loadingCompras, setLoadingCompras] = useState(false);
  const [compraSearch, setCompraSearch] = useState("");
  const [compraForm, setCompraForm] = useState({ nombre: "", precio_aproximado: "", descripcion: "", estado: "APROBADO" });
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const loadCompras = useCallback(async () => {
    if (!auth) { setCompras([]); return; }
    setLoadingCompras(true);
    try {
      const data = await request("/compras/");
      setCompras(data);
    } catch (err) {
      setError(`No se pudo cargar la lista de la compra. ${normalizeError(err)}`);
    } finally {
      setLoadingCompras(false);
    }
  }, [auth, request]);

  useEffect(() => { void loadCompras(); }, [loadCompras]);

  const filteredCompras = useMemo(() => {
    const term = compraSearch.trim().toLowerCase();
    if (!term) return compras;
    return compras.filter((c) => [c.nombre, c.descripcion, c.solicitante_username, c.solicitante_nombre].filter(Boolean).join(" ").toLowerCase().includes(term));
  }, [compraSearch, compras]);

  const comprasPendientesAdmin = useMemo(() => compras.filter((c) => c.estado === "SOLICITADO"), [compras]);
  const totalComprasPendientes = useMemo(() => compras.filter((c) => ["SOLICITADO", "APROBADO"].includes(c.estado)).reduce((sum, c) => sum + Number(c.precio_aproximado || 0), 0), [compras]);
  const comprasCompradas = useMemo(() => compras.filter((c) => c.estado === "COMPRADO"), [compras]);

  function resetCompraForm() { setCompraForm({ nombre: "", precio_aproximado: "", descripcion: "", estado: "APROBADO" }); }

  async function handleCompraSubmit(event) {
    event.preventDefault();
    if (!auth) { setError("Inicia sesion para usar la lista de la compra."); return; }
    if (!canRequestCompras) { setError("Solo los socios activos y las administradoras pueden solicitar objetos."); return; }
    const precio = Number.parseFloat(compraForm.precio_aproximado);
    if (Number.isNaN(precio)) { setError("Introduce un precio aproximado valido."); return; }
    setSaving(true);
    setError("");
    setStatus("");
    try {
      const payload = { nombre: compraForm.nombre.trim(), precio_aproximado: Number(precio.toFixed(2)), descripcion: compraForm.descripcion.trim() };
      if (isAdmin) payload.estado = compraForm.estado;
      await request("/compras/", { method: "POST", body: JSON.stringify(payload) });
      resetCompraForm();
      await loadCompras();
      setStatus(isAdmin ? "Objeto añadido a la lista de la compra." : "Solicitud enviada correctamente.");
    } catch (err) {
      setError(normalizeError(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleCompraAction(compra, action, successMessage) {
    setSaving(true);
    setError("");
    setStatus("");
    try {
      await request(`/admin/compras/${compra.id}/${action}/`, { method: "POST" });
      await loadCompras();
      setStatus(successMessage);
    } catch (err) {
      setError(normalizeError(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteCompra(compra) {
    if (!window.confirm(`¿Eliminar "${compra.nombre}" de la lista de la compra?`)) return;
    setSaving(true);
    setError("");
    setStatus("");
    try {
      await request(`/compras/${compra.id}/`, { method: "DELETE" });
      await loadCompras();
      setStatus("Objeto eliminado de la lista de la compra.");
    } catch (err) {
      setError(normalizeError(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen text-slate-950">
      <Alert status={status} error={error} onClose={() => { setError(""); setStatus(""); }} />
      <div className="mx-auto grid w-full max-w-7xl gap-5 px-4 py-5 sm:px-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:px-8">
        <section className="panel">
          <div className="section-title">
            <div>
              <h1 className="text-xl font-semibold text-slate-950">Lista de la compra</h1>
              <p className="mt-1 text-sm text-slate-600">
                {isAdmin ? "Gestiona los objetos pendientes de compra del centro." : "Consulta tus solicitudes y pide nuevos objetos para el centro."}
              </p>
            </div>
            {isAdmin && <span className="text-sm font-bold text-emerald-700">Pendiente: {CURRENCY_FORMAT.format(totalComprasPendientes)}</span>}
          </div>

          {isAdmin && (
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <Metric label="Solicitudes" value={comprasPendientesAdmin.length} />
              <Metric label="Pendiente compra" value={CURRENCY_FORMAT.format(totalComprasPendientes)} />
              <Metric label="Compradas" value={comprasCompradas.length} />
            </div>
          )}

          <div className="mt-5">
            <label className="field max-w-md">
              <span>Buscar</span>
              <input value={compraSearch} onChange={(e) => setCompraSearch(e.target.value)} placeholder={isAdmin ? "Objeto, descripcion o solicitante" : "Objeto o descripcion"} />
            </label>
          </div>

          <div className="mt-5 flex flex-col gap-3">
            {!auth ? <p className="empty">Inicia sesión para ver la lista de la compra.</p> : null}
            {auth && loadingCompras ? <p className="empty">Cargando lista de la compra...</p> : null}
            {auth && !loadingCompras && filteredCompras.length === 0 ? <p className="empty">No hay objetos que coincidan con la búsqueda.</p> : null}
            {filteredCompras.map((compra) => (
              <article key={compra.id} className="rounded-lg border border-slate-200 bg-white p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <CompraStatusBadge estado={compra.estado} />
                      <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                        {CURRENCY_FORMAT.format(Number(compra.precio_aproximado || 0))}
                      </span>
                    </div>
                    <h3 className="mt-2 text-lg font-bold text-slate-950">{compra.nombre}</h3>
                    <p className="text-sm text-slate-600">Solicitado por <span className="font-semibold">@{compra.solicitante_username}</span></p>
                    <p className="mt-1 text-xs text-slate-500">Fecha: {new Date(compra.fecha_solicitud).toLocaleDateString("es-ES")}</p>
                    {compra.descripcion ? <p className="mt-2 text-sm text-slate-600">{compra.descripcion}</p> : null}
                  </div>
                  {isAdmin && (
                    <div className="flex shrink-0 flex-wrap gap-2">
                      {compra.estado === "SOLICITADO" && <button className="icon-action" type="button" onClick={() => handleCompraAction(compra, "aprobar", `Compra "${compra.nombre}" aprobada.`)} disabled={saving}>Aprobar</button>}
                      {["SOLICITADO", "APROBADO"].includes(compra.estado) && <button className="icon-action" type="button" onClick={() => handleCompraAction(compra, "comprado", `"${compra.nombre}" marcada como comprada.`)} disabled={saving}>Comprado</button>}
                      {["SOLICITADO", "APROBADO"].includes(compra.estado) && <button className="icon-action danger" type="button" onClick={() => handleCompraAction(compra, "rechazar", `"${compra.nombre}" rechazada.`)} disabled={saving}>Rechazar</button>}
                      <button className="icon-action danger" type="button" onClick={() => handleDeleteCompra(compra)} disabled={saving}>Eliminar</button>
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>

        <aside className="flex flex-col gap-5">
          <section className="panel">
            <h2 className="text-lg font-semibold text-slate-950">{isAdmin ? "Añadir objeto" : "Solicitar objeto"}</h2>
            <p className="mt-1 text-sm text-slate-600">
              {isAdmin ? "Puedes crear objetos directamente y elegir su estado inicial." : "La solicitud quedará pendiente de revisión administrativa."}
            </p>
            {!auth ? (
              <p className="empty mt-4">Inicia sesión para solicitar objetos.</p>
            ) : !isAdmin && !socioActivo ? (
              <p className="empty mt-4">Solo los socios activos pueden solicitar objetos en esta sección.</p>
            ) : (
              <form className="mt-4 flex flex-col gap-3" onSubmit={handleCompraSubmit}>
                <label className="field"><span>Nombre</span>
                  <input required value={compraForm.nombre} onChange={(e) => setCompraForm({ ...compraForm, nombre: e.target.value })} placeholder="Ej: Cafetera, papel, bombillas..." disabled={saving} /></label>
                <label className="field"><span>Precio aproximado</span>
                  <input required type="number" min="0" step="0.01" value={compraForm.precio_aproximado} onChange={(e) => setCompraForm({ ...compraForm, precio_aproximado: e.target.value })} placeholder="0.00" disabled={saving} /></label>
                <label className="field"><span>Descripcion</span>
                  <textarea rows="4" value={compraForm.descripcion} onChange={(e) => setCompraForm({ ...compraForm, descripcion: e.target.value })} placeholder="Detalles opcionales sobre el objeto..." disabled={saving} /></label>
                {isAdmin && (
                  <label className="field"><span>Estado inicial</span>
                    <select value={compraForm.estado} onChange={(e) => setCompraForm({ ...compraForm, estado: e.target.value })} disabled={saving}>
                      <option value="APROBADO">Aprobado</option>
                      <option value="SOLICITADO">Solicitado</option>
                      <option value="COMPRADO">Comprado</option>
                      <option value="RECHAZADO">Rechazado</option>
                    </select>
                  </label>
                )}
                <div className="flex flex-wrap gap-2">
                  <button className="btn btn-primary" type="submit" disabled={saving}>
                    {saving ? "Guardando..." : isAdmin ? "Añadir objeto" : "Enviar solicitud"}
                  </button>
                  <button className="btn btn-secondary" type="button" onClick={resetCompraForm} disabled={saving}>Limpiar</button>
                </div>
              </form>
            )}
          </section>
        </aside>
      </div>
    </main>
  );
}
