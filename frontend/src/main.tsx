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
import { I18nProvider, LanguageSwitch, useI18n } from "./i18n";
import { CONCEPT, DEVELOPER, LOGOS } from "./logos";
import Cards from "./pages/Cards";
import Checkpoints from "./pages/Checkpoints";
import Companies from "./pages/Companies";
import Daily from "./pages/Daily";
import Dashboard from "./pages/Dashboard";
import Employees from "./pages/Employees";
import Kiosk from "./pages/Kiosk";
import Login from "./pages/Login";
import Users from "./pages/Users";
import "./styles.css";

type NavKey =
  | "nav.dashboard"
  | "nav.timesheet"
  | "nav.employees"
  | "nav.kiosk"
  | "nav.cards"
  | "nav.checkpoints"
  | "nav.companies"
  | "nav.users";

interface NavItem {
  to: string;
  labelKey: NavKey;
  icon: string;
  /// Yalnizca yonetici gorsun.
  adminOnly?: boolean;
}

const NAV: {
  sectionKey: "nav.tracking" | "nav.cardKiosk" | "nav.management";
  items: NavItem[];
}[] = [
  {
    sectionKey: "nav.tracking",
    items: [
      { to: "/panel", labelKey: "nav.dashboard", icon: "◫" },
      { to: "/puantaj", labelKey: "nav.timesheet", icon: "▤" },
      { to: "/personel", labelKey: "nav.employees", icon: "☰" },
    ],
  },
  {
    sectionKey: "nav.cardKiosk",
    items: [
      { to: "/kiosk", labelKey: "nav.kiosk", icon: "◉" },
      { to: "/kart", labelKey: "nav.cards", icon: "▣" },
      { to: "/noktalar", labelKey: "nav.checkpoints", icon: "⚿", adminOnly: true },
    ],
  },
  {
    sectionKey: "nav.management",
    items: [
      { to: "/firmalar", labelKey: "nav.companies", icon: "⌂", adminOnly: true },
      { to: "/kullanicilar", labelKey: "nav.users", icon: "☺", adminOnly: true },
    ],
  },
];

/// Kiosk cihazlarinda oturum acilmaz; o sayfa giris kontrolunun disindadir.
const PUBLIC_PATHS = ["/kiosk"];

function Shell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const { t } = useI18n();
  const location = useLocation();

  const current = NAV.flatMap((g) => g.items).find(
    (i) => i.to === location.pathname,
  );
  const title = current ? t(current.labelKey) : t("app.name");

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
          <img src={LOGOS.holdingWhite} alt="ERN" />
          <div className="sidebar-brand-label">
            <strong>{t("app.name")}</strong>
            <span>{t("app.subtitle")}</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          {NAV.map((group) => {
            const items = group.items.filter(
              (i) => !i.adminOnly || user?.role === "admin",
            );
            if (items.length === 0) return null;
            return (
              <div key={group.sectionKey}>
                <div className="nav-section">{t(group.sectionKey)}</div>
                {items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) =>
                      isActive ? "sidebar-link active" : "sidebar-link"
                    }
                  >
                    <span className="icon">{item.icon}</span>
                    <span>{t(item.labelKey)}</span>
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
              {t("nav.logout")}
            </button>
          </div>
        )}
      </aside>

      <div className="main">
        <header className="topbar">
          <span className="topbar-title">{title}</span>
          <div className="topbar-right">
            <LanguageSwitch />
            <div className="company-logos">
              <img src={LOGOS.holdingColor} alt="ERN Holding" />
              <img src={LOGOS.taahhutColor} alt="ERN Taahhüt" />
            </div>
          </div>
        </header>
        <main className="page">{children}</main>
        <footer className="app-foot">
          {t("app.name")} &middot; {t("app.concept")}: {CONCEPT} &middot;{" "}
          {t("app.developedBy")}: {DEVELOPER}
        </footer>
      </div>
    </div>
  );
}

function App() {
  const { user, loading } = useAuth();
  const { t } = useI18n();
  const location = useLocation();
  const isPublic = PUBLIC_PATHS.includes(location.pathname);

  if (loading) {
    return (
      <p className="hint" style={{ padding: "2rem" }}>
        {t("app.loading")}
      </p>
    );
  }

  if (!user && !isPublic) {
    return <Login />;
  }

  // Kiosk cihazinda oturum yok: panel menusunu hic gostermeyiz, aksi halde
  // tablette calisamayacagi sayfalara baglantilar durur.
  if (!user && isPublic) {
    return (
      <main className="page">
        <div className="kiosk-topbar">
          <LanguageSwitch />
        </div>
        <Kiosk />
      </main>
    );
  }

  return (
    <Shell>
      <Routes>
        <Route path="/" element={<Navigate to="/panel" replace />} />
        <Route path="/panel" element={<Dashboard />} />
        <Route path="/puantaj" element={<Daily />} />
        <Route path="/personel" element={<Employees />} />
        <Route path="/kiosk" element={<Kiosk />} />
        <Route path="/kart" element={<Cards />} />
        <Route path="/noktalar" element={<Checkpoints />} />
        <Route path="/firmalar" element={<Companies />} />
        <Route path="/kullanicilar" element={<Users />} />
      </Routes>
    </Shell>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <I18nProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </I18nProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
