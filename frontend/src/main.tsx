import React from "react";
import ReactDOM from "react-dom/client";
import {
  BrowserRouter,
  Navigate,
  NavLink,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";

import { AuthProvider, useAuth } from "./auth";
import Cards from "./pages/Cards";
import Checkpoints from "./pages/Checkpoints";
import Daily from "./pages/Daily";
import Employees from "./pages/Employees";
import Kiosk from "./pages/Kiosk";
import Login from "./pages/Login";
import "./styles.css";

interface NavItem {
  to: string;
  label: string;
  icon: string;
  /// Yalnizca yonetici gorsun.
  adminOnly?: boolean;
}

const NAV: { section: string; items: NavItem[] }[] = [
  {
    section: "Takip",
    items: [
      { to: "/puantaj", label: "Puantaj", icon: "▤" },
      { to: "/personel", label: "Personel", icon: "☰" },
    ],
  },
  {
    section: "Kart & Kiosk",
    items: [
      { to: "/kiosk", label: "Gecis Kiosku", icon: "◉" },
      { to: "/kart", label: "Kart Uret", icon: "▣" },
      { to: "/noktalar", label: "Gecis Noktalari", icon: "⚿", adminOnly: true },
    ],
  },
];

/// Kiosk cihazlarinda oturum acilmaz; o sayfa giris kontrolunun disindadir.
const PUBLIC_PATHS = ["/kiosk"];

function Shell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const location = useLocation();

  const title =
    NAV.flatMap((g) => g.items).find((i) => i.to === location.pathname)?.label ??
    "PTS";

  const initials = (user?.full_name ?? user?.username ?? "?")
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <img src="/logo/ern-holding-beyaz.png" alt="ERN" />
          <div className="sidebar-brand-label">
            <strong>PTS</strong>
            <span>Personel Takip</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          {NAV.map((group) => {
            const items = group.items.filter(
              (i) => !i.adminOnly || user?.role === "admin",
            );
            if (items.length === 0) return null;
            return (
              <div key={group.section}>
                <div className="nav-section">{group.section}</div>
                {items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) =>
                      isActive ? "sidebar-link active" : "sidebar-link"
                    }
                  >
                    <span className="icon">{item.icon}</span>
                    <span>{item.label}</span>
                  </NavLink>
                ))}
              </div>
            );
          })}
        </nav>

        {user && (
          <div className="sidebar-foot">
            <div className="avatar">{initials}</div>
            <div className="sidebar-user">
              <strong>{user.full_name ?? user.username}</strong>
              <span>{user.role}</span>
            </div>
            <button className="logout" onClick={logout}>
              Cikis
            </button>
          </div>
        )}
      </aside>

      <div className="main">
        <header className="topbar">
          <span className="topbar-title">{title}</span>
          <div className="topbar-right">
            <div className="company-logos">
              <img src="/logo/ern-holding.png" alt="ERN Holding" />
              <img src="/logo/ern-taahhut.png" alt="ERN Taahhut" />
            </div>
          </div>
        </header>
        <main className="page">{children}</main>
      </div>
    </div>
  );
}

function App() {
  const { user, loading } = useAuth();
  const location = useLocation();
  const isPublic = PUBLIC_PATHS.includes(location.pathname);

  if (loading) {
    return <p className="hint" style={{ padding: "2rem" }}>Yukleniyor...</p>;
  }

  if (!user && !isPublic) {
    return <Login />;
  }

  return (
    <Shell>
      <Routes>
        <Route path="/" element={<Navigate to="/puantaj" replace />} />
        <Route path="/puantaj" element={<Daily />} />
        <Route path="/personel" element={<Employees />} />
        <Route path="/kiosk" element={<Kiosk />} />
        <Route path="/kart" element={<Cards />} />
        <Route path="/noktalar" element={<Checkpoints />} />
      </Routes>
    </Shell>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
