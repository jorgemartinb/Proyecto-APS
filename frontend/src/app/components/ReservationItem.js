"use client";

import { TIME_FORMAT } from "../lib/utils";

export default function ReservationItem({ currentUser, reservation, saving, onDelete, onEdit, isAdmin, onUpdateStatus }) {
  const start = new Date(reservation.start_time);
  const end = new Date(reservation.end_time);
  const isMine = currentUser && reservation.user_username === currentUser;
  const est = reservation.estado || "PENDIENTE";

  return (
    <article className={`reservation-item ${isMine ? "mine" : ""} ${
      est === "PENDIENTE" ? "reservation-item-pending"
      : est === "RECHAZADA" ? "reservation-item-rejected"
      : "reservation-item-accepted"}`}>
      <div className="reservation-time">
        <strong>{TIME_FORMAT.format(start)}</strong>
        <span>{TIME_FORMAT.format(end)}</span>
      </div>
      <div className="min-w-0 flex-1">
        <h3 className={est === "RECHAZADA" ? "line-through opacity-50" : ""}>{reservation.title}</h3>
        <p className="flex items-center gap-1.5 text-xs text-slate-600">
          <span>{reservation.user_username || "Usuario"}</span>
          {est === "PENDIENTE" && <span className="bg-amber-100 text-amber-800 text-[10px] px-1.5 rounded font-medium">Pendiente</span>}
          {est === "RECHAZADA" && <span className="bg-rose-100 text-rose-800 text-[10px] px-1.5 rounded font-medium">Rechazada</span>}
          {est === "ACEPTADA" && <span className="bg-emerald-100 text-emerald-800 text-[10px] px-1.5 rounded font-medium">Aceptada</span>}
        </p>
      </div>
      <div className="reservation-actions flex flex-col gap-1 items-end">
        {isMine && est === "PENDIENTE" ? (
          <div className="flex gap-2">
            <button className="icon-action" type="button" onClick={() => onEdit(reservation)} disabled={saving}>Editar</button>
            <button className="icon-action danger" type="button" onClick={() => onDelete(reservation.id)} disabled={saving}>Borrar</button>
          </div>
        ) : isMine ? (
          <button className="icon-action danger" type="button" onClick={() => onDelete(reservation.id)} disabled={saving}>Eliminar</button>
        ) : null}
        {isAdmin && (
          <div className="flex flex-col gap-1 mt-1 items-end">
            {est === "PENDIENTE" && (
              <div className="flex gap-1.5 mb-1">
                <button className="text-[11px] bg-emerald-600 text-white px-2 py-0.5 rounded hover:bg-emerald-700 transition"
                  onClick={() => onUpdateStatus(reservation.id, "ACEPTADA")} disabled={saving}>Aprobar</button>
                <button className="text-[11px] bg-rose-600 text-white px-2 py-0.5 rounded hover:bg-rose-700 transition"
                  onClick={() => onUpdateStatus(reservation.id, "RECHAZADA")} disabled={saving}>Rechazar</button>
              </div>
            )}
            <button className="icon-action danger" type="button"
              onClick={() => { if (confirm("¿Eliminar esta reserva del sistema?")) onDelete(reservation.id); }}
              disabled={saving}>Borrar</button>
          </div>
        )}
      </div>
    </article>
  );
}
