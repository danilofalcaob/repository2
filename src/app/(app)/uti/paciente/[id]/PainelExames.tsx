"use client";
import { useEffect, useMemo, useState } from "react";
import type { Resultado } from "@/lib/exames/valores";
import { pontosDeAtencao } from "@/lib/exames/atencao";
import Importador, { type Pendente } from "./Importador";
import PontosAtencao from "./PontosAtencao";
import GraficosTendencia from "./GraficosTendencia";
import LinhasExames from "./LinhasExames";
import ResumoEvolutivo from "./ResumoEvolutivo";
import Laudos, { type DocumentoResumo } from "./Laudos";

type Aba = "atencao" | "graficos" | "linhas" | "evolucao" | "laudos";

export default function PainelExames({
  pacienteId,
  sexo,
  iaDisponivel,
  resultados,
  documentos,
  pendentes,
}: {
  pacienteId: string;
  sexo: string | null;
  iaDisponivel: boolean;
  resultados: Resultado[];
  documentos: DocumentoResumo[];
  pendentes: Pendente[];
}) {
  const [aba, setAba] = useState<Aba>("atencao");

  // Lembra a aba escolhida (conveniência local; funciona sem armazenamento).
  useEffect(() => {
    try {
      const salva = localStorage.getItem("uti-aba") as Aba | null;
      if (salva) setAba(salva);
    } catch {}
  }, []);
  function escolher(a: Aba) {
    setAba(a);
    try {
      localStorage.setItem("uti-aba", a);
    } catch {}
  }

  const existentes = useMemo(
    () => new Map(resultados.map((r) => [`${r.analito}|${new Date(r.coletadoEm).toISOString()}`, r.valorTexto])),
    [resultados],
  );
  const painel = useMemo(() => pontosDeAtencao(resultados), [resultados]);

  const abas: { id: Aba; rotulo: string; contador?: number; alerta?: boolean }[] = [
    { id: "atencao", rotulo: "⚠️ Pontos de atenção", contador: painel.alterados.length, alerta: painel.criticos > 0 },
    { id: "graficos", rotulo: "📈 Tendências" },
    { id: "linhas", rotulo: "🧾 Exames em linha" },
    { id: "evolucao", rotulo: "📝 Resumo evolutivo" },
    { id: "laudos", rotulo: "📎 Laudos", contador: documentos.length },
  ];

  return (
    <div className="space-y-4">
      <Importador
        pacienteId={pacienteId}
        sexo={sexo}
        iaDisponivel={iaDisponivel}
        existentes={existentes}
        pendentesIniciais={pendentes}
      />

      <div className="-mx-4 overflow-x-auto px-4">
        <div role="tablist" className="flex min-w-max gap-1 border-b border-clinic-border">
          {abas.map((a) => (
            <button
              key={a.id}
              role="tab"
              aria-selected={aba === a.id}
              type="button"
              onClick={() => escolher(a.id)}
              className={`-mb-px border-b-2 px-3 py-2.5 text-sm font-medium transition ${
                aba === a.id
                  ? "border-clinic-primary text-clinic-primary"
                  : "border-transparent text-clinic-muted hover:text-clinic-text"
              }`}
            >
              {a.rotulo}
              {a.contador != null && a.contador > 0 && (
                <span
                  className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[11px] ${
                    a.alerta ? "bg-instavel text-white" : "bg-clinic-bg text-clinic-muted"
                  }`}
                >
                  {a.contador}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div role="tabpanel">
        {aba === "atencao" && <PontosAtencao resultados={resultados} />}
        {aba === "graficos" && <GraficosTendencia resultados={resultados} />}
        {aba === "linhas" && <LinhasExames resultados={resultados} />}
        {aba === "evolucao" && <ResumoEvolutivo resultados={resultados} />}
        {aba === "laudos" && <Laudos documentos={documentos} resultados={resultados} />}
      </div>
    </div>
  );
}
