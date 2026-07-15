"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "../context/AuthContext";
import { API_BASE } from "../context/AuthContext";

export default function NavBar() {
  const { auth, updateAuth } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    try {
      if (auth?.refresh) {
        await fetch(`${API_BASE}/auth/logout/`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${auth.access}` },
          body: JSON.stringify({ refresh: auth.refresh }),
        });
      }
    } catch { /* sesión ya inválida */ }
    updateAuth(null);
    router.replace("/login");
  }

  const isAdmin = auth?.profile?.is_staff || false;

  const desktopLinks = [
    { href: "/", label: "📅 Calendario", always: true },
    { href: "/biblioteca", label: "📚 Biblioteca", auth: true },
    { href: "/perfil", label: "👤 Mi Perfil", auth: true },
    { href: "/plenos", label: "🏛️ Pleno", auth: true },
    { href: "/compras", label: "🛒 Compras", auth: true },
    { href: "/admin/solicitudes", label: "⏳ Solicitudes", admin: true },
    { href: "/admin/socios", label: "👥 Socios", admin: true },
  ];

  const mobileLinks = [
    { href: "/", icon: "📅", label: "Inicio", always: true },
    { href: "/biblioteca", icon: "📚", label: "Biblioteca", auth: true },
    { href: "/plenos", icon: "🏛️", label: "Pleno", auth: true },
    { href: "/compras", icon: "🛒", label: "Compras", auth: true, hide: isAdmin },
    { href: "/perfil", icon: "👤", label: "Perfil", auth: true, hide: isAdmin },
    { href: "/admin/solicitudes", icon: "⏳", label: "Pendientes", admin: true },
    { href: "/admin/socios", icon: "👥", label: "Socios", admin: true },
  ];

  const visibleDesktop = desktopLinks.filter(
    (l) => l.always || (l.auth && auth) || (l.admin && isAdmin)
  );
  const visibleMobile = mobileLinks.filter(
    (l) => !l.hide && (l.always || (l.noAuth && !auth) || (l.auth && auth) || (l.admin && isAdmin))
  );

  return (
    <>
      {/* ── Barra superior (escritorio) ── */}
      <header className="hidden sm:block sticky top-0 z-40 border-b border-slate-200 bg-white shadow-sm">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-0 sm:px-6 lg:px-8">
          <nav className="flex items-center gap-1 overflow-x-auto">
            {visibleDesktop.map((l) => {
              const active = l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
              return (
                <Link
                  key={l.label}
                  href={l.href}
                  className={`whitespace-nowrap py-4 px-3 text-sm font-semibold border-b-2 transition ${
                    active
                      ? "border-emerald-600 text-emerald-700"
                      : "border-transparent text-slate-500 hover:text-slate-800"
                  }`}
                >
                  {l.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex shrink-0 items-center gap-3 py-2">
            {auth ? (
              <>
                <span className="hidden lg:block text-sm text-slate-600">
                  {auth.profile?.first_name || auth.profile?.username}
                  {isAdmin && " 👑"}
                </span>
                <button
                  className="btn btn-secondary text-xs"
                  onClick={handleLogout}
                >
                  Salir
                </button>
              </>
            ) : null}
          </div>
        </div>
      </header>

      {/* ── Barra inferior (móvil) ── */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-40 flex overflow-x-auto border-t border-slate-200 bg-white scrollbar-none">
        {visibleMobile.map((l) => {
          const active = l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
          return (
            <Link
              key={l.label}
              href={l.href}
              className={`flex shrink-0 flex-col items-center justify-center gap-0.5 px-3 py-2 min-w-[64px] text-[10px] font-semibold transition ${
                active ? "text-emerald-700" : "text-slate-400"
              }`}
            >
              <span className="text-xl leading-none">{l.icon}</span>
              <span className="whitespace-nowrap">{l.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
