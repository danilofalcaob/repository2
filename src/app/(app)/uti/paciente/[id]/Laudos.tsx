"use client";
import { useMemo, useState } from "react";
import BotaoAcao from "@/components/BotaoAcao";
import { rotuloExame, valorExibido } from "@/lib/exames/linha";
import { formatarUnidade } from "@/lib/exames/catalogo";
import { ehAlterado, ehCritico, FLAG_LABEL, textoReferencia, type Resultado } from "@/lib/exames/valores";
import { excluirDocumento, excluirResultado } from "../../actions";

export type DocumentoResumo = {
  id: string;
  nomeArquivo: string;
  origem: string;
  metodo: string;
  status: string;
  dataColeta: string | null;
  criadoEm: string;
  enviadoPorNome: string | null;
  temArquivo: boolean;
  qtdResultados: number;
};

const TZ = "America/Sao_Paulo";
const dataHora = (iso: string) =>
  new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: TZ }).format(
    new Date(iso),
  );

const METODO_LABEL: Record<string, string> = {
  ia: "IA",
  pdf_texto: "Texto do PDF",
  ocr: "OCR",
  texto: "Texto colado",
  manual: "Manual",
};

export default function Laudos({ documentos, resultados }: { documentos: DocumentoResumo[]; resultados: Resultado[] }) {
  const [aberto, setAberto] = useState<string | null>(null);
  const porDocumento = useMemo(() => {
    const m = new Map<string, Resultado[]>();
    for (const r of resultados) {
      const k = r.documentoId ?? "sem";
      m.set(k, [...(m.get(k) ?? []), r]);
    }
    return m;
  }, [resultados]);

  if (!documentos.length) {
    return <p className="card p-6 text-center text-sm text-clinic-muted">Nenhum laudo anexado.</p>;
  }

  return (
    <div className="card overflow-hidden">
      <ul>
        {documentos.map((d) => {
          const lista = porDocumento.get(d.id) ?? [];
          return (
            <li key={d.id} className="border-b border-clinic-border last:border-0">
              <div className="flex flex-wrap items-center gap-3 px-4 py-3">
                <span className="text-xl">{d.origem === "pdf" ? "📄" : d.origem === "imagem" ? "🖼️" : "📝"}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{d.nomeArquivo}</p>
                  <p className="text-xs text-clinic-muted">
                    Coleta {d.dataColeta ? dataHora(d.dataColeta) : "—"} · {METODO_LABEL[d.metodo] ?? d.metodo} ·{" "}
                    {d.status === "revisao" ? (
                      <span className="font-semibold text-cuidado">aguardando revisão</span>
                    ) : (
                      `${d.qtdResultados} resultado(s)`
                    )}{" "}
                    · enviado {dataHora(d.criadoEm)}
                    {d.enviadoPorNome && ` por ${d.enviadoPorNome}`}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {lista.length > 0 && (
                    <button type="button" className="btn-secondary !py-1.5 text-xs" onClick={() => setAberto(aberto === d.id ? null : d.id)}>
                      {aberto === d.id ? "Ocultar valores" : "Ver valores"}
                    </button>
                  )}
                  {(d.temArquivo || d.metodo === "texto") && (
                    <a href={`/api/uti/documento/${d.id}`} target="_blank" rel="noreferrer" className="btn-secondary !py-1.5 text-xs">
                      Abrir original
                    </a>
                  )}
                  <BotaoAcao
                    acao={excluirDocumento.bind(null, d.id)}
                    confirmar={`Excluir "${d.nomeArquivo}" e os ${d.qtdResultados} resultado(s) extraídos dele?`}
                    className="btn-secondary !py-1.5 text-xs text-instavel"
                  >
                    Excluir
                  </BotaoAcao>
                </div>
              </div>
              {aberto === d.id && (
                <div className="overflow-x-auto bg-clinic-bg/50 px-4 pb-3">
                  <table className="w-full text-xs">
                    <thead className="text-left uppercase text-clinic-muted">
                      <tr>
                        <th className="py-1.5">Exame</th>
                        <th className="py-1.5">Valor</th>
                        <th className="py-1.5">Referência</th>
                        <th className="py-1.5">Situação</th>
                        <th className="py-1.5">Coleta</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {lista.map((r) => (
                        <tr key={r.id} className="border-t border-clinic-border">
                          <td className="py-1.5 font-medium">{rotuloExame(r)}</td>
                          <td className="py-1.5">
                            {valorExibido(r)}
                            {formatarUnidade(r.unidade)}
                          </td>
                          <td className="py-1.5 text-clinic-muted">{textoReferencia(r.refMin, r.refMax)}</td>
                          <td className={`py-1.5 ${ehCritico(r.flag) ? "text-instavel" : ehAlterado(r.flag) ? "text-cuidado" : "text-clinic-muted"}`}>
                            {FLAG_LABEL[r.flag]}
                          </td>
                          <td className="py-1.5 text-clinic-muted">{dataHora(r.coletadoEm)}</td>
                          <td className="py-1.5 text-right">
                            {r.id && (
                              <BotaoAcao
                                acao={excluirResultado.bind(null, r.id)}
                                confirmar={`Excluir ${rotuloExame(r)} ${valorExibido(r)}?`}
                                className="rounded px-2 py-0.5 text-[11px] text-clinic-muted hover:text-instavel"
                              >
                                excluir
                              </BotaoAcao>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
