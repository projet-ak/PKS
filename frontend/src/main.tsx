import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Link, Navigate, Route, Routes } from "react-router-dom";

import Kiosk from "./pages/Kiosk";
import Employees from "./pages/Employees";
import Daily from "./pages/Daily";
import Cards from "./pages/Cards";
import "./styles.css";

function App() {
  return (
    <BrowserRouter>
      <nav className="nav no-print">
        <span className="brand">PTS</span>
        <Link to="/kiosk">Kiosk</Link>
        <Link to="/personel">Personel</Link>
        <Link to="/puantaj">Puantaj</Link>
        <Link to="/kart">Kart Uret</Link>
      </nav>
      <main className="page">
        <Routes>
          <Route path="/" element={<Navigate to="/kiosk" replace />} />
          <Route path="/kiosk" element={<Kiosk />} />
          <Route path="/personel" element={<Employees />} />
          <Route path="/puantaj" element={<Daily />} />
          <Route path="/kart" element={<Cards />} />
        </Routes>
      </main>
    </BrowserRouter>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
