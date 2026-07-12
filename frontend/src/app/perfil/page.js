"use client";

import { useState } from "react";
import { redirect } from "next/navigation";
import { useAuth } from "../context/AuthContext";
import Alert from "../components/Alert";
import { translateText, normalizeError, isStrongPassword, PASSWORD_RULE_TEXT } from "../lib/utils";

export default function PerfilPage() {
  const { auth, updateAuth, request, loadProfile } = useAuth();
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    old_password: "",
    new_password: "",
    new_password_two: "",
  });

  if (!auth) {
    redirect("/");
  }

  async function handleSolicitarBaja() {
    if (!window.confirm("¿Estás seguro de que quieres solicitar tu baja como socio?")) return;
    setSaving(true);
    try {
      await request("/user/request-baja/", { method: "POST" });
      setStatus("Solicitud de baja enviada. El administrador la procesará pronto.");
      const refreshed = await loadProfile(auth);
      updateAuth(refreshed);
    } catch (err) {
      setError(normalizeError(err));
    } finally {
      setSaving(false);
    }
  }

  async function handlePasswordChange(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setStatus("");
    try {
      if (!isStrongPassword(passwordForm.new_password)) {
        setError(PASSWORD_RULE_TEXT);
        return;
      }
      await request("/user/password-change/", { method: "PUT", body: JSON.stringify(passwordForm) });
      setPasswordForm({ old_password: "", new_password: "", new_password_two: "" });
      setStatus("Contraseña actualizada correctamente.");
    } catch (err) {
      setError(normalizeError(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleProfileSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const formData = new FormData(e.target);
      const data = Object.fromEntries(formData);
      const familiares = [];
      for (let i = 1; i <= 5; i++) {
        const nombre = formData.get(`fam_nombre_${i}`);
        if (nombre) {
          familiares.push({
            nombre, apellidos: formData.get(`fam_apellidos_${i}`),
            nif: formData.get(`fam_nif_${i}`), fnac: formData.get(`fam_fnac_${i}`)
          });
        }
      }
      data.familiares = familiares;
      data.autoriza_imagenes = formData.get("autoriza_imagenes") === "on";
      data.es_socio_otras_asoc = formData.get("es_socio_otras_asoc") === "on";
      const isAlreadyRegistered = auth.profile?.estado_socio !== "NO_SOCIO" && auth.profile?.estado_socio !== "RECHAZADA";
      await request("/user/profile/", { method: "PUT", body: JSON.stringify(data) });
      const session = await loadProfile(auth);
      updateAuth(session);
      setStatus(isAlreadyRegistered ? "Perfil actualizado correctamente." : "Ficha completada. Tu solicitud de alta ha sido enviada.");
    } catch (err) {
      setError(normalizeError(err));
    } finally {
      setSaving(false);
    }
  }

  const p = auth.profile || {};

  return (
    <main className="min-h-screen text-slate-950">
      <Alert status={status} error={error} onClose={() => { setError(""); setStatus(""); }} />
      <div className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
        <h1 className="text-2xl font-bold text-slate-950 mb-6">Mi Perfil</h1>
        <div className="grid gap-5 lg:grid-cols-2">
          <section className="panel">
            <h2 className="text-xl font-bold text-slate-950 mb-4">Membresía</h2>
            <div className="flex flex-col gap-4">
              <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-xs font-bold uppercase text-slate-500">Estado Actual</span>
                  <span className={`text-xs px-2 py-1 rounded font-bold ${
                    p.estado_socio === "ACEPTADA" ? "bg-emerald-100 text-emerald-800"
                    : p.estado_socio === "PENDIENTE" ? "bg-amber-100 text-amber-800"
                    : "bg-slate-200 text-slate-700"}`}>
                    {translateText(p.estado_socio)}
                  </span>
                </div>
                <p className="text-slate-900 font-medium">@{p.username}</p>
                {p.numero_socio && <p className="mt-2 text-emerald-700 font-bold">Número de Socio: {p.numero_socio}</p>}
              </div>
              {p.estado_socio === "ACEPTADA" && (
                <button className="btn btn-secondary text-rose-600 border-rose-200 hover:bg-rose-50" onClick={handleSolicitarBaja} disabled={saving}>
                  Solicitar Baja del Centro
                </button>
              )}
            </div>
          </section>

          <section className="panel">
            <h2 className="text-xl font-bold text-slate-950 mb-4">Seguridad</h2>
            <form className="flex flex-col gap-3" onSubmit={handlePasswordChange}>
              <label className="field">
                <span>Contraseña actual</span>
                <input
                  autoComplete="current-password"
                  required
                  type="password"
                  value={passwordForm.old_password}
                  onChange={(e) => setPasswordForm((current) => ({ ...current, old_password: e.target.value }))}
                />
              </label>
              <label className="field">
                <span>Nueva contraseña</span>
                <input
                  autoComplete="new-password"
                  minLength={8}
                  pattern="(?=.*[A-Za-zÁÉÍÓÚÜÑáéíóúüñ])(?=.*\d).{8,}"
                  required
                  title={PASSWORD_RULE_TEXT}
                  type="password"
                  value={passwordForm.new_password}
                  onChange={(e) => setPasswordForm((current) => ({ ...current, new_password: e.target.value }))}
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
                  value={passwordForm.new_password_two}
                  onChange={(e) => setPasswordForm((current) => ({ ...current, new_password_two: e.target.value }))}
                />
              </label>
              <p className="text-xs font-semibold text-slate-500">{PASSWORD_RULE_TEXT}</p>
              <button className="btn btn-primary" type="submit" disabled={saving}>
                {saving ? "Guardando..." : "Actualizar contraseña"}
              </button>
            </form>
          </section>
        </div>

        <form className="mt-6 space-y-6" onSubmit={handleProfileSubmit}>
          <div className="grid gap-6 lg:grid-cols-2">
            <section className="panel">
              <h3 className="font-bold text-lg mb-4">📋 1. Datos Personales</h3>
              <div className="grid grid-cols-2 gap-3">
                <label className="field"><span>Nombre</span><input name="first_name" defaultValue={p.first_name} required /></label>
                <label className="field"><span>Apellidos</span><input name="last_name" defaultValue={p.last_name} required /></label>
                <label className="field"><span>NIF (DNI/NIE)</span><input name="dni_nif" defaultValue={p.dni_nif} required /></label>
                <label className="field"><span>Fecha Nacimiento</span><input type="date" name="fecha_nacimiento" defaultValue={p.fecha_nacimiento} /></label>
              </div>
              <div className="mt-3 grid grid-cols-4 gap-3">
                <label className="field col-span-2"><span>Calle/Vía</span><input name="domicilio" defaultValue={p.domicilio} /></label>
                <label className="field"><span>Nº</span><input name="numero_casa" defaultValue={p.numero_casa} /></label>
                <label className="field"><span>Piso/Letra</span><input name="piso" placeholder="2º B" defaultValue={p.piso} /></label>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <label className="field"><span>Email Principal</span><input type="email" name="email" defaultValue={p.email} required /></label>
                <label className="field"><span>Teléfono Principal</span><input name="telefono" defaultValue={p.telefono} required /></label>
              </div>
            </section>

            <section className="panel">
              <h3 className="font-bold text-lg mb-4">💳 2. Datos Bancarios</h3>
              <div className="grid gap-3">
                <label className="field"><span>Titular Cuenta</span><input name="titular_cuenta" defaultValue={p.titular_cuenta} /></label>
                <label className="field"><span>IBAN Completo</span><input name="iban" defaultValue={p.iban} placeholder="ES00 0000..." /></label>
                <div className="grid grid-cols-4 gap-2 bg-slate-50 p-2 rounded border border-dashed border-slate-300">
                  <label className="field"><span>Entidad</span><input name="banco_entidad" maxLength="4" defaultValue={p.banco_entidad} /></label>
                  <label className="field"><span>Sucursal</span><input name="banco_sucursal" maxLength="4" defaultValue={p.banco_sucursal} /></label>
                  <label className="field"><span>DC</span><input name="banco_dc" maxLength="2" defaultValue={p.banco_dc} /></label>
                  <label className="field"><span>Nº Cuenta</span><input name="banco_cuenta" maxLength="10" defaultValue={p.banco_cuenta} /></label>
                </div>
              </div>
            </section>

            <section className="panel lg:col-span-2">
              <h3 className="font-bold text-lg mb-4">👥 3. Cuota Familiar (Hasta 5 adicionales)</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-slate-500 uppercase text-[10px] tracking-wider">
                      <th className="pb-2">Nombre</th><th className="pb-2">Apellidos</th>
                      <th className="pb-2">NIF</th><th className="pb-2">Fecha Nac.</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {[1,2,3,4,5].map((idx) => {
                      const fam = p.familiares?.[idx - 1] || {};
                      return (
                        <tr key={idx}>
                          <td className="py-1 pr-2"><input name={`fam_nombre_${idx}`} defaultValue={fam.nombre} className="w-full text-xs p-1 border rounded" /></td>
                          <td className="py-1 pr-2"><input name={`fam_apellidos_${idx}`} defaultValue={fam.apellidos} className="w-full text-xs p-1 border rounded" /></td>
                          <td className="py-1 pr-2"><input name={`fam_nif_${idx}`} defaultValue={fam.nif} className="w-full text-xs p-1 border rounded" /></td>
                          <td className="py-1"><input type="date" name={`fam_fnac_${idx}`} defaultValue={fam.fnac} className="w-full text-xs p-1 border rounded" /></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="panel lg:col-span-2">
              <h3 className="font-bold text-lg mb-4">🔍 4. Información y Autorizaciones</h3>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <input type="checkbox" id="es_socio_otras_asoc" name="es_socio_otras_asoc" defaultChecked={p.es_socio_otras_asoc} className="mt-1" />
                  <label htmlFor="es_socio_otras_asoc" className="text-sm">¿Eres socio de alguna otra asociación de Tres Cantos?</label>
                </div>
                <label className="field"><span>Indica cuáles</span><input name="cuales_otras_asoc" defaultValue={p.cuales_otras_asoc} placeholder="Ej: Cruz Roja, ARBA..." /></label>
                <hr />
                <div className="flex items-start gap-3 bg-emerald-50 p-3 rounded border border-emerald-100">
                  <input type="checkbox" id="autoriza_imagenes" name="autoriza_imagenes" defaultChecked={p.autoriza_imagenes} className="mt-1" required />
                  <label htmlFor="autoriza_imagenes" className="text-xs text-emerald-900 leading-relaxed">
                    <b>Autorización de Imágenes:</b> Doy mi consentimiento para la publicación de fotos/videos de las actividades de la asociación donde aparezca en la web y redes sociales de la entidad.
                  </label>
                </div>
              </div>
            </section>
          </div>
          <div className="flex justify-end">
            <button className="btn btn-primary px-12 py-3 text-lg" type="submit" disabled={saving}>
              {saving ? "Guardando..." : (p.estado_socio !== "NO_SOCIO" && p.estado_socio !== "RECHAZADA") ? "Guardar cambios del perfil" : "Guardar y Tramitar Alta como Socio"}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
