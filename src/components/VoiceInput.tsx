"use client";
import { useEffect, useRef, useState } from "react";

// Botão de ditado por voz usando a Web Speech API (pt-BR).
// Suportado em Chrome/Edge. Em navegadores sem suporte, fica oculto e a
// digitação manual permanece disponível.
export default function VoiceInput({
  onTexto,
  titulo = "Ditar",
}: {
  onTexto: (texto: string) => void;
  titulo?: string;
}) {
  const [suportado, setSuportado] = useState(false);
  const [ouvindo, setOuvindo] = useState(false);
  const recRef = useRef<any>(null);

  useEffect(() => {
    const SR =
      (typeof window !== "undefined" &&
        ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)) ||
      null;
    if (!SR) return;
    setSuportado(true);
    const rec = new SR();
    rec.lang = "pt-BR";
    rec.continuous = false;
    rec.interimResults = false;
    rec.onresult = (e: any) => {
      const texto = Array.from(e.results)
        .map((r: any) => r[0].transcript)
        .join(" ")
        .trim();
      if (texto) onTexto(texto);
    };
    rec.onend = () => setOuvindo(false);
    rec.onerror = () => setOuvindo(false);
    recRef.current = rec;
    return () => {
      try {
        rec.abort();
      } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!suportado) return null;

  function alternar() {
    const rec = recRef.current;
    if (!rec) return;
    if (ouvindo) {
      rec.stop();
      setOuvindo(false);
    } else {
      try {
        rec.start();
        setOuvindo(true);
      } catch {}
    }
  }

  return (
    <button
      type="button"
      onClick={alternar}
      className={`btn !px-2.5 !py-1.5 text-xs ${
        ouvindo ? "bg-instavel text-white" : "border border-clinic-border bg-clinic-surface"
      }`}
      title={titulo}
      aria-pressed={ouvindo}
    >
      {ouvindo ? "● Ouvindo… (parar)" : "🎤 " + titulo}
    </button>
  );
}
