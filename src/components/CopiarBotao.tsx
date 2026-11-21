"use client";
import { useState } from "react";

// Copia um texto para a área de transferência (para colar no prontuário).
export default function CopiarBotao({
  texto,
  rotulo = "Copiar",
  className = "btn-secondary !py-1.5 text-xs",
}: {
  texto: string;
  rotulo?: string;
  className?: string;
}) {
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto);
    } catch {
      // Fallback para navegadores sem Clipboard API (ou sem HTTPS).
      const area = document.createElement("textarea");
      area.value = texto;
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      document.execCommand("copy");
      area.remove();
    }
    setCopiado(true);
    setTimeout(() => setCopiado(false), 1800);
  }

  return (
    <button type="button" onClick={copiar} className={className} disabled={!texto}>
      {copiado ? "✓ Copiado" : `📋 ${rotulo}`}
    </button>
  );
}
