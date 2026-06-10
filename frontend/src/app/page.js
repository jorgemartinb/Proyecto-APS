"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "/api";
const STORAGE_KEY = "aps_reservas_auth";
const DAY_FORMAT = new Intl.DateTimeFormat("es-ES", {
  weekday: "long",
  day: "numeric",
  month: "long",
});
const MONTH_FORMAT = new Intl.DateTimeFormat("es-ES", {
  month: "long",
  year: "numeric",
});
const TIME_FORMAT = new Intl.DateTimeFormat("es-ES", {
  hour: "2-digit",
  minute: "2-digit",
});
const WEEKDAYS = ["Lun", "Mar", "Mie", "Jue", "Vie", "Sab", "Dom"];
const FIELD_LABELS = {
  username: "Usuario",
  email: "Email",
  password: "Contraseña",
  password_two: "Repetir contraseña",
  first_name: "Nombre",
  last_name: "Apellidos",
  start_time: "Inicio",
  end_time: "Fin",
  title: "Título",
  non_field_errors: "Error",
  detail: "Error",
  dni_nif: "DNI/NIF",
  telefono: "Teléfono",
  numero_socio: "Número de socio",
  estado_socio: "Estado de socio",
  descripcion: "Descripción",
  fecha_registro: "Fecha de Registro",
  numero_registro: "Número de Registro",
  respuesta_admin: "Respuesta / Comentarios",
};
const ERROR_TRANSLATIONS = [
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
  ["NO_SOCIO", "No Socio"],
  ["PENDIENTE", "Solicitud Pendiente"],
  ["ACEPTADA", "Socio Activo"],
  ["RECHAZADA", "Rechazada"],
  ["BAJA_SOLICITADA", "Baja Solicitada"],
  ["PRESENTADA", "Presentada por Registro"],
  ["FINALIZADA", "Finalizada"],
];

function pad(value) {
  return String(value).padStart(2, "0");
}

function dateKey(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function monthKey(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
}

function toDateTimeLocal(value) {
  const date = value ? new Date(value) : new Date();
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function addMinutes(localValue, minutes) {
  const date = new Date(localValue);
  date.setMinutes(date.getMinutes() + minutes);
  return toDateTimeLocal(date);
}

function createDefaultForm(selectedDate) {
  const start = new Date(selectedDate);
  start.setHours(9, 0, 0, 0);
  const end = new Date(start);
  end.setHours(10, 0, 0, 0);

  return {
    title: "",
    start_time: toDateTimeLocal(start),
    end_time: toDateTimeLocal(end),
  };
}

function getStoredAuth() {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveStoredAuth(auth) {
  if (typeof window === "undefined") return;

  if (auth) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(auth));
  } else {
    window.localStorage.removeItem(STORAGE_KEY);
  }
}

function translateText(value) {
  if (value === null || value === undefined) return "";

  let text = String(value);
  for (const [source, target] of ERROR_TRANSLATIONS) {
    text = text.replaceAll(source, target);
  }
  return text;
}

function normalizeError(error) {
  if (!error || typeof error !== "object") return "No se pudo completar la accion.";
  if (error.detail) return translateText(error.detail);
  if (error.non_field_errors) {
    const value = Array.isArray(error.non_field_errors) ? error.non_field_errors.join(" ") : error.non_field_errors;
    return translateText(value);
  }

  return Object.entries(error)
    .map(([field, value]) => `${FIELD_LABELS[field] || field}: ${translateText(Array.isArray(value) ? value.join(" ") : value)}`)
    .join(" ");
}

function buildCalendarDays(viewDate) {
  const first = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1);
  const start = new Date(first);
  const day = (first.getDay() + 6) % 7;
  start.setDate(first.getDate() - day);

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return date;
  });
}

function groupByDay(reservations) {
  return reservations.reduce((days, reservation) => {
    const key = dateKey(new Date(reservation.start_time));
    days[key] = days[key] || [];
    days[key].push(reservation);
    return days;
  }, {});
}

function sortReservations(reservations) {
  return [...reservations].sort((a, b) => new Date(a.start_time) - new Date(b.start_time));
}

function overlapsReservation(reservation, start, end, editingId) {
  if (editingId && reservation.id === editingId) return false;
  // Si la reserva ya fue rechazada por administración, no bloquea el calendario
  if (reservation.estado === "RECHAZADA") return false;

  const reservationStart = new Date(reservation.start_time);
  const reservationEnd = new Date(reservation.end_time);
  return reservationStart < end && reservationEnd > start;
}

export default function Home() {
  const today = useMemo(() => new Date(), []);
  const [auth, setAuth] = useState(null);
  const [authMode, setAuthMode] = useState("login");
  const [authForm, setAuthForm] = useState({
    username: "",
    email: "",
    password: "",
    password_two: "",
    first_name: "",
    last_name: "",
  });
  const [reservations, setReservations] = useState([]);
  const [selectedDate, setSelectedDate] = useState(today);
  const [viewDate, setViewDate] = useState(today);
  const [form, setForm] = useState(() => createDefaultForm(today));
  const [editingId, setEditingId] = useState(null);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // 🔑 NUEVOS ESTADOS PARA GESTIÓN DE ROLES Y SOCIOS (Vistas de tu compañero)
  const [activeTab, setActiveTab] = useState("calendar"); // Opciones: "calendar", "admin_reservations", "admin_socios", "profile"
  const [socios, setSocios] = useState([]);
  const [loadingSocios, setLoadingSocios] = useState(false);
  const [socioSearch, setSocioSearch] = useState("");
  const [onlyActiveSocios, setOnlyActiveSocios] = useState(false);
  const [viewingSocioDetails, setViewingSocioDetails] = useState(null);
  const [editingSocioId, setEditingSocioId] = useState(null);
  const [socioForm, setSocioForm] = useState({
    username: "",
    email: "",
    first_name: "",
    last_name: "",
    dni_nif: "",
    telefono: "",
    numero_socio: "",
    fecha_nacimiento: "",
    domicilio: "",
    numero_casa: "",
    piso: "",
    letra: "",
    localidad: "Tres Cantos",
    codigo_postal: "28760",
    email_secundario: "",
    telefono_movil_2: "",
    titular_cuenta: "",
    nif_titular: "",
    iban: "",
    entidad_bancaria: "",
    banco_entidad: "",
    banco_sucursal: "",
    banco_dc: "",
    banco_cuenta: "",
    familiares: [],
    es_socio_otras_asoc: false,
    cuales_otras_asoc: "",
    autoriza_imagenes: false,
    recibo_anual_pagado: false,
    fecha_pago_recibo: "",
    estado_socio: "NO_SOCIO",
    is_staff: false,
  });

  const [propuestas, setPropuestas] = useState([]);
  const [loadingPropuestas, setLoadingPropuestas] = useState(false);
  const [editingPropuestaId, setEditingPropuestaId] = useState(null);
  const [onlyPendingPropuestas, setOnlyPendingPropuestas] = useState(false);
  const [onlyFinalizedPropuestas, setOnlyFinalizedPropuestas] = useState(false);
  const [propuestaForm, setPropuestaForm] = useState({
    titulo: "",
    descripcion: "",
    estado: "PENDIENTE",
    fecha_registro: "",
    numero_registro: "",
    respuesta_admin: "",
  });

  // Identificador de Admin basado en el backend de Django (is_staff)
  const isAdmin = auth?.profile?.is_staff || false;
  const currentUser = auth?.profile?.username;

  const updateAuth = useCallback((nextAuth) => {
    setAuth(nextAuth);
    saveStoredAuth(nextAuth);
    // Si cerramos sesión, devolvemos al usuario al calendario normal
    if (!nextAuth) setActiveTab("calendar");
  }, []);

  const request = useCallback(
    async (path, options = {}, retry = true) => {
      const send = (accessToken) => {
        const headers = new Headers(options.headers || {});
        if (!(options.body instanceof FormData)) {
          headers.set("Content-Type", "application/json");
        }
        if (accessToken) {
          headers.set("Authorization", `Bearer ${accessToken}`);
        }

        return fetch(`${API_BASE}${path}`, {
          ...options,
          headers,
        });
      };

      let response = await send(auth?.access);

      if (response.status === 401 && retry && auth?.refresh) {
        const refreshResponse = await fetch(`${API_BASE}/auth/token/refresh/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refresh: auth.refresh }),
        });

        if (refreshResponse.ok) {
          const tokenData = await refreshResponse.json();
          const refreshedAuth = { ...auth, access: tokenData.access };
          updateAuth(refreshedAuth);
          response = await send(tokenData.access);
        } else {
          updateAuth(null);
        }
      }

      if (!response.ok) {
        let payload = null;
        try {
          payload = await response.json();
        } catch {
          payload = { detail: response.statusText };
        }
        throw payload;
      }

      if (response.status === 204 || response.status === 205) return null;
      return response.json();
    },
    [auth, updateAuth],
  );

  const loadReservations = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const data = await request("/reservations/");
      setReservations(sortReservations(data));
    } catch (err) {
      setError(`No se pudieron cargar las reservas. ${normalizeError(err)}`);
    } finally {
      setLoading(false);
    }
  }, [request]);

  // 👥 CARGAR SOCIOS DESDE EL ENDPOINT DE TU COMPAÑERO (IsAdminUser)
  const loadSocios = useCallback(async () => {
    if (!isAdmin) return;
    setLoadingSocios(true);
    try {
      const data = await request("/admin/users/");
      setSocios(data);
    } catch (err) {
      setError(`No se pudieron cargar los socios. ${normalizeError(err)}`);
    } finally {
      setLoadingSocios(false);
    }
  }, [isAdmin, request]);

  const loadPropuestas = useCallback(async () => {
    if (!auth) return;
    setLoadingPropuestas(true);
    try {
      const data = await request("/propuestas/");
      setPropuestas(data);
    } catch (err) {
      setError(`No se pudieron cargar las propuestas. ${normalizeError(err)}`);
    } finally {
      setLoadingPropuestas(false);
    }
  }, [auth, request]);

  const loadProfile = useCallback(
    async (session) => {
      const profileResponse = await fetch(`${API_BASE}/user/profile/`, {
        headers: { Authorization: `Bearer ${session.access}` },
      });

      if (!profileResponse.ok) throw new Error("No se pudo cargar el perfil");
      const profile = await profileResponse.json();
      return { ...session, profile };
    },
    [],
  );

  useEffect(() => {
    const stored = getStoredAuth();
    if (!stored?.access) return;

    loadProfile(stored)
      .then(updateAuth)
      .catch(() => updateAuth(null));
  }, [loadProfile, updateAuth]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadReservations();
  }, [loadReservations]);

  // Disparador para refrescar socios al entrar a su pestaña
  useEffect(() => {
    if (activeTab === "admin_socios" || activeTab === "admin_reservations") {
      void loadSocios();
    }
    if (activeTab === "plenos") {
      void loadPropuestas();
    }
  }, [activeTab, loadSocios, loadPropuestas]);

  const calendarDays = useMemo(() => buildCalendarDays(viewDate), [viewDate]);
  const reservationsByDay = useMemo(() => groupByDay(reservations), [reservations]);
  const selectedKey = dateKey(selectedDate);
  const todaysReservations = reservationsByDay[selectedKey] || [];
  const myReservations = useMemo(
    () => reservations.filter((reservation) => reservation.user_username === currentUser),
    [currentUser, reservations],
  );

  const filteredSocios = useMemo(() => {
    let result = socios;

    // 1. Filtrar por socios activos si el checkbox está marcado
    if (onlyActiveSocios) {
      result = result.filter((s) => s.estado_socio === "ACEPTADA");
    }

    const term = socioSearch.trim().toLowerCase();
    if (!term) return result;

    // 2. Filtrar sobre el resultado previo usando el término de búsqueda
    return result.filter((socio) => {
      const text = [
        socio.username,
        socio.email,
        socio.first_name,
        socio.last_name,
        socio.dni_nif,
        socio.telefono,
        socio.numero_socio,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return text.includes(term);
    });
  }, [socioSearch, socios, onlyActiveSocios]);

  const filteredPropuestas = useMemo(() => {
    if (!onlyPendingPropuestas && !onlyFinalizedPropuestas) return propuestas;

    return propuestas.filter((p) => {
      if (onlyPendingPropuestas && p.estado === "PENDIENTE") return true;
      if (onlyFinalizedPropuestas && p.estado === "FINALIZADA") return true;
      return false;
    });
  }, [propuestas, onlyPendingPropuestas, onlyFinalizedPropuestas]);

  const upcomingReservations = useMemo(
    () => reservations.filter((reservation) => new Date(reservation.end_time) >= new Date() && reservation.estado !== "RECHAZADA").slice(0, 6),
    [reservations],
  );
  const conflictingReservation = useMemo(() => {
    if (!form.start_time || !form.end_time) return null;

    const start = new Date(form.start_time);
    const end = new Date(form.end_time);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start >= end) return null;

    return reservations.find((reservation) => overlapsReservation(reservation, start, end, editingId)) || null;
  }, [editingId, form.end_time, form.start_time, reservations]);

  async function handleAuthSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setStatus("");

    try {
      if (authMode === "register") {
        await request(
          "/auth/register/",
          {
            method: "POST",
            body: JSON.stringify(authForm),
          },
          false,
        );
        setStatus("Cuenta creada. Ya puedes iniciar sesion.");
        setAuthMode("login");
        setAuthForm((current) => ({ ...current, password: "", password_two: "" }));
        return;
      }

      const tokens = await request(
        "/auth/login/",
        {
          method: "POST",
          body: JSON.stringify({
            username: authForm.username,
            password: authForm.password,
          }),
        },
        false,
      );
      const session = await loadProfile(tokens);
      updateAuth(session);
      setStatus("Sesion iniciada.");
      setAuthForm({
        username: "",
        email: "",
        password: "",
        password_two: "",
        first_name: "",
        last_name: "",
      });
    } catch (err) {
      setError(normalizeError(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleLogout() {
    setSaving(true);
    setError("");
    setStatus("");

    try {
      if (auth?.refresh) {
        await request("/auth/logout/", {
          method: "POST",
          body: JSON.stringify({ refresh: auth.refresh }),
        });
      }
    } catch {
      // The local session is cleared even if the token is already invalid.
    } finally {
      updateAuth(null);
      setSaving(false);
      setStatus("Sesion cerrada.");
    }
  }

  async function handleReservationSubmit(event) {
    event.preventDefault();
    if (!auth) {
      setError("Inicia sesion para crear una reserva.");
      return;
    }
    if (conflictingReservation) {
      setError("Ese tramo ya esta reservado o solicitado. Elige otra hora.");
      return;
    }

    setSaving(true);
    setError("");
    setStatus("");

    try {
      const payload = {
        title: form.title.trim(),
        start_time: new Date(form.start_time).toISOString(),
        end_time: new Date(form.end_time).toISOString(),
      };
      await request(`/reservations/${editingId ? `${editingId}/` : ""}`, {
        method: editingId ? "PUT" : "POST",
        body: JSON.stringify(payload),
      });
      await loadReservations();
      setEditingId(null);
      setForm(createDefaultForm(selectedDate));
      setStatus(editingId ? "Reserva actualizada." : "Solicitud de reserva enviada (Queda pendiente de aprobación).");
    } catch (err) {
      setError(normalizeError(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    setSaving(true);
    setError("");
    setStatus("");

    try {
      await request(`/reservations/${id}/`, { method: "DELETE" });
      await loadReservations();
      if (editingId === id) setEditingId(null);
      setStatus("Reserva eliminada.");
    } catch (err) {
      setError(normalizeError(err));
    } finally {
      setSaving(false);
    }
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

  // 👑 NUEVA ACCIÓN: CAMBIAR ESTADO DESDE EL DASHBOARD DE ADMIN (Aprobar / Rechazar)
  async function handleUpdateStatus(id, nuevoEstado) {
    setSaving(true);
    setError("");
    setStatus("");
    try {
      await request(`/reservations/${id}/`, {
        method: "PATCH",
        body: JSON.stringify({ estado: nuevoEstado }),
      });
      await loadReservations();
      setStatus(`Reserva actualizada a: ${nuevoEstado}`);
    } catch (err) {
      setError(normalizeError(err));
    } finally {
      setSaving(false);
    }
  }

  // 👥 ACCIONES DE ADMIN PARA GESTIONAR USUARIOS / SOCIOS
  function startEditingSocio(socio) {
    setEditingSocioId(socio.id);
    setSocioForm({ ...socio });
    // Hacemos scroll suave hacia el formulario
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function cancelEditingSocio() {
    setEditingSocioId(null);
    setSocioForm({
      username: "",
      email: "",
      first_name: "",
      last_name: "",
      dni_nif: "",
      telefono: "",
      numero_socio: "",
      fecha_nacimiento: "",
      domicilio: "",
      numero_casa: "",
      piso: "",
      letra: "",
      localidad: "Tres Cantos",
      codigo_postal: "28760",
      email_secundario: "",
      telefono_movil_2: "",
      titular_cuenta: "",
      nif_titular: "",
      iban: "",
      entidad_bancaria: "",
      banco_entidad: "",
      banco_sucursal: "",
      banco_dc: "",
      banco_cuenta: "",
      familiares: [],
      es_socio_otras_asoc: false,
      cuales_otras_asoc: "",
      autoriza_imagenes: false,
      recibo_anual_pagado: false,
      fecha_pago_recibo: "",
      estado_socio: "NO_SOCIO",
      is_staff: false,
    });
  }

  async function handleCreateSocioSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setStatus("");

    try {
      const formData = new FormData(event.target);
      const data = Object.fromEntries(formData);
      
      // Procesamos campos especiales (Checkboxes y JSON)
      data.es_socio = true; 
      if (!data.estado_socio) {
        data.estado_socio = editingSocioId ? socioForm.estado_socio : 'ACEPTADA';
      }
      data.autoriza_imagenes = formData.get("autoriza_imagenes") === "on";
      data.es_socio_otras_asoc = formData.get("es_socio_otras_asoc") === "on";
      data.recibo_anual_pagado = formData.get("recibo_anual_pagado") === "on";
      data.is_staff = formData.get("is_staff") === "on";

      const familiares = [];
      for (let i = 1; i <= 5; i++) {
        const nombre = formData.get(`fam_nombre_${i}`);
        if (nombre) {
          familiares.push({
            nombre,
            apellidos: formData.get(`fam_apellidos_${i}`),
            nif: formData.get(`fam_nif_${i}`),
            fnac: formData.get(`fam_fnac_${i}`)
          });
        }
      }
      data.familiares = familiares;

      // Limpiamos campos numéricos y de fecha: si vienen como "" (vacío), los mandamos como null
      // para que Django no devuelva error de validación de formato.
      const payload = {
        ...data,
        numero_socio: data.numero_socio === "" ? null : data.numero_socio,
        fecha_pago_recibo: data.fecha_pago_recibo === "" ? null : data.fecha_pago_recibo,
        fecha_nacimiento: data.fecha_nacimiento === "" ? null : data.fecha_nacimiento,
      };

      const path = editingSocioId
        ? `/admin/users/${editingSocioId}/`
        : "/admin/users/";

      await request(path, {
        method: editingSocioId ? "PATCH" : "POST",
        body: JSON.stringify(payload),
      });

      setStatus(
        editingSocioId
          ? "Usuario actualizado correctamente."
          : "Socio registrado con éxito en el sistema digital."
      );

      cancelEditingSocio();
      await loadSocios();
    } catch (err) {
      setError(normalizeError(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteSocio(id) {
    const confirmed = window.confirm(
      "¿Seguro que quieres borrar este usuario? Esta acción no se puede deshacer."
    );

    if (!confirmed) return;

    setSaving(true);
    setError("");
    setStatus("");

    try {
      await request(`/admin/users/${id}/`, {
        method: "DELETE",
      });

      setStatus("Usuario eliminado correctamente.");

      if (editingSocioId === id) {
        cancelEditingSocio();
      }

      await loadSocios();
    } catch (err) {
      setError(normalizeError(err));
    } finally {
      setSaving(false);
    }
  }

  function cancelEditingPropuesta() {
    setEditingPropuestaId(null);
    setPropuestaForm({
      titulo: "",
      descripcion: "",
      estado: "PENDIENTE",
      fecha_registro: "",
      numero_registro: "",
      respuesta_admin: "",
    });
  }

  function startEditingPropuesta(propuesta) {
    setEditingPropuestaId(propuesta.id);
    setPropuestaForm({ ...propuesta });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function handlePropuestaSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setStatus("");
    try {
      const path = editingPropuestaId ? `/propuestas/${editingPropuestaId}/` : "/propuestas/";

        // Limpiamos el payload: si fecha_registro es una cadena vacía, enviamos null
        const payload = {
          ...propuestaForm,
          fecha_registro: propuestaForm.fecha_registro === "" ? null : propuestaForm.fecha_registro,
        };

      await request(path, {
        method: editingPropuestaId ? "PUT" : "POST",
          body: JSON.stringify(payload),
      });
      setStatus(editingPropuestaId ? "Propuesta actualizada." : "Propuesta enviada correctamente.");
      cancelEditingPropuesta();
      await loadPropuestas();
    } catch (err) {
      setError(normalizeError(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleDeletePropuesta(id) {
    if (!window.confirm("¿Borrar esta propuesta?")) return;
    setSaving(true);
    try {
      await request(`/propuestas/${id}/`, { method: "DELETE" });
      setStatus("Propuesta eliminada.");
      await loadPropuestas();
      if (editingPropuestaId === id) cancelEditingPropuesta();
    } catch (err) {
      setError(normalizeError(err));
    } finally {
      setSaving(false);
    }
  }

  function startEditing(reservation) {
    setEditingId(reservation.id);
    setSelectedDate(new Date(reservation.start_time));
    setViewDate(new Date(reservation.start_time));
    setForm({
      title: reservation.title,
      start_time: toDateTimeLocal(reservation.start_time),
      end_time: toDateTimeLocal(reservation.end_time),
    });
  }

  function changeMonth(offset) {
    setViewDate((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1));
  }

  function handleSelectDate(day) {
    setSelectedDate(day);
    if (!editingId) {
      setForm(createDefaultForm(day));
    }
  }

  function selectToday() {
    const now = new Date();
    setSelectedDate(now);
    setViewDate(now);
  }

  return (
    <main className="min-h-screen bg-[#f4f7f5] text-slate-950">
      {/* HEADER PRINCIPAL */}
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-5 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-700">
                Centro de reservas {isAdmin && "• Panel de Control"}
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-normal text-slate-950 sm:text-4xl">
                Calendario de sala comunitaria
              </h1>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button className="btn btn-secondary" type="button" onClick={selectToday}>
                Hoy
              </button>
              <button className="btn btn-secondary icon-btn" type="button" onClick={() => changeMonth(-1)} aria-label="Mes anterior">
                ‹
              </button>
              <button className="btn btn-secondary icon-btn" type="button" onClick={() => changeMonth(1)} aria-label="Mes siguiente">
                ›
              </button>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Metric label="Reservas totales" value={reservations.filter(r => r.estado !== "RECHAZADA").length} />
            <Metric label="Proximas aprobadas" value={upcomingReservations.length} />
            <Metric label="Mis reservas" value={auth ? myReservations.length : "-"} />
          </div>
        </div>
      </section>

      {/* 👑 BARRA DE PESTAÑAS MÁGICA PARA ADMINISTRADORES */}
      {auth && (
        <section className="bg-white border-b border-slate-200">
          <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex gap-4">
              <button
                className={`py-3 px-1 font-semibold text-sm border-b-2 transition ${activeTab === "calendar" ? "border-emerald-600 text-emerald-700" : "border-transparent text-slate-500 hover:text-slate-800"}`}
                onClick={() => setActiveTab("calendar")}
              >
                📅 Calendario
              </button>
              <button
                className={`py-3 px-1 font-semibold text-sm border-b-2 transition ${activeTab === "profile" ? "border-emerald-600 text-emerald-700" : "border-transparent text-slate-500 hover:text-slate-800"}`}
                onClick={() => setActiveTab("profile")}
              >
                👤 Mi Perfil
              </button>
              <button
                className={`py-3 px-1 font-semibold text-sm border-b-2 transition ${activeTab === "plenos" ? "border-emerald-600 text-emerald-700" : "border-transparent text-slate-500 hover:text-slate-800"}`}
                onClick={() => setActiveTab("plenos")}
              >
                🏛️ Pleno
              </button>
              {isAdmin && (
                <>
              <button
                className={`py-3 px-1 font-semibold text-sm border-b-2 transition relative ${activeTab === "admin_reservations" ? "border-emerald-600 text-emerald-700" : "border-transparent text-slate-500 hover:text-slate-800"}`}
                onClick={() => setActiveTab("admin_reservations")}
              >
                ⏳ Solicitudes Pendientes
                {(reservations.filter((r) => r.estado === "PENDIENTE").length + socios.filter((s) => s.estado_socio === "PENDIENTE").length + propuestas.filter(p => p.estado === "PENDIENTE").length) > 0 && (
                  <span className="ml-2 bg-amber-500 text-white text-xs px-1.5 py-0.5 rounded-full font-bold">
                    {reservations.filter((r) => r.estado === "PENDIENTE").length + socios.filter((s) => s.estado_socio === "PENDIENTE").length + propuestas.filter(p => p.estado === "PENDIENTE").length}
                  </span>
                )}
              </button>
              <button
                className={`py-3 px-1 font-semibold text-sm border-b-2 transition ${activeTab === "admin_socios" ? "border-emerald-600 text-emerald-700" : "border-transparent text-slate-500 hover:text-slate-800"}`}
                onClick={() => setActiveTab("admin_socios")}
              >
                👥 Libro Registro de Socios
              </button>
                </>
              )}
            </div>
          </div>
        </section>
      )}

      {/* ALERTAS */}
      {(status || error) && (
        <section className={`app-alert ${error ? "app-alert-error" : "app-alert-ok"}`} role={error ? "alert" : "status"}>
          <div>
            <strong>{error ? "Error" : "Correcto"}</strong>
            <span>{error || status}</span>
          </div>
          <button
            type="button"
            onClick={() => {
              setError("");
              setStatus("");
            }}
            aria-label="Cerrar alerta"
          >
            ×
          </button>
        </section>
      )}

      {/* ======================================================== */}
      {/* VISTA 1: CALENDARIO TRADICIONAL (Para todos los usuarios) */}
      {/* ======================================================== */}
      {activeTab === "calendar" && (
        <div className="mx-auto grid w-full max-w-7xl gap-5 px-4 py-5 sm:px-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:px-8">
          <section className="panel">
            <div className="calendar-head">
              <div>
                <h2 className="text-xl font-semibold capitalize text-slate-950">{MONTH_FORMAT.format(viewDate)}</h2>
                <p className="mt-1 text-sm text-slate-600">Selecciona un dia para ver su agenda y crear reservas.</p>
              </div>
              <button className="btn btn-primary" type="button" onClick={() => setForm(createDefaultForm(selectedDate))} disabled={!auth}>
                + Nueva reserva
              </button>
            </div>

            <div className="calendar-grid mt-5">
              {WEEKDAYS.map((day) => (
                <div className="weekday" key={day}>
                  {day}
                </div>
              ))}
              {calendarDays.map((day) => {
                const key = dateKey(day);
                const dayReservations = reservationsByDay[key] || [];
                const isCurrentMonth = monthKey(day) === monthKey(viewDate);
                const isSelected = key === selectedKey;
                const isToday = key === dateKey(new Date());

                return (
                  <button
                    className={`calendar-day ${isCurrentMonth ? "" : "muted"} ${isSelected ? "selected" : ""}`}
                    key={key}
                    type="button"
                    onClick={() => handleSelectDate(day)}
                  >
                    <span className="day-number">
                      {day.getDate()}
                      {isToday ? <span className="today-dot" aria-label="Hoy" /> : null}
                    </span>
                    <span className="day-stack">
                      {dayReservations.slice(0, 3).map((reservation) => {
                        const est = reservation.estado || "PENDIENTE";
                        let statusIndicator = "";
                        let pillClass = "reservation-pill";

                        if (reservation.user_username === currentUser) {
                          pillClass += " reservation-pill-mine";
                        }

                        if (est === "PENDIENTE") {
                          statusIndicator = " ⏳ PENDIENTE";
                          pillClass += " reservation-pill-pending";
                        } else if (est === "RECHAZADA") {
                          statusIndicator = " ✕";
                          pillClass += " reservation-pill-rejected";
                        } else if (est === "ACEPTADA") {
                          pillClass += " reservation-pill-accepted";
                        }

                        return (
                          <span className={pillClass} key={reservation.id}>
                            {TIME_FORMAT.format(new Date(reservation.start_time))} {reservation.title}{statusIndicator}
                          </span>
                        );
                      })}
                      {dayReservations.length > 3 ? <span className="more-pill">+{dayReservations.length - 3} mas</span> : null}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <aside className="flex flex-col gap-5">
            <section className="panel">
              {auth ? (
                <div className="account">
                  <div>
                    <p className="text-sm text-slate-600">Sesion activa {isAdmin && "👑"}</p>
                    <h2 className="text-lg font-semibold text-slate-950">{auth.profile?.first_name || auth.profile?.username}</h2>
                    <p className="text-sm text-slate-500">{auth.profile?.email || "Sin email registrado"}</p>
                  </div>
                  <button className="btn btn-secondary" type="button" onClick={handleLogout} disabled={saving}>
                    Salir
                  </button>
                </div>
              ) : (
                <AuthForm
                  authForm={authForm}
                  authMode={authMode}
                  saving={saving}
                  setAuthForm={setAuthForm}
                  setAuthMode={setAuthMode}
                  onSubmit={handleAuthSubmit}
                />
              )}
            </section>

            <section className="panel">
              <div className="section-title">
                <h2 className="text-lg font-semibold text-slate-950">Agenda del dia</h2>
                <p className="text-sm capitalize text-slate-600">{DAY_FORMAT.format(selectedDate)}</p>
              </div>

              <div className="mt-4 flex flex-col gap-3">
                {loading ? <p className="empty">Cargando reservas...</p> : null}
                {!loading && todaysReservations.length === 0 ? <p className="empty">No hay reservas para este dia.</p> : null}
                {todaysReservations.map((reservation) => (
                  <ReservationItem
                    currentUser={currentUser}
                    isAdmin={isAdmin}
                    key={reservation.id}
                    reservation={reservation}
                    saving={saving}
                    onDelete={handleDelete}
                    onEdit={startEditing}
                    onUpdateStatus={handleUpdateStatus}
                  />
                ))}
              </div>
            </section>

            <section className="panel">
              <div className="section-title">
                <h2 className="text-lg font-semibold text-slate-950">{editingId ? "Editar reserva" : "Crear reserva"}</h2>
                <p className="text-sm text-slate-600">{auth ? "La solicitud se enviará a revisión." : "Inicia sesion para guardar cambios."}</p>
              </div>

              <form className="mt-4 flex flex-col gap-3" onSubmit={handleReservationSubmit}>
                <label className="field">
                  <span>Titulo</span>
                  <input
                    required
                    disabled={!auth || saving}
                    maxLength={100}
                    value={form.title}
                    onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                    placeholder="Reunion de vecinos"
                  />
                </label>
                <label className="field">
                  <span>Inicio</span>
                  <input
                    required
                    disabled={!auth || saving}
                    type="datetime-local"
                    value={form.start_time}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        start_time: event.target.value,
                        end_time: current.end_time <= event.target.value ? addMinutes(event.target.value, 60) : current.end_time,
                      }))
                    }
                  />
                </label>
                <label className="field">
                  <span>Fin</span>
                  <input
                    required
                    disabled={!auth || saving}
                    type="datetime-local"
                    value={form.end_time}
                    onChange={(event) => setForm((current) => ({ ...current, end_time: event.target.value }))}
                  />
                </label>

                {conflictingReservation ? (
                  <div className="conflict-warning" role="alert">
                    <strong>Tramo ocupado</strong>
                    <span>
                      {TIME_FORMAT.format(new Date(conflictingReservation.start_time))} - {TIME_FORMAT.format(new Date(conflictingReservation.end_time))} por{" "}
                      {conflictingReservation.user_username || "otro usuario"}.
                    </span>
                  </div>
                ) : (
                  <div className="availability-ok" role="status">
                    Tramo disponible segun las reservas cargadas.
                  </div>
                )}

                <div className="flex flex-wrap gap-2 pt-1">
                  <button className="btn btn-primary" type="submit" disabled={!auth || saving || Boolean(conflictingReservation)}>
                    {saving ? "Guardando..." : editingId ? "Actualizar" : "Enviar Solicitud"}
                  </button>
                  {editingId ? (
                    <button
                      className="btn btn-secondary"
                      type="button"
                      onClick={() => {
                        setEditingId(null);
                        setForm(createDefaultForm(selectedDate));
                      }}
                    >
                      Cancelar
                    </button>
                  ) : null}
                </div>
              </form>
            </section>
          </aside>
        </div>
      )}

      {/* ======================================================== */}
      {/* VISTA 2: BANDEJA DE VALIDACIÓN (Exclusivo Administradores)*/}
      {/* ======================================================== */}
      {activeTab === "admin_reservations" && (
        <div className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 lg:px-8 space-y-8">
          <section className="panel">
            <h2 className="text-xl font-bold text-slate-950 mb-2">Solicitudes de Reserva Pendientes</h2>
            <p className="text-sm text-slate-600 mb-6">Aquí se listan los huecos que los vecinos han pedido pero aún no están aprobados oficialmente.</p>
            
            {reservations.filter((r) => r.estado === "PENDIENTE").length === 0 ? (
              <p className="text-center py-8 text-slate-500 font-medium bg-slate-50 border border-dashed rounded-lg">
                🎉 ¡Todo al día! No quedan solicitudes pendientes de aprobación.
              </p>
            ) : (
              <div className="flex flex-col gap-4">
                {reservations.filter((r) => r.estado === "PENDIENTE").map((r) => (
                  <div key={r.id} className="bg-white border border-amber-200 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm hover:border-amber-300 transition">
                    <div>
                      <span className="bg-amber-100 text-amber-800 text-xs px-2 py-0.5 rounded font-semibold uppercase tracking-wide">Pendiente</span>
                      <h3 className="font-bold text-slate-900 text-lg mt-1">{r.title}</h3>
                      <p className="text-sm text-slate-600">Solicitado por: <span className="font-semibold text-slate-800">@{r.user_username}</span></p>
                      <p className="text-sm text-emerald-800 font-medium mt-2 flex items-center gap-1">
                        📅 {DAY_FORMAT.format(new Date(r.start_time))} | ⏰ {TIME_FORMAT.format(new Date(r.start_time))} - {TIME_FORMAT.format(new Date(r.end_time))}
                      </p>
                    </div>
                    <div className="flex sm:flex-col gap-2 shrink-0">
                      <button className="bg-emerald-600 text-white px-4 py-2 rounded-lg font-semibold text-sm hover:bg-emerald-700 shadow-sm transition" onClick={() => handleUpdateStatus(r.id, "ACEPTADA")} disabled={saving}>
                        Aceptar Reserva
                      </button>
                      <button className="bg-rose-50 text-rose-700 border border-rose-200 px-4 py-2 rounded-lg font-semibold text-sm hover:bg-rose-100 transition" onClick={() => handleUpdateStatus(r.id, "RECHAZADA")} disabled={saving}>
                        Rechazar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="panel">
            <h2 className="text-xl font-bold text-slate-950 mb-2">Solicitudes de Nuevo Socio</h2>
            <p className="text-sm text-slate-600 mb-6">Vecinos que han completado su ficha y esperan validación administrativa.</p>
            
            {socios.filter((s) => s.estado_socio === "PENDIENTE").length === 0 ? (
              <p className="text-center py-8 text-slate-500 font-medium bg-slate-50 border border-dashed rounded-lg">
                🎉 ¡Todo al día! No hay nuevas solicitudes de alta como socio.
              </p>
            ) : (
              <div className="flex flex-col gap-4">
                {socios.filter((s) => s.estado_socio === "PENDIENTE").map((s) => (
                  <div key={s.id} className="bg-white border border-emerald-200 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm hover:border-emerald-300 transition">
                    <div>
                      <span className="bg-emerald-100 text-emerald-800 text-xs px-2 py-0.5 rounded font-semibold uppercase tracking-wide">Alta Solicitada</span>
                      <h3 className="font-bold text-slate-900 text-lg mt-1">{s.last_name ? `${s.last_name}, ${s.first_name}` : s.first_name || s.username}</h3>
                      <p className="text-sm text-slate-600">Usuario: <span className="font-semibold text-slate-800">@{s.username}</span> | Email: {s.email}</p>
                      <p className="text-sm text-emerald-800 font-medium mt-2">DNI: {s.dni_nif} | Tel: {s.telefono}</p>
                    </div>
                    <div className="flex flex-wrap sm:flex-col gap-2 shrink-0">
                      <button className="bg-slate-100 text-slate-700 border border-slate-200 px-4 py-2 rounded-lg font-semibold text-sm hover:bg-slate-200 transition" onClick={() => setViewingSocioDetails(s)}>
                        Ver Ficha Completa
                      </button>
                      <button className="bg-emerald-600 text-white px-4 py-2 rounded-lg font-semibold text-sm hover:bg-emerald-700 shadow-sm transition" onClick={async () => {
                        await request(`/admin/users/${s.id}/`, { method: "PATCH", body: JSON.stringify({ estado_socio: 'ACEPTADA' }) });
                        await loadSocios();
                        setStatus(`Socio @${s.username} aprobado.`);
                      }} disabled={saving}>
                        Aprobar Socio
                      </button>
                      <button className="bg-rose-50 text-rose-700 border border-rose-200 px-4 py-2 rounded-lg font-semibold text-sm hover:bg-rose-100 transition" onClick={async () => {
                        if (confirm(`¿Rechazar solicitud de @${s.username}?`)) {
                          await request(`/admin/users/${s.id}/`, { method: "PATCH", body: JSON.stringify({ estado_socio: 'RECHAZADA' }) });
                          await loadSocios();
                        }
                      }} disabled={saving}>
                        Rechazar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="panel">
            <h2 className="text-xl font-bold text-slate-950 mb-2">Propuestas de Pleno Pendientes</h2>
            <p className="text-sm text-slate-600 mb-6">Peticiones ciudadanas que esperan ser revisadas o registradas.</p>
            
            {propuestas.filter((p) => p.estado === "PENDIENTE").length === 0 ? (
              <p className="text-center py-8 text-slate-500 font-medium bg-slate-50 border border-dashed rounded-lg">
                🎉 No hay propuestas de pleno pendientes.
              </p>
            ) : (
              <div className="flex flex-col gap-4">
                {propuestas.filter((p) => p.estado === "PENDIENTE").map((p) => (
                  <div key={p.id} className="bg-white border border-emerald-200 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm hover:border-emerald-300 transition">
                    <div>
                      <span className="bg-amber-100 text-amber-800 text-xs px-2 py-0.5 rounded font-semibold uppercase tracking-wide">Propuesta Pendiente</span>
                      <h3 className="font-bold text-slate-900 text-lg mt-1">{p.titulo}</h3>
                      <p className="text-sm text-slate-600">Enviada por: <span className="font-semibold text-slate-800">@{p.vecino_username}</span></p>
                      <p className="text-sm text-slate-500 mt-2 italic line-clamp-1">"{p.descripcion}"</p>
                    </div>
                    <div className="flex flex-wrap sm:flex-col gap-2 shrink-0">
                      <button className="bg-slate-100 text-slate-700 border border-slate-200 px-4 py-2 rounded-lg font-semibold text-sm hover:bg-slate-200 transition" 
                        onClick={() => {
                          setActiveTab("plenos");
                          startEditingPropuesta(p);
                        }}>
                        Gestionar en Plenos
                      </button>
                      <button className="bg-emerald-600 text-white px-4 py-2 rounded-lg font-semibold text-sm hover:bg-emerald-700 shadow-sm transition" onClick={async () => {
                        await request(`/propuestas/${p.id}/`, { method: "PATCH", body: JSON.stringify({ estado: 'PRESENTADA' }) });
                        await loadPropuestas();
                      }} disabled={saving}>
                        Marcar como Presentada
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {/* ======================================================== */}
      {/* VISTA: MI PERFIL / SOLICITUD DE SOCIO */}
      {/* ======================================================== */}
      {activeTab === "profile" && (
        <div className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
          <div className="grid gap-5 lg:grid-cols-2">
            <section className="panel">
              <h2 className="text-xl font-bold text-slate-950 mb-4">Membresía</h2>
              <div className="flex flex-col gap-4">
                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-xs font-bold uppercase text-slate-500">Estado Actual</span>
                    <span className={`text-xs px-2 py-1 rounded font-bold ${
                      auth.profile?.estado_socio === 'ACEPTADA' ? 'bg-emerald-100 text-emerald-800' :
                      auth.profile?.estado_socio === 'PENDIENTE' ? 'bg-amber-100 text-amber-800' :
                      'bg-slate-200 text-slate-700'
                    }`}>
                      {translateText(auth.profile?.estado_socio)}
                    </span>
                  </div>
                  <p className="text-slate-900 font-medium">@{auth.profile?.username}</p>
                  {auth.profile?.numero_socio && (
                    <p className="mt-2 text-emerald-700 font-bold">Número de Socio: {auth.profile.numero_socio}</p>
                  )}
                </div>

                {auth.profile?.estado_socio === 'ACEPTADA' && (
                  <button className="btn btn-secondary text-rose-600 border-rose-200 hover:bg-rose-50" onClick={handleSolicitarBaja} disabled={saving}>
                    Solicitar Baja del Centro
                  </button>
                )}
              </div>
            </section>

            <form className="lg:col-span-2 space-y-6" onSubmit={async (e) => {
              e.preventDefault();
              setSaving(true);
              try {
                const formData = new FormData(e.target);
                const data = Object.fromEntries(formData);
                
                // Construimos el array de familiares desde los inputs dinámicos
                const familiares = [];
                for (let i = 1; i <= 5; i++) {
                  const nombre = formData.get(`fam_nombre_${i}`);
                  if (nombre) {
                    familiares.push({
                      nombre,
                      apellidos: formData.get(`fam_apellidos_${i}`),
                      nif: formData.get(`fam_nif_${i}`),
                      fnac: formData.get(`fam_fnac_${i}`)
                    });
                  }
                }
                data.familiares = familiares;
                data.autoriza_imagenes = formData.get("autoriza_imagenes") === "on";
                data.es_socio_otras_asoc = formData.get("es_socio_otras_asoc") === "on";

                // Comprobamos si el usuario ya estaba en el sistema (socio, pendiente o baja solicitada)
                const isAlreadyRegistered = auth.profile?.estado_socio !== 'NO_SOCIO' && auth.profile?.estado_socio !== 'RECHAZADA';
                await request("/user/profile/", { method: "PUT", body: JSON.stringify(data) });
                const session = await loadProfile(auth);
                updateAuth(session);
                setStatus(isAlreadyRegistered ? "Perfil actualizado correctamente." : "Ficha de socio completada. Tu solicitud de alta ha sido enviada.");
              } catch (err) { setError(normalizeError(err)); } finally { setSaving(false); }
            }}>
              <div className="grid gap-6 lg:grid-cols-2">
                <section className="panel">
                  <h3 className="font-bold text-lg mb-4 flex items-center gap-2">📋 1. Datos Personales</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="field"><span>Nombre</span><input name="first_name" defaultValue={auth.profile?.first_name} required /></label>
                    <label className="field"><span>Apellidos</span><input name="last_name" defaultValue={auth.profile?.last_name} required /></label>
                    <label className="field"><span>NIF (DNI/NIE)</span><input name="dni_nif" defaultValue={auth.profile?.dni_nif} required /></label>
                    <label className="field"><span>Fecha Nacimiento</span><input type="date" name="fecha_nacimiento" defaultValue={auth.profile?.fecha_nacimiento} /></label>
                  </div>
                  <div className="mt-3 grid grid-cols-4 gap-3">
                    <label className="field col-span-2"><span>Calle/Vía</span><input name="domicilio" defaultValue={auth.profile?.domicilio} /></label>
                    <label className="field"><span>Nº</span><input name="numero_casa" defaultValue={auth.profile?.numero_casa} /></label>
                    <label className="field"><span>Piso/Letra</span><input name="piso" placeholder="2º B" defaultValue={auth.profile?.piso} /></label>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <label className="field"><span>Email Principal</span><input type="email" name="email" defaultValue={auth.profile?.email} required /></label>
                    <label className="field"><span>Teléfono Principal</span><input name="telefono" defaultValue={auth.profile?.telefono} required /></label>
                  </div>
                </section>

                <section className="panel">
                  <h3 className="font-bold text-lg mb-4 flex items-center gap-2">💳 2. Datos Bancarios</h3>
                  <div className="grid gap-3">
                    <label className="field"><span>Titular Cuenta</span><input name="titular_cuenta" defaultValue={auth.profile?.titular_cuenta} /></label>
                    <label className="field"><span>IBAN Completo</span><input name="iban" defaultValue={auth.profile?.iban} placeholder="ES00 0000..." /></label>
                    <div className="grid grid-cols-4 gap-2 bg-slate-50 p-2 rounded border border-dashed border-slate-300">
                      <label className="field"><span>Entidad</span><input name="banco_entidad" maxLength="4" defaultValue={auth.profile?.banco_entidad} /></label>
                      <label className="field"><span>Sucursal</span><input name="banco_sucursal" maxLength="4" defaultValue={auth.profile?.banco_sucursal} /></label>
                      <label className="field"><span>DC</span><input name="banco_dc" maxLength="2" defaultValue={auth.profile?.banco_dc} /></label>
                      <label className="field"><span>Nº Cuenta</span><input name="banco_cuenta" maxLength="10" defaultValue={auth.profile?.banco_cuenta} /></label>
                    </div>
                  </div>
                </section>

                <section className="panel lg:col-span-2">
                  <h3 className="font-bold text-lg mb-4 flex items-center gap-2">👥 3. Cuota Familiar (Hasta 5 adicionales)</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-slate-500 uppercase text-[10px] tracking-wider">
                          <th className="pb-2">Nombre</th>
                          <th className="pb-2">Apellidos</th>
                          <th className="pb-2">NIF</th>
                          <th className="pb-2">Fecha Nac.</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {[1, 2, 3, 4, 5].map((idx) => {
                          const fam = auth.profile?.familiares?.[idx - 1] || {};
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
                  <h3 className="font-bold text-lg mb-4 flex items-center gap-2">🔍 4. Información y Autorizaciones</h3>
                  <div className="space-y-4">
                    <div className="flex items-start gap-3">
                      <input type="checkbox" id="es_socio_otras_asoc" name="es_socio_otras_asoc" defaultChecked={auth.profile?.es_socio_otras_asoc} className="mt-1" />
                      <label htmlFor="es_socio_otras_asoc" className="text-sm">¿Eres socio de alguna otra asociación de Tres Cantos?</label>
                    </div>
                    <label className="field"><span>Indica cuáles</span><input name="cuales_otras_asoc" defaultValue={auth.profile?.cuales_otras_asoc} placeholder="Ej: Cruz Roja, ARBA..." /></label>
                    <hr />
                    <div className="flex items-start gap-3 bg-emerald-50 p-3 rounded border border-emerald-100">
                      <input type="checkbox" id="autoriza_imagenes" name="autoriza_imagenes" defaultChecked={auth.profile?.autoriza_imagenes} className="mt-1" required />
                      <label htmlFor="autoriza_imagenes" className="text-xs text-emerald-900 leading-relaxed">
                        <b>Autorización de Imágenes:</b> Doy mi consentimiento para la publicación de fotos/videos de las actividades de la asociación donde aparezca en la web y redes sociales de la entidad.
                      </label>
                    </div>
                  </div>
                </section>
              </div>
              <div className="flex justify-end">
                <button className="btn btn-primary px-12 py-3 text-lg" type="submit" disabled={saving}>
                  {saving 
                    ? "Guardando..." 
                    : (auth.profile?.estado_socio !== 'NO_SOCIO' && auth.profile?.estado_socio !== 'RECHAZADA')
                      ? "Guardar cambios del perfil" 
                      : "Guardar y Tramitar Alta como Socio"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* VISTA 4: PROPUESTAS PLENO */}
      {/* ======================================================== */}
      {activeTab === "plenos" && (
        <div className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 lg:px-8 space-y-8">
          <section className="panel">
            <h2 className="text-xl font-bold text-slate-950 mb-1">Propuestas para el Pleno Municipal</h2>
            <p className="text-sm text-slate-600 mb-6">
              {isAdmin 
                ? "Gestión de las peticiones ciudadanas para presentar al Ayuntamiento." 
                : "Envía tus propuestas o quejas para que la asociación las presente en el próximo pleno."}
            </p>

            <div className="mb-6 flex flex-wrap gap-6 items-center">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="filterPendingPropuestas"
                  className="w-4 h-4 accent-emerald-600 cursor-pointer"
                  checked={onlyPendingPropuestas}
                  onChange={(e) => setOnlyPendingPropuestas(e.target.checked)}
                />
                <label htmlFor="filterPendingPropuestas" className="text-sm font-semibold text-slate-700 cursor-pointer select-none">
                  Solo pendientes
                </label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="filterFinalizedPropuestas"
                  className="w-4 h-4 accent-emerald-600 cursor-pointer"
                  checked={onlyFinalizedPropuestas}
                  onChange={(e) => setOnlyFinalizedPropuestas(e.target.checked)}
                />
                <label htmlFor="filterFinalizedPropuestas" className="text-sm font-semibold text-slate-700 cursor-pointer select-none">
                  Solo finalizadas
                </label>
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
              <div className="space-y-4">
                <h3 className="font-bold text-slate-800">
                  {isAdmin ? "Todas las propuestas" : "Mis propuestas"}
                </h3>
                {loadingPropuestas ? <p className="empty">Cargando propuestas...</p> : null}
                {!loadingPropuestas && filteredPropuestas.length === 0 ? <p className="empty">No hay propuestas que coincidan con los filtros.</p> : null}
                {filteredPropuestas.map((p) => (
                  <div key={p.id} className="bg-white border rounded-xl p-4 shadow-sm hover:border-emerald-200 transition">
                    <div className="flex justify-between items-start mb-2">
                      <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${
                        p.estado === 'FINALIZADA' ? 'bg-emerald-100 text-emerald-800' :
                        p.estado === 'PRESENTADA' ? 'bg-blue-100 text-blue-800' :
                        p.estado === 'RECHAZADA' ? 'bg-rose-100 text-rose-800' :
                        p.estado === 'PENDIENTE' ? 'bg-amber-100 text-amber-800' :
                        'bg-slate-100 text-slate-700'
                      }`}>
                        {translateText(p.estado)}
                      </span>
                      <span className="text-[10px] text-slate-400 font-medium">{new Date(p.fecha_creacion).toLocaleDateString()}</span>
                    </div>
                    <h4 className="font-bold text-slate-900 mb-1">{p.titulo}</h4>
                    <p className="text-sm text-slate-600 line-clamp-2 mb-3">{p.descripcion}</p>
                    {isAdmin && <p className="text-[10px] text-slate-500 mb-3">Vecino: <span className="font-bold">@{p.vecino_username}</span></p>}
                    {(p.numero_registro || p.respuesta_admin) && (
                      <div className="bg-slate-50 p-2 rounded text-xs border border-dashed mb-3">
                        {p.numero_registro && <p><b>Registro:</b> {p.numero_registro} ({p.fecha_registro})</p>}
                        {p.respuesta_admin && <p className="mt-1"><b>Respuesta:</b> {p.respuesta_admin}</p>}
                      </div>
                    )}
                    <div className="flex gap-2">
                      <button className="icon-action" onClick={() => startEditingPropuesta(p)}>{isAdmin ? "Gestionar" : "Ver / Editar"}</button>
                      <button className="icon-action danger" onClick={() => handleDeletePropuesta(p.id)}>Borrar</button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-4">
                <div className="panel bg-emerald-50/50 border-emerald-100 sticky top-5">
                  <h3 className="font-bold text-slate-800 mb-4">{editingPropuestaId ? (isAdmin ? "Gestionar Propuesta" : "Editar Propuesta") : "Nueva Propuesta"}</h3>
                  <form className="flex flex-col gap-3" onSubmit={handlePropuestaSubmit}>
                    <label className="field"><span>Título corto</span><input required value={propuestaForm.titulo} onChange={e => setPropuestaForm({...propuestaForm, titulo: e.target.value})} placeholder="Ej: Arreglo de baches" disabled={saving} /></label>
                    <label className="field"><span>Descripción</span><textarea required rows="4" className="w-full p-2 border rounded text-sm" value={propuestaForm.descripcion} onChange={e => setPropuestaForm({...propuestaForm, descripcion: e.target.value})} placeholder="Detalla aquí tu petición..." disabled={saving} /></label>
                    {isAdmin && editingPropuestaId && (
                      <div className="mt-4 pt-4 border-t border-emerald-200 space-y-3">
                        <h4 className="text-xs font-bold text-emerald-800 uppercase">Gestión Administrativa</h4>
                        <label className="field"><span>Estado</span>
                          <select className="w-full p-2 border rounded text-sm bg-white" value={propuestaForm.estado} onChange={e => setPropuestaForm({...propuestaForm, estado: e.target.value})}>
                            <option value="PENDIENTE">Pendiente</option>
                            <option value="RECHAZADA">Rechazada</option>
                            <option value="PRESENTADA">Presentada por Registro</option>
                            <option value="FINALIZADA">Respondida / Finalizada</option>
                          </select>
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          <label className="field"><span>Nº Registro</span><input value={propuestaForm.numero_registro || ""} onChange={e => setPropuestaForm({...propuestaForm, numero_registro: e.target.value})} /></label>
                          <label className="field"><span>Fecha Registro</span><input type="date" value={propuestaForm.fecha_registro || ""} onChange={e => setPropuestaForm({...propuestaForm, fecha_registro: e.target.value})} /></label>
                        </div>
                        <label className="field"><span>Respuesta Ayuntamiento</span><textarea rows="3" className="w-full p-2 border rounded text-sm" value={propuestaForm.respuesta_admin || ""} onChange={e => setPropuestaForm({...propuestaForm, respuesta_admin: e.target.value})} placeholder="Resumen de la respuesta..." /></label>
                      </div>
                    )}
                    <div className="flex gap-2 pt-2">
                      <button className="btn btn-primary flex-1" type="submit" disabled={saving}>{saving ? "Guardando..." : "Guardar Propuesta"}</button>
                      {editingPropuestaId && <button className="btn btn-secondary" type="button" onClick={cancelEditingPropuesta}>Cancelar</button>}
                    </div>
                  </form>
                </div>
              </div>
            </div>
          </section>
        </div>
      )}

      {/* ======================================================== */}
      {/* VISTA 3: LIBRO DE SOCIOS / EXCEL (Exclusivo Administradores)*/}
      {/* ======================================================== */}
      {activeTab === "admin_socios" && (
        <div className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 space-y-8 lg:px-8">
          {/* TABLA PRINCIPAL DE SOCIOS (GET) */}
          <section className="panel">
            <h2 className="text-xl font-bold text-slate-950 mb-1">Libro Registro de Socios digital</h2>
            <p className="text-sm text-slate-600 mb-6">Listado completo de la base de datos de la asociación.</p>
            
            <div className="mb-6 flex flex-col sm:flex-row sm:items-end gap-6">
              <label className="field max-w-md">
                <span>Buscar usuario</span>
                <input
                  value={socioSearch}
                  onChange={(event) => setSocioSearch(event.target.value)}
                  placeholder="Buscar por nombre, usuario, email, DNI, teléfono o nº de socio"
                />
              </label>
              <div className="flex items-center gap-2 pb-2">
                <input
                  type="checkbox"
                  id="filterActive"
                  className="w-4 h-4 accent-emerald-600 cursor-pointer"
                  checked={onlyActiveSocios}
                  onChange={(e) => setOnlyActiveSocios(e.target.checked)}
                />
                <label htmlFor="filterActive" className="text-sm font-semibold text-slate-700 cursor-pointer select-none">
                  Ver solo socios activos
                </label>
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
                              s.estado_socio === 'ACEPTADA' ? 'bg-emerald-100 text-emerald-800' :
                              s.estado_socio === 'PENDIENTE' ? 'bg-amber-100 text-amber-800' :
                              s.estado_socio === 'BAJA_SOLICITADA' ? 'bg-rose-100 text-rose-800' :
                              'bg-slate-200 text-slate-700'
                            }`}>
                              {translateText(s.estado_socio)}
                            </span>
                            {s.es_socio && <span className="text-xs font-bold text-slate-600">Nº {s.numero_socio || "..."}</span>}
                          </div>
                        </td>
                        <td className="p-3">
                          {s.recibo_anual_pagado ? (
                            <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full text-[10px] font-bold">PAGADO</span>
                          ) : (
                            <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full text-[10px] font-bold">PENDIENTE</span>
                          )}
                        </td>
                        <td className="p-3 text-slate-600 text-xs font-medium">
                          {s.fecha_pago_recibo || "—"}
                        </td>
                        <td className="p-3">
                          <div className="flex flex-col items-end gap-1">
                            {s.estado_socio === 'PENDIENTE' && (
                              <button className="text-[10px] bg-emerald-600 text-white px-2 py-1 rounded hover:bg-emerald-700" onClick={async () => {
                                await request(`/admin/users/${s.id}/`, { method: "PATCH", body: JSON.stringify({ estado_socio: 'ACEPTADA' }) });
                                await loadSocios();
                              }}>Aprobar Socio</button>
                            )}
                            {s.estado_socio === 'BAJA_SOLICITADA' && (
                              <button className="text-[10px] bg-rose-600 text-white px-2 py-1 rounded hover:bg-rose-700" onClick={async () => {
                                if (confirm("¿Tramitar baja definitiva?")) {
                                  await request(`/admin/users/${s.id}/`, { method: "PATCH", body: JSON.stringify({ estado_socio: 'NO_SOCIO' }) });
                                  await loadSocios();
                                }
                              }}>Tramitar Baja</button>
                            )}
                            <div className="flex gap-2">
                            {s.estado_socio === 'ACEPTADA' && (
                              <button className="icon-action danger" type="button" onClick={async () => {
                                if (confirm(`¿Dar de baja manualmente al socio @${s.username}?`)) {
                                  await request(`/admin/users/${s.id}/`, { method: "PATCH", body: JSON.stringify({ estado_socio: 'NO_SOCIO' }) });
                                  await loadSocios();
                                  setStatus(`Baja tramitada para @${s.username}`);
                                }
                              }} disabled={saving}>Baja</button>
                            )}
                            <button
                              className="icon-action"
                              type="button"
                              onClick={() => startEditingSocio(s)}
                              disabled={saving}
                            >
                              Editar
                            </button>
                            <button
                              className="icon-action danger"
                              type="button"
                              onClick={() => handleDeleteSocio(s.id)}
                              disabled={saving}
                            >
                              Borrar
                            </button>
                          </div>
                        </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* FORMULARIO DE PASO DE PAPEL A WEB (POST) */}
          <section className="panel">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-xl font-bold text-slate-950">
                  {editingSocioId ? "✏️ Editando Ficha de Usuario" : "➕ Registro Manual (Desde Papel)"}
                </h2>
                <p className="text-sm text-slate-600">
                  {editingSocioId
                    ? `Modificando datos de @${socioForm.username}`
                    : "Vuelca aquí los datos de la hoja de inscripción física entregada por el vecino."}
                </p>
              </div>
              {editingSocioId && (
                <button className="btn btn-secondary" onClick={cancelEditingSocio}>Cancelar Edición</button>
              )}
            </div>
            
            <form key={editingSocioId || 'new'} className="space-y-6" onSubmit={handleCreateSocioSubmit}>
              <div className="grid gap-6 lg:grid-cols-3">
                {/* Bloque: Datos de Acceso */}
                <div className="space-y-3">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Acceso y Sistema</h3>
                  <label className="field"><span>Usuario</span><input name="username" defaultValue={socioForm.username} required placeholder="ej: javier92" /></label>
                  <label className="field"><span>Email Oficial</span><input name="email" type="email" defaultValue={socioForm.email} required placeholder="vecino@correo.com" /></label>
                  <label className="field"><span>Número Socio (Opcional)</span><input name="numero_socio" defaultValue={socioForm.numero_socio} placeholder="Automático si se deja vacío" /></label>
                  <label className="field">
                    <span>Estado del Socio</span>
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

                {/* Bloque: Personales */}
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

                {/* Bloque: Bancarios */}
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

                {/* Bloque: Familiares */}
                <div className="lg:col-span-2 space-y-3">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">👥 3. Cuota Familiar</h3>
                  <div className="overflow-x-auto border rounded-lg">
                    <table className="w-full text-xs">
                      <thead className="bg-slate-50 border-b">
                        <tr className="text-left text-slate-500 uppercase text-[9px]">
                          <th className="p-2">Nombre</th>
                          <th className="p-2">Apellidos</th>
                          <th className="p-2">NIF</th>
                          <th className="p-2">Fecha Nac.</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {[1, 2, 3, 4, 5].map((idx) => {
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

                {/* Bloque: Autorizaciones */}
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
      )}

      {/* ======================================================== */}
      {/* MODAL DE REVISIÓN DETALLADA DE SOCIO */}
      {/* ======================================================== */}
      {viewingSocioDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200">
            <header className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Revisión de Solicitud: @{viewingSocioDetails.username}</h2>
                <p className="text-xs text-slate-500 uppercase font-bold tracking-wider">Ficha de inscripción digitalizada</p>
              </div>
              <button onClick={() => setViewingSocioDetails(null)} className="text-slate-400 hover:text-slate-600 text-2xl px-2">×</button>
            </header>

            <div className="flex-1 overflow-y-auto p-6 space-y-8">
              {/* Sección 1: Personales */}
              <section>
                <h3 className="text-sm font-bold text-emerald-700 mb-3 border-b border-emerald-100 pb-1">📋 1. Datos Personales</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
                  <div><p className="text-slate-500 text-[10px] uppercase font-bold">Nombre Completo</p><p className="font-medium">{viewingSocioDetails.first_name} {viewingSocioDetails.last_name}</p></div>
                  <div><p className="text-slate-500 text-[10px] uppercase font-bold">DNI/NIF</p><p className="font-mono">{viewingSocioDetails.dni_nif}</p></div>
                  <div><p className="text-slate-500 text-[10px] uppercase font-bold">Fecha Nacimiento</p><p>{viewingSocioDetails.fecha_nacimiento || "No indicada"}</p></div>
                  <div className="col-span-2"><p className="text-slate-500 text-[10px] uppercase font-bold">Dirección</p><p>{viewingSocioDetails.domicilio} {viewingSocioDetails.numero_casa}, {viewingSocioDetails.piso} {viewingSocioDetails.letra}</p></div>
                  <div><p className="text-slate-500 text-[10px] uppercase font-bold">Localidad</p><p>{viewingSocioDetails.codigo_postal} - {viewingSocioDetails.localidad}</p></div>
                  <div><p className="text-slate-500 text-[10px] uppercase font-bold">Emails</p><p>{viewingSocioDetails.email}</p>{viewingSocioDetails.email_secundario && <p className="text-slate-400 text-xs">{viewingSocioDetails.email_secundario}</p>}</div>
                  <div><p className="text-slate-500 text-[10px] uppercase font-bold">Teléfonos</p><p>{viewingSocioDetails.telefono}</p>{viewingSocioDetails.telefono_movil_2 && <p className="text-slate-400 text-xs">{viewingSocioDetails.telefono_movil_2}</p>}</div>
                </div>
              </section>

              {/* Sección 2: Bancarios */}
              <section className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <h3 className="text-sm font-bold text-slate-700 mb-3 border-b border-slate-200 pb-1">💳 2. Datos Bancarios y Recibo Anual</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  <div><p className="text-slate-500 text-[10px] uppercase font-bold">Titular de la Cuenta</p><p className="font-medium">{viewingSocioDetails.titular_cuenta} ({viewingSocioDetails.nif_titular})</p></div>
                  <div><p className="text-slate-500 text-[10px] uppercase font-bold">Entidad Bancaria</p><p>{viewingSocioDetails.entidad_bancaria}</p></div>
                  <div className="col-span-full"><p className="text-slate-500 text-[10px] uppercase font-bold">IBAN Internacional</p><p className="font-mono text-lg text-emerald-800 tracking-wider bg-white p-2 border rounded mt-1">{viewingSocioDetails.iban}</p></div>
                  <div className="col-span-full flex gap-4 bg-white p-2 rounded border border-dashed text-center">
                    <div className="flex-1 border-r"><p className="text-[9px] text-slate-400">Entidad</p><p className="font-mono">{viewingSocioDetails.banco_entidad}</p></div>
                    <div className="flex-1 border-r"><p className="text-[9px] text-slate-400">Sucursal</p><p className="font-mono">{viewingSocioDetails.banco_sucursal}</p></div>
                    <div className="flex-1 border-r"><p className="text-[9px] text-slate-400">DC</p><p className="font-mono">{viewingSocioDetails.banco_dc}</p></div>
                    <div className="flex-2"><p className="text-[9px] text-slate-400">Nº Cuenta</p><p className="font-mono">{viewingSocioDetails.banco_cuenta}</p></div>
                  </div>
                </div>
              </section>

              {/* Sección 3: Familiares */}
              <section>
                <h3 className="text-sm font-bold text-slate-700 mb-3 border-b border-slate-200 pb-1">👥 3. Miembros Adicionales (Cuota Familiar)</h3>
                {viewingSocioDetails.familiares?.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead>
                        <tr className="border-b text-slate-500">
                          <th className="py-2">Nombre y Apellidos</th>
                          <th className="py-2">DNI/NIF</th>
                          <th className="py-2">F. Nacimiento</th>
                        </tr>
                      </thead>
                      <tbody>
                        {viewingSocioDetails.familiares.map((f, i) => (
                          <tr key={i} className="border-b last:border-0 hover:bg-slate-50">
                            <td className="py-2 font-medium">{f.nombre} {f.apellidos}</td>
                            <td className="py-2 font-mono">{f.nif}</td>
                            <td className="py-2">{f.fnac}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : <p className="text-xs text-slate-400 italic">No se han registrado familiares adicionales en esta solicitud.</p>}
              </section>

              {/* Sección 4: Otros */}
              <section className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-sm font-bold text-slate-700 mb-2 border-b border-slate-200 pb-1">🔍 Otras Asociaciones</h3>
                  <p className="text-sm">{viewingSocioDetails.es_socio_otras_asoc ? `Sí: ${viewingSocioDetails.cuales_otras_asoc}` : "No pertenece a otras asociaciones."}</p>
                </div>
                <div className="bg-emerald-50 p-3 rounded-lg border border-emerald-100">
                  <h3 className="text-sm font-bold text-emerald-800 mb-1">📸 Autorización de Imágenes</h3>
                  <p className="text-xs text-emerald-700 italic">
                    {viewingSocioDetails.autoriza_imagenes 
                      ? "✅ El usuario AUTORIZA la publicación de imágenes de las actividades." 
                      : "❌ El usuario NO AUTORIZA la publicación de imágenes."}
                  </p>
                </div>
              </section>
            </div>

            <footer className="p-6 border-t border-slate-100 bg-slate-50 flex flex-wrap gap-3 justify-end">
              <button className="btn btn-secondary" onClick={() => setViewingSocioDetails(null)}>Cerrar Revisión</button>
              <button className="bg-rose-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-rose-700 transition" onClick={async () => {
                if (confirm(`¿Rechazar solicitud de @${viewingSocioDetails.username}?`)) {
                  await request(`/admin/users/${viewingSocioDetails.id}/`, { method: "PATCH", body: JSON.stringify({ estado_socio: 'RECHAZADA' }) });
                  await loadSocios();
                  setViewingSocioDetails(null);
                }
              }} disabled={saving}>
                Rechazar Solicitud
              </button>
              <button className="bg-emerald-600 text-white px-8 py-2 rounded-lg font-bold hover:bg-emerald-700 shadow-lg shadow-emerald-200 transition" onClick={async () => {
                await request(`/admin/users/${viewingSocioDetails.id}/`, { method: "PATCH", body: JSON.stringify({ estado_socio: 'ACEPTADA' }) });
                await loadSocios();
                setViewingSocioDetails(null);
                setStatus(`Socio @${viewingSocioDetails.username} aprobado correctamente.`);
              }} disabled={saving}>
                Aprobar y Asignar Nº Socio
              </button>
            </footer>
          </div>
        </div>
      )}
    </main>
  );
}

function Metric({ label, value }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function AuthForm({ authForm, authMode, saving, setAuthForm, setAuthMode, onSubmit }) {
  const isRegister = authMode === "register";

  return (
    <div>
      <div className="segmented" role="tablist" aria-label="Autenticacion">
        <button className={authMode === "login" ? "active" : ""} type="button" onClick={() => setAuthMode("login")}>
          Acceder
        </button>
        <button className={isRegister ? "active" : ""} type="button" onClick={() => setAuthMode("register")}>
          Registro
        </button>
      </div>

      <form className="mt-4 flex flex-col gap-3" onSubmit={onSubmit}>
        <label className="field">
          <span>Usuario</span>
          <input
            autoComplete="username"
            required
            value={authForm.username}
            onChange={(event) => setAuthForm((current) => ({ ...current, username: event.target.value }))}
          />
        </label>
        {isRegister ? (
          <>
            <label className="field">
              <span>Email</span>
              <input
                autoComplete="email"
                type="email"
                required
                value={authForm.email}
                onChange={(event) => setAuthForm((current) => ({ ...current, email: event.target.value }))}
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              <label className="field">
                <span>Nombre</span>
                <input value={authForm.first_name} onChange={(event) => setAuthForm((current) => ({ ...current, first_name: event.target.value }))} />
              </label>
              <label className="field">
                <span>Apellidos</span>
                <input value={authForm.last_name} onChange={(event) => setAuthForm((current) => ({ ...current, last_name: event.target.value }))} />
              </label>
            </div>
          </>
        ) : null}
        <label className="field">
          <span>Contrasena</span>
          <input
            autoComplete={isRegister ? "new-password" : "current-password"}
            required
            type="password"
            value={authForm.password}
            onChange={(event) => setAuthForm((current) => ({ ...current, password: event.target.value }))}
          />
        </label>
        {isRegister ? (
          <label className="field">
            <span>Repetir contrasena</span>
            <input
              autoComplete="new-password"
              required
              type="password"
              value={authForm.password_two}
              onChange={(event) => setAuthForm((current) => ({ ...current, password_two: event.target.value }))}
            />
          </label>
        ) : null}
        <button className="btn btn-primary" type="submit" disabled={saving}>
          {saving ? "Procesando..." : isRegister ? "Crear cuenta" : "Entrar"}
        </button>
      </form>
    </div>
  );
}

function ReservationItem({ currentUser, reservation, saving, onDelete, onEdit, isAdmin, onUpdateStatus }) {
  const start = new Date(reservation.start_time);
  const end = new Date(reservation.end_time);
  const isMine = currentUser && reservation.user_username === currentUser;
  const est = reservation.estado || "PENDIENTE";

  return (
    <article
      className={`reservation-item ${isMine ? "mine" : ""} ${
        est === "PENDIENTE"
          ? "reservation-item-pending"
          : est === "RECHAZADA"
            ? "reservation-item-rejected"
            : "reservation-item-accepted"
      }`}
    >
      <div className="reservation-time">
        <strong>{TIME_FORMAT.format(start)}</strong>
        <span>{TIME_FORMAT.format(end)}</span>
      </div>
      <div className="min-w-0 flex-1">
        <h3 className={est === "RECHAZADA" ? "line-through opacity-50" : ""}>{reservation.title}</h3>
        <p className="flex items-center gap-1.5 text-xs text-slate-600">
          <span>{reservation.user_username || "Usuario"}</span>
          {est === "PENDIENTE" && <span className="bg-amber-100 text-amber-800 text-[10px] px-1.5 py-0.2 rounded font-medium">Pendiente</span>}
          {est === "RECHAZADA" && <span className="bg-rose-100 text-rose-800 text-[10px] px-1.5 py-0.2 rounded font-medium">Rechazada</span>}
          {est === "ACEPTADA" && <span className="bg-emerald-100 text-emerald-800 text-[10px] px-1.5 py-0.2 rounded font-medium">Aceptada</span>}
        </p>
      </div>
      <div className="reservation-actions flex flex-col gap-1 items-end">
        {/* Los usuarios pueden editar/borrar solo si están en estado PENDIENTE */}
        {isMine && est === "PENDIENTE" ? (
          <div className="flex gap-2">
            <button className="icon-action" type="button" onClick={() => onEdit(reservation)} disabled={saving} aria-label="Editar reserva">
              Editar
            </button>
            <button className="icon-action danger" type="button" onClick={() => onDelete(reservation.id)} disabled={saving} aria-label="Eliminar reserva">
              Borrar
            </button>
          </div>
        ) : isMine ? (
          <button className="icon-action danger" type="button" onClick={() => onDelete(reservation.id)} disabled={saving} aria-label="Eliminar reserva">
            Eliminar
          </button>
        ) : null}

        {/* 👑 Acciones directas si el que mira la agenda es Admin */}
        {isAdmin && (
          <div className="flex flex-col gap-1 mt-1 items-end">
            {/* Si está pendiente, muestra botones de Aprobar/Rechazar */}
            {est === "PENDIENTE" && (
              <div className="flex gap-1.5 mb-1">
                <button className="text-[11px] bg-emerald-600 text-white px-2 py-0.5 rounded hover:bg-emerald-700 transition" onClick={() => onUpdateStatus(reservation.id, "ACEPTADA")} disabled={saving} title="Aprobar de inmediato">
                  Aprobar
                </button>
                <button className="text-[11px] bg-rose-600 text-white px-2 py-0.5 rounded hover:bg-rose-700 transition" onClick={() => onUpdateStatus(reservation.id, "RECHAZADA")} disabled={saving} title="Rechazar solicitud">
                  Rechazar
                </button>
              </div>
            )}
            
            {/* 🔥 BOTÓN ROJO DE ADMIN: Usa la clase "icon-action danger" para ser idéntico al de arriba */}
            <button 
              className="icon-action danger" 
              type="button"
              onClick={() => {
                if (confirm("¿Estás seguro de que deseas eliminar esta reserva definitivamente del sistema?")) {
                  onDelete(reservation.id);
                }
              }} 
              disabled={saving}
              title="Borrar reserva como Administrador"
            >
              Borrar
            </button>
          </div>
        )}
      </div>
    </article>
  );
}