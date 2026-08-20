import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Link, Navigate, Route, Routes } from "react-router-dom";

import Kiosk from "./pages/Kiosk";
import Employees from "./pages/Employees";
import Daily from "./pages/Daily";
import "./styles.css";

function App() {
  return (
    <BrowserRouter>
      <nav className="nav">
        <span className="brand">PKS</span>
        <Link to="/kiosk">Kiosk</Link>
        <Link to="/personel">Personel</Link>
        <Link to="/puantaj">Puantaj</Link>
      </nav>
      <main className="page">
        <Routes>
          <Route path="/" element={<Navigate to="/kiosk" replace />} />
          <Route path="/kiosk" element={<Kiosk />} />
          <Route path="/personel" element={<Employees />} />
          <Route path="/puantaj" element={<Daily />} />
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
