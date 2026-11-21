"use client";
import { useMemo, useState } from "react";
import CopiarBotao from "@/components/CopiarBotao";
import { linhasDeExames, type Marcacao } from "@/lib/exames/linha";
import type { Resultado } from "@/lib/exames/valores";

// Renderiza "**trecho**" em negrito na pré-visualização (o texto copiado mantém os asteriscos).
function comNegrito(texto: string) {
  return texto.split(/(\*\*[^*]+\*\*)/g).map((parte, i) =>
    parte.startsWith("**") && parte.endsWith("**") ? (
      <strong key={i} className="text-instavel">
        {parte.slice(2, -2)}
      </strong>
    ) : (
      <span key={i}>{parte}</span>
    ),
  );
}

export default function LinhasExames({ resultados }: { resultados: Resultado[] }) {
  const [marcacao, setMarcacao] = useState<Marcacao>("asteriscos");
  const [ordem, setOrdem] = useState<"recente" | "cronologica">("recente");
  const [dias, setDias] = useState(0);

  const linhas = useMemo(() => {
    const inicio = dias ? Date.now() - dias * 86_400_000 : null;
    const filtrados = inicio ? resultados.filter((r) => new Date(r.coletadoEm).getTime() >= inicio) : resultados;
    return linhasDeExames(filtrados, { marcacao, ordem });
  }, [resultados, marcacao, ordem, dias]);

  if (!resultados.length) {
    return <p className="card p-6 text-center text-sm text-clinic-muted">Nenhum exame registrado ainda.</p>;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <select className="input !w-auto !py-1.5 text-xs" value={dias} onChange={(e) => setDias(Number(e.target.value))} aria-label="Período">
          <option value={0}>Todas as coletas</option>
          <option value={1}>Últimas 24h</option>
          <option value={3}>Últimas 72h</option>
          <option value={7}>Últimos 7 dias</option>
        </select>
        <select
          className="input !w-auto !py-1.5 text-xs"
          value={marcacao}
          onChange={(e) => setMarcacao(e.target.value as Marcacao)}
          aria-label="Destaque dos alterados"
        >
          <option value="asteriscos">Alterados em **negrito**</option>
          <option value="maiusculas">Alterados com (AUMENTADO)</option>
          <option value="nenhuma">Sem destaque</option>
        </select>
        <select
          className="input !w-auto !py-1.5 text-xs"
          value={ordem}
          onChange={(e) => setOrdem(e.target.value as "recente" | "cronologica")}
          aria-label="Ordem"
        >
          <option value="recente">Mais recente primeiro</option>
          <option value="cronologica">Ordem cronológica</option>
        </select>
        <div className="ml-auto">
          <CopiarBotao texto={linhas.map((l) => l.texto).join("\n")} rotulo="Copiar todas" className="btn-primary !py-1.5 text-xs" />
        </div>
      </div>

      {linhas.length === 0 && <p className="card p-6 text-center text-sm text-clinic-muted">Nenhuma coleta no período.</p>}
      {linhas.map((l) => (
        <div key={l.chave} className="card p-3">
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-clinic-muted">
              {l.rotuloData} · {l.total} exame(s){l.alterados ? ` · ${l.alterados} alterado(s)` : ""}
            </span>
            <CopiarBotao texto={l.texto} />
          </div>
          <p className="text-sm leading-relaxed">{marcacao === "asteriscos" ? comNegrito(l.texto) : l.texto}</p>
        </div>
      ))}
    </div>
  );
}
