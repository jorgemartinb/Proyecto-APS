"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import Alert from "../components/Alert";
import BookLoanItem from "../components/BookLoanItem";
import FichaField from "../components/FichaField";
import { normalizeError, formatDateOnly } from "../lib/utils";

export default function BibliotecaPage() {
  const { auth, request, isAdmin, currentUser, socioActivo } = useAuth();
  const [libros, setLibros] = useState([]);
  const [prestamosLibros, setPrestamosLibros] = useState([]);
  const [loadingBiblioteca, setLoadingBiblioteca] = useState(false);
  const [libroSearch, setLibroSearch] = useState("");
  const [libroDisponibilidad, setLibroDisponibilidad] = useState("");
  const [editingLibroId, setEditingLibroId] = useState(null);
  const [selectedPrestamoFicha, setSelectedPrestamoFicha] = useState(null);
  const [libroForm, setLibroForm] = useState({ titulo: "", autor: "", editorial: "", categoria: "", isbn: "", etiqueta: "", disponibilidad: "DISPONIBLE", activo: true });
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const loadBiblioteca = useCallback(async () => {
    setLoadingBiblioteca(true);
    try {
      const data = await request("/libros/");
      setLibros(data);
      if (auth) {
        const prestamos = await request(isAdmin ? "/admin/prestamos/libros/" : "/prestamos/libros/mios/");
        setPrestamosLibros(prestamos);
      } else {
        setPrestamosLibros([]);
      }
    } catch (err) {
      setError(`No se pudo cargar la biblioteca. ${normalizeError(err)}`);
    } finally {
      setLoadingBiblioteca(false);
    }
  }, [auth, isAdmin, request]);

  useEffect(() => { void loadBiblioteca(); }, [loadBiblioteca]);

  const filteredLibros = useMemo(() => {
    let result = libros.filter((l) => l.activo);
    if (libroDisponibilidad) result = result.filter((l) => l.disponibilidad === libroDisponibilidad);
    const term = libroSearch.trim().toLowerCase();
    if (!term) return result;
    return result.filter((l) => [l.titulo, l.autor, l.categoria, l.isbn].filter(Boolean).join(" ").toLowerCase().includes(term));
  }, [libroDisponibilidad, libroSearch, libros]);

  const misPrestamosLibros = useMemo(
    () => prestamosLibros.filter((p) => !isAdmin || p.usuario_username === currentUser),
    [currentUser, isAdmin, prestamosLibros],
  );
  const prestamosPendientesAdmin = useMemo(() => prestamosLibros.filter((p) => p.estado === "PENDIENTE"), [prestamosLibros]);
  const prestamosActivosAdmin = useMemo(() => prestamosLibros.filter((p) => ["APROBADA", "PRESTADA", "VENCIDA"].includes(p.estado)), [prestamosLibros]);

  function resetLibroForm() {
    setEditingLibroId(null);
    setLibroForm({ titulo: "", autor: "", editorial: "", categoria: "", isbn: "", etiqueta: "", disponibilidad: "DISPONIBLE", activo: true });
  }

  function startEditingLibro(libro) {
    setEditingLibroId(libro.id);
    setLibroForm({ titulo: libro.titulo || "", autor: libro.autor || "", editorial: libro.editorial || "", categoria: libro.categoria || "", isbn: libro.isbn || "", etiqueta: libro.etiqueta || "", disponibilidad: libro.disponibilidad || "DISPONIBLE", activo: Boolean(libro.activo) });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleLibroSubmit(event) {
    event.preventDefault();
    if (!isAdmin) return;
    setSaving(true);
    setError("");
    setStatus("");
    try {
      const payload = { ...libroForm, titulo: libroForm.titulo.trim(), autor: libroForm.autor.trim(), editorial: libroForm.editorial.trim(), categoria: libroForm.categoria.trim(), isbn: libroForm.isbn.trim() || null, etiqueta: libroForm.etiqueta.trim() || null };
      await request(editingLibroId ? `/libros/${editingLibroId}/` : "/libros/", { method: editingLibroId ? "PATCH" : "POST", body: JSON.stringify(payload) });
      resetLibroForm();
      await loadBiblioteca();
      setStatus(editingLibroId ? "Libro actualizado." : "Libro creado.");
    } catch (err) {
      setError(normalizeError(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleSolicitarLibro(libro) {
    if (!auth) { setError("Inicia sesion para solicitar prestamos."); return; }
    setSaving(true);
    setError("");
    setStatus("");
    try {
      await request("/prestamos/libros/solicitar/", { method: "POST", body: JSON.stringify({ libro: libro.id }) });
      await loadBiblioteca();
      setStatus("Solicitud enviada. Queda pendiente de aprobacion administrativa.");
    } catch (err) {
      setError(normalizeError(err));
    } finally {
      setSaving(false);
    }
  }

  async function handlePrestamoLibroAction(prestamo, action, payload = {}) {
    setSaving(true);
    setError("");
    setStatus("");
    try {
      await request(`/admin/prestamos/libros/${prestamo.id}/${action}/`, { method: "POST", body: JSON.stringify(payload) });
      await loadBiblioteca();
      setStatus("Prestamo actualizado.");
    } catch (err) {
      setError(normalizeError(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteLibro(libro) {
    if (!window.confirm(`¿Eliminar "${libro.titulo}" del catalogo?`)) return;
    setSaving(true);
    setError("");
    setStatus("");
    try {
      await request(`/libros/${libro.id}/`, { method: "DELETE" });
      await loadBiblioteca();
      if (editingLibroId === libro.id) resetLibroForm();
      setStatus("Libro eliminado del catalogo.");
    } catch (err) {
      setError(normalizeError(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen text-slate-950">
      <Alert status={status} error={error} onClose={() => { setError(""); setStatus(""); }} />
      <div className="mx-auto grid w-full max-w-7xl gap-5 px-4 py-5 sm:px-6 lg:grid-cols-[minmax(0,1fr)_390px] lg:px-8">
        <section className="panel">
          <div className="section-title">
            <div>
              <h1 className="text-xl font-semibold text-slate-950">Biblioteca feminista</h1>
              <p className="mt-1 text-sm text-slate-600">Catálogo de libros y solicitudes de préstamo.</p>
            </div>
            <span className="text-sm font-bold text-emerald-700">{libros.filter((l) => l.activo).length} activos</span>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_220px]">
            <label className="field">
              <span>Buscar</span>
              <input value={libroSearch} onChange={(e) => setLibroSearch(e.target.value)} placeholder="Titulo, autora, categoria o ISBN" />
            </label>
            <label className="field">
              <span>Disponibilidad</span>
              <select className="w-full rounded border border-slate-300 bg-white p-2 text-sm" value={libroDisponibilidad} onChange={(e) => setLibroDisponibilidad(e.target.value)}>
                <option value="">Todas</option>
                <option value="DISPONIBLE">Disponibles</option>
                <option value="NO_DISPONIBLE">No disponibles</option>
              </select>
            </label>
          </div>
          <div className="mt-5 grid gap-3">
            {loadingBiblioteca ? <p className="empty">Cargando biblioteca...</p> : null}
            {!loadingBiblioteca && filteredLibros.length === 0 ? <p className="empty">No hay libros que coincidan con los filtros.</p> : null}
            {filteredLibros.map((libro) => {
              const puedeLibro = socioActivo && libro.activo && libro.disponibilidad === "DISPONIBLE";
              return (
                <article key={libro.id} className="rounded-lg border border-slate-200 bg-white p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap gap-2">
                        <span className={`rounded px-2 py-0.5 text-xs font-bold ${libro.activo && libro.disponibilidad === "DISPONIBLE" ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-700"}`}>
                          {!libro.activo ? "Inactivo" : libro.disponibilidad === "DISPONIBLE" ? "Disponible" : "No disponible"}
                        </span>
                        {libro.categoria ? <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">{libro.categoria}</span> : null}
                      </div>
                      <h3 className="mt-2 text-lg font-bold text-slate-950">{libro.titulo}</h3>
                      <p className="text-sm text-slate-600">{libro.autor || "Autoría no indicada"}</p>
                      <p className="mt-1 text-xs text-slate-500">{[libro.editorial, libro.isbn ? `ISBN: ${libro.isbn}` : "ISBN no disponible", libro.etiqueta].filter(Boolean).join(" · ")}</p>
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      <button className="btn btn-primary" type="button" onClick={() => handleSolicitarLibro(libro)} disabled={!puedeLibro || saving}>Solicitar préstamo</button>
                      {isAdmin && (
                        <>
                          <button className="btn btn-secondary" type="button" onClick={() => startEditingLibro(libro)}>Editar</button>
                          <button className="icon-action danger" type="button" onClick={() => handleDeleteLibro(libro)} disabled={saving}>Eliminar</button>
                        </>
                      )}
                    </div>
                  </div>
                  {!auth ? <p className="mt-3 text-xs font-semibold text-slate-500">Inicia sesión para solicitar préstamos.</p> : null}
                  {auth && !socioActivo ? <p className="mt-3 text-xs font-semibold text-amber-700">Solo los socios activos pueden solicitar préstamos.</p> : null}
                </article>
              );
            })}
          </div>
        </section>

        <aside className="flex flex-col gap-5">
          <section className="panel">
            <h2 className="text-lg font-semibold text-slate-950">Mis préstamos</h2>
            <div className="mt-4 flex flex-col gap-3">
              {!auth ? <p className="empty">Inicia sesión para ver tus solicitudes.</p> : null}
              {auth && misPrestamosLibros.length === 0 ? <p className="empty">No tienes solicitudes ni préstamos.</p> : null}
              {misPrestamosLibros.slice(0, 8).map((p) => (
                <BookLoanItem key={p.id} prestamo={p} onFicha={setSelectedPrestamoFicha} />
              ))}
            </div>
          </section>

          {isAdmin && (
            <>
              <section className="panel">
                <h2 className="text-lg font-semibold text-slate-950">{editingLibroId ? "Editar libro" : "Alta de libro"}</h2>
                <form className="mt-4 flex flex-col gap-3" onSubmit={handleLibroSubmit}>
                  {[["Titulo", "titulo"], ["Autor/a", "autor"], ["Editorial", "editorial"], ["Categoría", "categoria"], ["ISBN", "isbn"], ["Etiqueta", "etiqueta"]].map(([label, key]) => (
                    <label key={key} className="field"><span>{label}</span>
                      <input value={libroForm[key]} onChange={(e) => setLibroForm({ ...libroForm, [key]: e.target.value })} /></label>
                  ))}
                  <label className="field"><span>Disponibilidad</span>
                    <select className="w-full rounded border border-slate-300 bg-white p-2 text-sm" value={libroForm.disponibilidad} onChange={(e) => setLibroForm({ ...libroForm, disponibilidad: e.target.value })}>
                      <option value="DISPONIBLE">Disponible</option>
                      <option value="NO_DISPONIBLE">No disponible</option>
                    </select>
                  </label>
                  <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                    <input type="checkbox" checked={libroForm.activo} onChange={(e) => setLibroForm({ ...libroForm, activo: e.target.checked })} />
                    Activo en catálogo
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <button className="btn btn-primary" type="submit" disabled={saving}>{editingLibroId ? "Actualizar" : "Crear libro"}</button>
                    {editingLibroId && <button className="btn btn-secondary" type="button" onClick={resetLibroForm}>Cancelar</button>}
                  </div>
                </form>
              </section>

              <section className="panel">
                <h2 className="text-lg font-semibold text-slate-950">Control de préstamos</h2>
                <div className="mt-4 flex flex-col gap-3">
                  {prestamosPendientesAdmin.length === 0 && prestamosActivosAdmin.length === 0 ? <p className="empty">No hay solicitudes pendientes ni préstamos activos.</p> : null}
                  {[...prestamosPendientesAdmin, ...prestamosActivosAdmin].map((p) => (
                    <BookLoanItem key={p.id} admin prestamo={p} saving={saving}
                      onFicha={setSelectedPrestamoFicha}
                      onAprobar={() => handlePrestamoLibroAction(p, "aprobar")}
                      onPrestar={() => handlePrestamoLibroAction(p, "prestar")}
                      onRechazar={() => { const motivo = window.prompt("Motivo de rechazo (opcional)") || ""; handlePrestamoLibroAction(p, "rechazar", { motivo_rechazo: motivo }); }}
                      onDevolver={() => handlePrestamoLibroAction(p, "devolver")}
                    />
                  ))}
                </div>
              </section>
            </>
          )}
        </aside>
      </div>

      {selectedPrestamoFicha && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="loan-sheet max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-lg bg-white p-6 shadow-2xl">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">Asociacion Vecinal 3C</p>
                <h2 className="text-2xl font-bold text-slate-950">Ficha de préstamo de libro</h2>
              </div>
              <div className="flex gap-2 print:hidden">
                <button className="btn btn-secondary" type="button" onClick={() => window.print()}>Imprimir</button>
                <button className="btn btn-secondary" type="button" onClick={() => setSelectedPrestamoFicha(null)}>Cerrar</button>
              </div>
            </div>
            <div className="grid gap-3 text-sm sm:grid-cols-2">
              <FichaField label="Lector" value={selectedPrestamoFicha.usuario_nombre} />
              <FichaField label="Número de socio" value={selectedPrestamoFicha.usuario_numero_socio || "No disponible"} />
              <FichaField label="Teléfono" value={selectedPrestamoFicha.usuario_telefono || "No disponible"} />
              <FichaField label="Correo electrónico" value={selectedPrestamoFicha.usuario_email || "No disponible"} />
              <FichaField label="Fecha" value={formatDateOnly(selectedPrestamoFicha.fecha_aprobacion || selectedPrestamoFicha.fecha_solicitud)} />
              <FichaField label="Fecha prevista de devolución" value={selectedPrestamoFicha.fecha_prevista_devolucion || "Pendiente"} />
              <FichaField label="Título" value={selectedPrestamoFicha.libro_titulo} wide />
              <FichaField label="Estado" value={selectedPrestamoFicha.estado} />
            </div>
            <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-4">
              <h3 className="font-bold text-slate-900">Condiciones</h3>
              <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-700">
                <li>El préstamo de libros es de un plazo de 15 días.</li>
                <li>Los libros deben devolverse a la Asociación Vecinal 3C.</li>
                <li>El préstamo está reservado a socios de la Asociación Vecinal 3C.</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
