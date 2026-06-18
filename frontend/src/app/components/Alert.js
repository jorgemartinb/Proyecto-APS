"use client";

export default function Alert({ status, error, onClose }) {
  if (!status && !error) return null;
  return (
    <section
      className={`app-alert ${error ? "app-alert-error" : "app-alert-ok"}`}
      role={error ? "alert" : "status"}
    >
      <div>
        <strong>{error ? "Error" : "Correcto"}</strong>
        <span>{error || status}</span>
      </div>
      <button type="button" onClick={onClose} aria-label="Cerrar alerta">
        ×
      </button>
    </section>
  );
}
