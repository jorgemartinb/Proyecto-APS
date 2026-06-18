"use client";

const BADGE = {
  PENDIENTE: "bg-amber-100 text-amber-800", APROBADA: "bg-blue-100 text-blue-800",
  PRESTADA: "bg-emerald-100 text-emerald-800", DEVUELTA: "bg-slate-100 text-slate-700",
  RECHAZADA: "bg-rose-100 text-rose-800", VENCIDA: "bg-red-100 text-red-800",
};

export default function BookLoanItem({ prestamo, admin, saving, onAprobar, onPrestar, onRechazar, onDevolver, onFicha }) {
  const puedeFicha = ["APROBADA", "PRESTADA", "VENCIDA", "DEVUELTA"].includes(prestamo.estado);
  const badgeClass = BADGE[prestamo.estado] || "bg-slate-100 text-slate-700";
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-3">
      <span className={`rounded px-2 py-0.5 text-xs font-bold ${badgeClass}`}>{prestamo.estado}</span>
      <h3 className="mt-2 font-bold text-slate-950">{prestamo.libro_titulo}</h3>
      <p className="text-xs text-slate-600">{admin ? `Solicitado por @${prestamo.usuario_username}` : prestamo.libro_autor}</p>
      <p className="mt-1 text-xs text-slate-500">Devolucion prevista: {prestamo.fecha_prevista_devolucion || "pendiente"}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {puedeFicha && <button className="icon-action" type="button" onClick={() => onFicha(prestamo)}>Ficha</button>}
        {admin && prestamo.estado === "PENDIENTE" && <button className="icon-action" type="button" onClick={onAprobar} disabled={saving}>Aprobar</button>}
        {admin && ["PENDIENTE", "APROBADA"].includes(prestamo.estado) && <button className="icon-action" type="button" onClick={onPrestar} disabled={saving}>Entregado</button>}
        {admin && ["PENDIENTE", "APROBADA"].includes(prestamo.estado) && <button className="icon-action danger" type="button" onClick={onRechazar} disabled={saving}>Rechazar</button>}
        {admin && ["APROBADA", "PRESTADA", "VENCIDA"].includes(prestamo.estado) && <button className="icon-action" type="button" onClick={onDevolver} disabled={saving}>Devuelto</button>}
      </div>
    </article>
  );
}
