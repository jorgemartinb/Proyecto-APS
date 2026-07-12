"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { redirect } from "next/navigation";
import { useAuth } from "../../context/AuthContext";
import Alert from "../../components/Alert";
import { translateText, normalizeError, isStrongPassword, PASSWORD_RULE_TEXT } from "../../lib/utils";

const SOCIO_FORM_INITIAL = {
  username: "", email: "", first_name: "", last_name: "", dni_nif: "", telefono: "",
  numero_socio: "", fecha_nacimiento: "", domicilio: "", numero_casa: "", piso: "",
  letra: "", localidad: "Tres Cantos", codigo_postal: "28760", email_secundario: "",
  telefono_movil_2: "", titular_cuenta: "", nif_titular: "", iban: "", entidad_bancaria: "",
  banco_entidad: "", banco_sucursal: "", banco_dc: "", banco_cuenta: "", familiares: [],
  es_socio_otras_asoc: false, cuales_otras_asoc: "", autoriza_imagenes: false,
  recibo_anual_pagado: false, fecha_pago_recibo: "", estado_socio: "NO_SOCIO", is_staff: false,
};

export default function SociosPage() {
  const { auth, request, isAdmin } = useAuth();
  const [socios, setSocios] = useState([]);
  const [loadingSocios, setLoadingSocios] = useState(false);
  const [socioSearch, setSocioSearch] = useState("");
  const [onlyActiveSocios, setOnlyActiveSocios] = useState(false);
  const [viewingSocioDetails, setViewingSocioDetails] = useState(null);
  const [editingSocioId, setEditingSocioId] = useState(null);
  const [socioForm, setSocioForm] = useState(SOCIO_FORM_INITIAL);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [adminPasswordForm, setAdminPasswordForm] = useState({
    userId: null,
    username: "",
    new_password: "",
    new_password_two: "",
  });

  if (!auth || !isAdmin) redirect("/");

  const loadSocios = useCallback(async () => {
    setLoadingSocios(true);
    try {
      const data = await request("/admin/users/");
      setSocios(data);
    } catch (err) {
      setError(`No se pudieron cargar los socios. ${normalizeError(err)}`);
    } finally {
      setLoadingSocios(false);
    }
  }, [request]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void loadSocios(); }, [loadSocios]);

  const filteredSocios = useMemo(() => {
    let result = onlyActiveSocios ? socios.filter((s) => s.estado_socio === "ACEPTADA") : socios;
    const term = socioSearch.trim().toLowerCase();
    if (!term) return result;
    return result.filter((s) => [s.username, s.email, s.first_name, s.last_name, s.dni_nif, s.telefono, s.numero_socio].filter(Boolean).join(" ").toLowerCase().includes(term));
  }, [socioSearch, socios, onlyActiveSocios]);

  function startEditingSocio(socio) {
    setEditingSocioId(socio.id);
    setSocioForm({ ...socio });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelEditingSocio() {
    setEditingSocioId(null);
    setSocioForm(SOCIO_FORM_INITIAL);
  }

  function startAdminPasswordChange(socio) {
    if (socio.id === auth.profile?.id) {
      setError("Para cambiar tu propia contraseña, usa la sección Seguridad de Mi Perfil.");
      return;
    }
    setAdminPasswordForm({
      userId: socio.id,
      username: socio.username,
      new_password: "",
      new_password_two: "",
    });
  }

  function cancelAdminPasswordChange() {
    setAdminPasswordForm({
      userId: null,
      username: "",
      new_password: "",
      new_password_two: "",
    });
  }

  async function handleAdminPasswordChange(event) {
    event.preventDefault();
    if (!adminPasswordForm.userId) return;

    setSaving(true);
    setError("");
    setStatus("");
    try {
      if (!isStrongPassword(adminPasswordForm.new_password)) {
        setError(PASSWORD_RULE_TEXT);
        return;
      }
      await request(`/admin/users/${adminPasswordForm.userId}/password/`, {
        method: "PUT",
        body: JSON.stringify({
          new_password: adminPasswordForm.new_password,
          new_password_two: adminPasswordForm.new_password_two,
        }),
      });
      setStatus(`Contraseña actualizada para @${adminPasswordForm.username}.`);
      cancelAdminPasswordChange();
    } catch (err) {
      setError(normalizeError(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateSocioSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setStatus("");
    try {
      const formData = new FormData(event.target);
      const data = Object.fromEntries(formData);
      data.es_socio = true;
      if (!data.estado_socio) data.estado_socio = editingSocioId ? socioForm.estado_socio : "ACEPTADA";
      data.autoriza_imagenes = formData.get("autoriza_imagenes") === "on";
      data.es_socio_otras_asoc = formData.get("es_socio_otras_asoc") === "on";
      data.recibo_anual_pagado = formData.get("recibo_anual_pagado") === "on";
      data.is_staff = formData.get("is_staff") === "on";
      const familiares = [];
      for (let i = 1; i <= 5; i++) {
        const nombre = formData.get(`fam_nombre_${i}`);
        if (nombre) familiares.push({ nombre, apellidos: formData.get(`fam_apellidos_${i}`), nif: formData.get(`fam_nif_${i}`), fnac: formData.get(`fam_fnac_${i}`) });
      }
      data.familiares = familiares;
      const payload = { ...data, numero_socio: data.numero_socio === "" ? null : data.numero_socio, fecha_pago_recibo: data.fecha_pago_recibo === "" ? null : data.fecha_pago_recibo, fecha_nacimiento: data.fecha_nacimiento === "" ? null : data.fecha_nacimiento };
      const path = editingSocioId ? `/admin/users/${editingSocioId}/` : "/admin/users/";
      await request(path, { method: editingSocioId ? "PATCH" : "POST", body: JSON.stringify(payload) });
      setStatus(editingSocioId ? "Usuario actualizado correctamente." : "Socio registrado con éxito en el sistema digital.");
      cancelEditingSocio();
      await loadSocios();
    } catch (err) {
      setError(normalizeError(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteSocio(id) {
    if (!confirm("¿Seguro que quieres borrar este usuario? Esta acción no se puede deshacer.")) return;
    setSaving(true);
    setError("");
    setStatus("");
    try {
      await request(`/admin/users/${id}/`, { method: "DELETE" });
      setStatus("Usuario eliminado correctamente.");
      if (editingSocioId === id) cancelEditingSocio();
      await loadSocios();
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

        {/* Tabla socios */}
        <section className="panel">
          <h1 className="text-xl font-bold text-slate-950 mb-1">Libro Registro de Socios digital</h1>
          <p className="text-sm text-slate-600 mb-6">Listado completo de la base de datos de la asociación.</p>
          <div className="mb-6 flex flex-col sm:flex-row sm:items-end gap-6">
            <label className="field max-w-md">
              <span>Buscar usuario</span>
              <input value={socioSearch} onChange={(e) => setSocioSearch(e.target.value)} placeholder="Nombre, usuario, email, DNI, teléfono o nº de socio" />
            </label>
            <div className="flex items-center gap-2 pb-2">
              <input type="checkbox" id="filterActive" className="w-4 h-4 accent-emerald-600 cursor-pointer" checked={onlyActiveSocios} onChange={(e) => setOnlyActiveSocios(e.target.checked)} />
              <label htmlFor="filterActive" className="text-sm font-semibold text-slate-700 cursor-pointer select-none">Ver solo socios activos</label>
            </div>
          </div>
          {loadingSocios ? <p className="empty">Cargando base de datos de socios...</p> : null}
          {!loadingSocios && filteredSocios.length === 0 ? <p className="empty">No hay usuarios que coincidan con la búsqueda.</p> : null}
          {!loadingSocios && filteredSocios.length > 0 && (
            <div className="overflow-x-auto overflow-y-auto max-h-[600px] rounded-lg border border-slate-200 shadow-inner bg-slate-50/30">
              <table className="w-full border-collapse text-sm text-slate-900">
                <thead className="sticky top-0 z-10 bg-slate-100">
                  <tr className="text-left border-b border-slate-200">
                    <th className="p-3 font-semibold text-slate-700">Socio / Datos de acceso</th>
                    <th className="p-3 font-semibold text-slate-700">DNI / NIF</th>
                    <th className="p-3 font-semibold text-slate-700">Teléfono</th>
                    <th className="p-3 font-semibold text-slate-700">Estado / Nº</th>
                    <th className="p-3 font-semibold text-slate-700">Recibo</th>
                    <th className="p-3 font-semibold text-slate-700">F. Pago</th>
                    <th className="p-3 font-semibold text-slate-700 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {filteredSocios.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50/70 transition">
                      <td className="p-3">
                        <div className="font-bold text-slate-900">{s.last_name ? `${s.last_name}, ${s.first_name}` : s.username}</div>
                        <div className="text-xs text-slate-500">@{s.username} • {s.email}</div>
                      </td>
                      <td className="p-3 text-slate-700 font-mono">{s.dni_nif || "—"}</td>
                      <td className="p-3 text-slate-700">{s.telefono || "—"}</td>
                      <td className="p-3">
                        <div className="flex flex-col gap-1">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold w-fit ${
                            s.estado_socio === "ACEPTADA" ? "bg-emerald-100 text-emerald-800"
                            : s.estado_socio === "PENDIENTE" ? "bg-amber-100 text-amber-800"
                            : s.estado_socio === "BAJA_SOLICITADA" ? "bg-rose-100 text-rose-800"
                            : "bg-slate-200 text-slate-700"}`}>
                            {translateText(s.estado_socio)}
                          </span>
                          {s.es_socio && <span className="text-xs font-bold text-slate-600">Nº {s.numero_socio || "..."}</span>}
                        </div>
                      </td>
                      <td className="p-3">
                        {s.recibo_anual_pagado
                          ? <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full text-[10px] font-bold">PAGADO</span>
                          : <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full text-[10px] font-bold">PENDIENTE</span>}
                      </td>
                      <td className="p-3 text-slate-600 text-xs font-medium">{s.fecha_pago_recibo || "—"}</td>
                      <td className="p-3">
                        <div className="flex flex-col items-end gap-1">
                          {s.estado_socio === "PENDIENTE" && (
                            <button className="text-[10px] bg-emerald-600 text-white px-2 py-1 rounded hover:bg-emerald-700"
                              onClick={async () => { await request(`/admin/users/${s.id}/`, { method: "PATCH", body: JSON.stringify({ estado_socio: "ACEPTADA" }) }); await loadSocios(); }}>
                              Aprobar Socio
                            </button>
                          )}
                          {s.estado_socio === "BAJA_SOLICITADA" && (
                            <button className="text-[10px] bg-rose-600 text-white px-2 py-1 rounded hover:bg-rose-700"
                              onClick={async () => { if (confirm("¿Tramitar baja definitiva?")) { await request(`/admin/users/${s.id}/`, { method: "PATCH", body: JSON.stringify({ estado_socio: "NO_SOCIO" }) }); await loadSocios(); } }}>
                              Tramitar Baja
                            </button>
                          )}
                          <div className="flex gap-2">
                            {s.estado_socio === "ACEPTADA" && (
                              <button className="icon-action danger" type="button" disabled={saving}
                                onClick={async () => { if (confirm(`¿Dar de baja a @${s.username}?`)) { await request(`/admin/users/${s.id}/`, { method: "PATCH", body: JSON.stringify({ estado_socio: "NO_SOCIO" }) }); await loadSocios(); setStatus(`Baja tramitada para @${s.username}`); } }}>
                                Baja
                              </button>
                            )}
                            {s.id !== auth.profile?.id && (
                              <button
                                className="icon-action strong-danger"
                                type="button"
                                onClick={() => startAdminPasswordChange(s)}
                                disabled={saving}
                              >
                                Cambiar contraseña
                              </button>
                            )}
                            <button className="icon-action" type="button" onClick={() => startEditingSocio(s)} disabled={saving}>Editar</button>
                            <button className="icon-action danger" type="button" onClick={() => handleDeleteSocio(s.id)} disabled={saving}>Borrar</button>
                          </div>
                          <button className="text-[10px] text-slate-500 underline hover:text-slate-700" onClick={() => setViewingSocioDetails(s)}>Ver ficha</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Formulario alta/edición */}
        <section className="panel">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h2 className="text-xl font-bold text-slate-950">{editingSocioId ? "✏️ Editando Ficha de Usuario" : "➕ Registro Manual (Desde Papel)"}</h2>
              <p className="text-sm text-slate-600">{editingSocioId ? `Modificando datos de @${socioForm.username}` : "Vuelca aquí los datos de la hoja de inscripción física entregada por el vecino."}</p>
            </div>
            {editingSocioId && <button className="btn btn-secondary" onClick={cancelEditingSocio}>Cancelar Edición</button>}
          </div>

          <form key={editingSocioId || "new"} className="space-y-6" onSubmit={handleCreateSocioSubmit}>
            <div className="grid gap-6 lg:grid-cols-3">
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Acceso y Sistema</h3>
                <label className="field"><span>Usuario</span><input name="username" defaultValue={socioForm.username} required placeholder="ej: javier92" /></label>
                <label className="field"><span>Email Oficial</span><input name="email" type="email" defaultValue={socioForm.email} required /></label>
                <label className="field"><span>Número Socio (Opcional)</span><input name="numero_socio" defaultValue={socioForm.numero_socio} /></label>
                <label className="field"><span>Estado del Socio</span>
                  <select name="estado_socio" key={socioForm.estado_socio} defaultValue={socioForm.estado_socio} className="w-full p-2 border rounded bg-white text-sm">
                    <option value="NO_SOCIO">No Socio / Baja</option>
                    <option value="PENDIENTE">Solicitud Pendiente</option>
                    <option value="ACEPTADA">Socio Activo</option>
                    <option value="RECHAZADA">Solicitud Rechazada</option>
                    <option value="BAJA_SOLICITADA">Baja Solicitada</option>
                  </select>
                </label>
                <div className="flex items-center gap-2 pt-1 bg-rose-50 p-2 rounded border border-rose-100">
                  <input type="checkbox" id="is_staff" name="is_staff" defaultChecked={socioForm.is_staff} className="accent-rose-600" />
                  <label htmlFor="is_staff" className="text-[10px] font-bold text-rose-800 uppercase">Permisos de Administrador</label>
                </div>
              </div>

              <div className="lg:col-span-2 grid grid-cols-2 gap-3">
                <h3 className="col-span-2 text-xs font-bold text-slate-400 uppercase tracking-wider">📋 1. Datos Personales</h3>
                <label className="field"><span>Nombre</span><input name="first_name" defaultValue={socioForm.first_name} required /></label>
                <label className="field"><span>Apellidos</span><input name="last_name" defaultValue={socioForm.last_name} required /></label>
                <label className="field"><span>DNI / NIF</span><input name="dni_nif" defaultValue={socioForm.dni_nif} required /></label>
                <label className="field"><span>Fecha Nacimiento</span><input type="date" name="fecha_nacimiento" defaultValue={socioForm.fecha_nacimiento} /></label>
                <label className="field col-span-2"><span>Calle/Vía</span><input name="domicilio" defaultValue={socioForm.domicilio} /></label>
                <div className="grid grid-cols-3 gap-2 col-span-2">
                  <label className="field"><span>Nº</span><input name="numero_casa" defaultValue={socioForm.numero_casa} /></label>
                  <label className="field"><span>Piso</span><input name="piso" defaultValue={socioForm.piso} /></label>
                  <label className="field"><span>Letra</span><input name="letra" defaultValue={socioForm.letra} /></label>
                </div>
                <label className="field"><span>Teléfono Principal</span><input name="telefono" defaultValue={socioForm.telefono} required /></label>
                <label className="field"><span>Teléfono 2</span><input name="telefono_movil_2" defaultValue={socioForm.telefono_movil_2} /></label>
              </div>

              <div className="lg:col-span-3 grid lg:grid-cols-2 gap-6 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div className="space-y-3">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">💳 2. Datos Bancarios</h3>
                  <label className="field"><span>Titular Cuenta</span><input name="titular_cuenta" defaultValue={socioForm.titular_cuenta} /></label>
                  <label className="field"><span>IBAN Completo</span><input name="iban" defaultValue={socioForm.iban} placeholder="ES00 0000..." /></label>
                </div>
                <div className="space-y-3">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Desglose tradicional</h3>
                  <div className="grid grid-cols-4 gap-2">
                    <label className="field"><span>Entidad</span><input name="banco_entidad" maxLength="4" defaultValue={socioForm.banco_entidad} /></label>
                    <label className="field"><span>Sucursal</span><input name="banco_sucursal" maxLength="4" defaultValue={socioForm.banco_sucursal} /></label>
                    <label className="field"><span>DC</span><input name="banco_dc" maxLength="2" defaultValue={socioForm.banco_dc} /></label>
                    <label className="field"><span>Nº Cuenta</span><input name="banco_cuenta" maxLength="10" defaultValue={socioForm.banco_cuenta} /></label>
                  </div>
                </div>
              </div>

              <div className="lg:col-span-2 space-y-3">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">👥 3. Cuota Familiar</h3>
                <div className="overflow-x-auto border rounded-lg">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 border-b">
                      <tr className="text-left text-slate-500 uppercase text-[9px]">
                        <th className="p-2">Nombre</th><th className="p-2">Apellidos</th><th className="p-2">NIF</th><th className="p-2">Fecha Nac.</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {[1,2,3,4,5].map((idx) => {
                        const fam = socioForm.familiares?.[idx - 1] || {};
                        return (
                          <tr key={idx}>
                            <td className="p-1"><input name={`fam_nombre_${idx}`} defaultValue={fam.nombre} className="w-full p-1 border rounded" /></td>
                            <td className="p-1"><input name={`fam_apellidos_${idx}`} defaultValue={fam.apellidos} className="w-full p-1 border rounded" /></td>
                            <td className="p-1"><input name={`fam_nif_${idx}`} defaultValue={fam.nif} className="w-full p-1 border rounded" /></td>
                            <td className="p-1"><input type="date" name={`fam_fnac_${idx}`} defaultValue={fam.fnac} className="w-full p-1 border rounded" /></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">🔍 4. Otros y Firmas</h3>
                <div className="flex items-start gap-2">
                  <input type="checkbox" id="es_socio_otras_asoc" name="es_socio_otras_asoc" defaultChecked={socioForm.es_socio_otras_asoc} />
                  <label htmlFor="es_socio_otras_asoc" className="text-xs">Socio de otras asociaciones</label>
                </div>
                <label className="field"><span>¿Cuáles?</span><input name="cuales_otras_asoc" defaultValue={socioForm.cuales_otras_asoc} /></label>
                <div className="bg-emerald-50 p-3 rounded-lg border border-emerald-100 flex items-start gap-2">
                  <input type="checkbox" id="recibo_anual_pagado" name="recibo_anual_pagado" defaultChecked={socioForm.recibo_anual_pagado} />
                  <label htmlFor="recibo_anual_pagado" className="text-xs font-bold text-emerald-900">Recibo Anual Pagado</label>
                </div>
                <label className="field"><span>Fecha de pago del recibo</span><input type="date" name="fecha_pago_recibo" defaultValue={socioForm.fecha_pago_recibo} /></label>
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 flex items-start gap-2">
                  <input type="checkbox" id="autoriza_imagenes" name="autoriza_imagenes" defaultChecked={socioForm.autoriza_imagenes} />
                  <label htmlFor="autoriza_imagenes" className="text-[10px] text-emerald-800">
                    <b>Autoriza publicación de imágenes:</b> El socio permite el uso de fotos en web/RRSS.
                  </label>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t">
              <button className="btn btn-primary px-10 py-2.5" type="submit" disabled={saving}>
                {saving ? "Procesando..." : editingSocioId ? "Actualizar Ficha de Socio" : "Guardar Socio en Base de Datos"}
              </button>
            </div>
          </form>
        </section>
      </div>

      {/* Modal cambio forzado de contraseña */}
      {adminPasswordForm.userId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-rose-700">Acción administrativa</p>
                <h2 className="mt-1 text-xl font-bold text-slate-950">Cambiar contraseña</h2>
                <p className="mt-1 text-sm text-slate-600">
                  Se actualizará la contraseña de @{adminPasswordForm.username}. La contraseña anterior no se muestra ni se necesita.
                </p>
              </div>
              <button className="icon-action" type="button" onClick={cancelAdminPasswordChange} aria-label="Cerrar">
                ×
              </button>
            </div>

            <form className="mt-5 flex flex-col gap-3" onSubmit={handleAdminPasswordChange}>
              <label className="field">
                <span>Nueva contraseña</span>
                <input
                  autoComplete="new-password"
                  minLength={8}
                  pattern="(?=.*[A-Za-zÁÉÍÓÚÜÑáéíóúüñ])(?=.*\d).{8,}"
                  required
                  title={PASSWORD_RULE_TEXT}
                  type="password"
                  value={adminPasswordForm.new_password}
                  onChange={(e) => setAdminPasswordForm((current) => ({ ...current, new_password: e.target.value }))}
                />
              </label>
              <label className="field">
                <span>Repetir nueva contraseña</span>
                <input
                  autoComplete="new-password"
                  minLength={8}
                  pattern="(?=.*[A-Za-zÁÉÍÓÚÜÑáéíóúüñ])(?=.*\d).{8,}"
                  required
                  title={PASSWORD_RULE_TEXT}
                  type="password"
                  value={adminPasswordForm.new_password_two}
                  onChange={(e) => setAdminPasswordForm((current) => ({ ...current, new_password_two: e.target.value }))}
                />
              </label>
              <p className="text-xs font-semibold text-slate-500">{PASSWORD_RULE_TEXT}</p>
              <div className="mt-2 flex flex-wrap justify-end gap-2">
                <button className="btn btn-secondary" type="button" onClick={cancelAdminPasswordChange} disabled={saving}>
                  Cancelar
                </button>
                <button className="btn btn-danger" type="submit" disabled={saving}>
                  {saving ? "Guardando..." : "Cambiar contraseña"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal ficha */}
      {viewingSocioDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <header className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Revisión: @{viewingSocioDetails.username}</h2>
                <p className="text-xs text-slate-500 uppercase font-bold tracking-wider">Ficha de inscripción digitalizada</p>
              </div>
              <button onClick={() => setViewingSocioDetails(null)} className="text-slate-400 hover:text-slate-600 text-2xl px-2">×</button>
            </header>
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <section>
                <h3 className="text-sm font-bold text-emerald-700 mb-3 border-b border-emerald-100 pb-1">📋 Datos Personales</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
                  <div><p className="text-slate-500 text-[10px] uppercase font-bold">Nombre Completo</p><p className="font-medium">{viewingSocioDetails.first_name} {viewingSocioDetails.last_name}</p></div>
                  <div><p className="text-slate-500 text-[10px] uppercase font-bold">DNI/NIF</p><p className="font-mono">{viewingSocioDetails.dni_nif}</p></div>
                  <div><p className="text-slate-500 text-[10px] uppercase font-bold">Teléfono</p><p>{viewingSocioDetails.telefono}</p></div>
                  <div><p className="text-slate-500 text-[10px] uppercase font-bold">Email</p><p>{viewingSocioDetails.email}</p></div>
                  <div className="col-span-2"><p className="text-slate-500 text-[10px] uppercase font-bold">Dirección</p><p>{viewingSocioDetails.domicilio} {viewingSocioDetails.numero_casa}, {viewingSocioDetails.piso} {viewingSocioDetails.letra} — {viewingSocioDetails.codigo_postal} {viewingSocioDetails.localidad}</p></div>
                </div>
              </section>
              <section className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <h3 className="text-sm font-bold text-slate-700 mb-3 border-b border-slate-200 pb-1">💳 Datos Bancarios</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div><p className="text-slate-500 text-[10px] uppercase font-bold">Titular</p><p>{viewingSocioDetails.titular_cuenta}</p></div>
                  <div><p className="text-slate-500 text-[10px] uppercase font-bold">IBAN</p><p className="font-mono">{viewingSocioDetails.iban}</p></div>
                </div>
              </section>
              {viewingSocioDetails.familiares?.length > 0 && (
                <section>
                  <h3 className="text-sm font-bold text-slate-700 mb-3 border-b border-slate-200 pb-1">👥 Miembros Adicionales</h3>
                  <table className="w-full text-xs text-left">
                    <thead><tr className="border-b text-slate-500"><th className="py-2">Nombre</th><th className="py-2">DNI</th><th className="py-2">F. Nac.</th></tr></thead>
                    <tbody>{viewingSocioDetails.familiares.map((f, i) => <tr key={i} className="border-b last:border-0"><td className="py-2 font-medium">{f.nombre} {f.apellidos}</td><td className="py-2 font-mono">{f.nif}</td><td className="py-2">{f.fnac}</td></tr>)}</tbody>
                  </table>
                </section>
              )}
              <div className="bg-emerald-50 p-3 rounded-lg border border-emerald-100">
                <p className="text-xs text-emerald-700 italic">
                  {viewingSocioDetails.autoriza_imagenes ? "✅ AUTORIZA publicación de imágenes." : "❌ NO autoriza publicación de imágenes."}
                </p>
              </div>
            </div>
            <footer className="p-6 border-t border-slate-100 bg-slate-50 flex flex-wrap gap-3 justify-end">
              <button className="btn btn-secondary" onClick={() => setViewingSocioDetails(null)}>Cerrar</button>
              <button className="bg-rose-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-rose-700 transition"
                onClick={async () => { if (confirm(`¿Rechazar solicitud de @${viewingSocioDetails.username}?`)) { await request(`/admin/users/${viewingSocioDetails.id}/`, { method: "PATCH", body: JSON.stringify({ estado_socio: "RECHAZADA" }) }); await loadSocios(); setViewingSocioDetails(null); } }} disabled={saving}>
                Rechazar Solicitud
              </button>
              <button className="bg-emerald-600 text-white px-8 py-2 rounded-lg font-bold hover:bg-emerald-700 shadow-lg shadow-emerald-200 transition"
                onClick={async () => { await request(`/admin/users/${viewingSocioDetails.id}/`, { method: "PATCH", body: JSON.stringify({ estado_socio: "ACEPTADA" }) }); await loadSocios(); setViewingSocioDetails(null); setStatus(`Socio @${viewingSocioDetails.username} aprobado.`); }} disabled={saving}>
                Aprobar y Asignar Nº Socio
              </button>
            </footer>
          </div>
        </div>
      )}
    </main>
  );
}
