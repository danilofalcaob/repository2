"use client";
import { useEffect, useState } from "react";

// Alternância de tema claro/escuro persistida em localStorage.
export default function ThemeToggle() {
  const [escuro, setEscuro] = useState(false);

  useEffect(() => {
    setEscuro(document.documentElement.classList.contains("dark"));
  }, []);

  function alternar() {
    const novo = !escuro;
    setEscuro(novo);
    document.documentElement.classList.toggle("dark", novo);
    try {
      localStorage.setItem("tema", novo ? "escuro" : "claro");
    } catch {}
  }

  return (
    <button
      onClick={alternar}
      className="btn-secondary !px-3"
      aria-label={escuro ? "Ativar modo claro" : "Ativar modo escuro"}
      title={escuro ? "Modo claro" : "Modo escuro"}
    >
      {escuro ? "☀️" : "🌙"}
    </button>
  );
}
