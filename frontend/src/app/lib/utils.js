export const DAY_FORMAT = new Intl.DateTimeFormat("es-ES", { weekday: "long", day: "numeric", month: "long" });
export const MONTH_FORMAT = new Intl.DateTimeFormat("es-ES", { month: "long", year: "numeric" });
export const TIME_FORMAT = new Intl.DateTimeFormat("es-ES", { hour: "2-digit", minute: "2-digit" });
export const CURRENCY_FORMAT = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" });
export const WEEKDAYS = ["Lun", "Mar", "Mie", "Jue", "Vie", "Sab", "Dom"];

export const FIELD_LABELS = {
  nombre: "Nombre", username: "Usuario", email: "Email", password: "Contraseña",
  password_two: "Repetir contraseña", first_name: "Nombre", last_name: "Apellidos",
  start_time: "Inicio", end_time: "Fin", title: "Título", non_field_errors: "Error",
  detail: "Error", dni_nif: "DNI/NIF", telefono: "Teléfono", numero_socio: "Número de socio",
  estado_socio: "Estado de socio", precio_aproximado: "Precio aproximado",
  descripcion: "Descripción", fecha_registro: "Fecha de Registro",
  numero_registro: "Número de Registro", respuesta_admin: "Respuesta / Comentarios",
};

export const ERROR_TRANSLATIONS = [
  ["No active account found with the given credentials", "No existe una cuenta activa con ese usuario y contraseña."],
  ["Given token not valid for any token type", "La sesión no es válida. Vuelve a iniciar sesión."],
  ["Token is invalid or expired", "La sesión ha caducado. Vuelve a iniciar sesión."],
  ["This field is required.", "Este campo es obligatorio."],
  ["This field may not be blank.", "Este campo no puede estar vacío."],
  ["Enter a valid email address.", "Introduce un email válido."],
  ["A user with that username already exists.", "Ya existe un usuario con ese nombre."],
  ["No refresh token provided.", "No se recibió el token de sesión."],
  ["Logout successful", "Sesión cerrada correctamente."],
  ["Invalid password", "Contraseña incorrecta."],
  ["Unauthorized", "No tienes autorización."],
  ["Forbidden", "No tienes permiso para hacer esta acción."],
  ["Not found.", "No se encontró el recurso."],
  ["Bad Request", "Solicitud incorrecta."],
  ["NO_SOCIO", "No Socio"], ["PENDIENTE", "Solicitud Pendiente"], ["ACEPTADA", "Socio Activo"],
  ["RECHAZADA", "Rechazada"], ["BAJA_SOLICITADA", "Baja Solicitada"], ["SOLICITADO", "Solicitado"],
  ["APROBADO", "Aprobado"], ["COMPRADO", "Comprado"], ["PRESENTADA", "Presentada por Registro"],
  ["FINALIZADA", "Finalizada"],
];

export function pad(value) { return String(value).padStart(2, "0"); }
export function dateKey(date) { return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`; }
export function monthKey(date) { return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`; }
export function toDateTimeLocal(value) {
  const d = value ? new Date(value) : new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
export function addMinutes(localValue, minutes) {
  const d = new Date(localValue);
  d.setMinutes(d.getMinutes() + minutes);
  return toDateTimeLocal(d);
}
export function createDefaultForm(selectedDate) {
  const start = new Date(selectedDate);
  start.setHours(9, 0, 0, 0);
  const end = new Date(start);
  end.setHours(10, 0, 0, 0);
  return { title: "", start_time: toDateTimeLocal(start), end_time: toDateTimeLocal(end) };
}
export function buildCalendarDays(viewDate) {
  const first = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1);
  const start = new Date(first);
  const day = (first.getDay() + 6) % 7;
  start.setDate(first.getDate() - day);
  return Array.from({ length: 42 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d; });
}
export function groupByDay(reservations) {
  return reservations.reduce((days, r) => {
    const key = dateKey(new Date(r.start_time));
    days[key] = days[key] || [];
    days[key].push(r);
    return days;
  }, {});
}
export function sortReservations(reservations) {
  return [...reservations].sort((a, b) => new Date(a.start_time) - new Date(b.start_time));
}
export function overlapsReservation(reservation, start, end, editingId) {
  if (editingId && reservation.id === editingId) return false;
  if (reservation.estado === "RECHAZADA") return false;
  const s = new Date(reservation.start_time);
  const e = new Date(reservation.end_time);
  return s < end && e > start;
}
export function translateText(value) {
  if (value === null || value === undefined) return "";
  let text = String(value);
  for (const [source, target] of ERROR_TRANSLATIONS) { text = text.replaceAll(source, target); }
  return text;
}
export function normalizeError(error) {
  if (error instanceof Error && error.message) return translateText(error.message);
  if (!error || typeof error !== "object") return "No se pudo completar la accion.";
  if (error.detail) return translateText(error.detail);
  if (error.non_field_errors) {
    const value = Array.isArray(error.non_field_errors) ? error.non_field_errors.join(" ") : error.non_field_errors;
    return translateText(value);
  }
  const entries = Object.entries(error);
  if (entries.length === 0) return "No se recibio detalle del error.";
  return entries.map(([f, v]) => `${FIELD_LABELS[f] || f}: ${translateText(Array.isArray(v) ? v.join(" ") : v)}`).join(" ");
}
export function formatDateOnly(value) {
  if (!value) return "Pendiente";
  return new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(value));
}
