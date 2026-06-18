export default function FichaField({ label, value, wide }) {
  return (
    <div className={`rounded border border-slate-200 p-3 ${wide ? "sm:col-span-2" : ""}`}>
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-1 font-semibold text-slate-900">{value || "No disponible"}</p>
    </div>
  );
}
