import { translateText } from "../lib/utils";

const BADGE = {
  SOLICITADO: "bg-amber-100 text-amber-800", APROBADO: "bg-blue-100 text-blue-800",
  RECHAZADO: "bg-rose-100 text-rose-800", COMPRADO: "bg-emerald-100 text-emerald-800",
};

export default function CompraStatusBadge({ estado }) {
  const badgeClass = BADGE[estado] || "bg-slate-100 text-slate-700";
  return <span className={`rounded px-2 py-0.5 text-xs font-bold ${badgeClass}`}>{translateText(estado)}</span>;
}
