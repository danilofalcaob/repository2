import { redirect } from "next/navigation";
import { getUsuarioAtual, podeVerGestao } from "@/lib/auth";
import { calcularIndicadores } from "@/lib/metrics";
import { formatarDuracao } from "@/lib/format";
import IndicadoresCharts from "./IndicadoresCharts";
import ExportButtons from "./ExportButtons";

export const dynamic = "force-dynamic";

function pct(v: number) {
  return `${Math.round(v * 100)}%`;
}

function Kpi({ titulo, valor, sub }: { titulo: string; valor: string; sub?: string }) {
  return (
    <div className="card p-4">
      <p className="text-xs uppercase text-clinic-muted">{titulo}</p>
      <p className="mt-1 text-2xl font-bold">{valor}</p>
      {sub && <p className="text-xs text-clinic-muted">{sub}</p>}
    </div>
  );
}

export default async function IndicadoresPage({
  searchParams,
}: {
  searchParams: { de?: string; ate?: string };
}) {
  const u = (await getUsuarioAtual())!;
  if (!podeVerGestao(u.perfil)) redirect("/quadro");

  const de = searchParams.de ? new Date(searchParams.de) : undefined;
  const ate = searchParams.ate ? new Date(searchParams.ate + "T23:59:59") : undefined;
  const m = await calcularIndicadores(u.setoresIds, de, ate);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">Indicadores de gestão</h1>
        <ExportButtons searchParams={searchParams} />
      </div>

      <form method="get" className="card flex flex-wrap items-end gap-3 p-3">
        <div>
          <label className="label">De</label>
          <input type="date" name="de" defaultValue={searchParams.de ?? ""} className="input" />
        </div>
        <div>
          <label className="label">Até</label>
          <input type="date" name="ate" defaultValue={searchParams.ate ?? ""} className="input" />
        </div>
        <button className="btn-secondary">Aplicar período</button>
      </form>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi titulo="Passagens" valor={String(m.totalPassagens)} />
        <Kpi titulo="Média pac./passagem" valor={m.mediaPacientes.toFixed(1)} />
        <Kpi titulo="Duração média" valor={formatarDuracao(m.duracaoMediaSeg)} />
        <Kpi titulo="Completude I-PASS" valor={pct(m.completudeIPass)} />
        <Kpi titulo="Taxa de read-back" valor={pct(m.taxaReadback)} />
        <Kpi
          titulo="Pendências"
          valor={`${m.pendencias.concluidas}/${m.pendencias.criadas}`}
          sub={`${m.pendencias.vencidas} vencidas · herança ${pct(m.pendencias.taxaHeranca)}`}
        />
        <Kpi
          titulo="Tempo médio resolução"
          valor={`${m.pendencias.tempoMedioResolucaoH.toFixed(1)} h`}
        />
        <Kpi
          titulo="Pac. preocupação alta"
          valor={String(m.pacientesPreocupacaoAlta)}
        />
      </div>

      {/* Contingências e TRR */}
      <div className="grid gap-3 md:grid-cols-2">
        <div className="card p-4">
          <h2 className="mb-2 font-semibold">Contingências</h2>
          <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-5">
            <p>Criadas: <strong>{m.contingencias.criadas}</strong></p>
            <p>Ativas: <strong>{m.contingencias.ativas}</strong></p>
            <p>Reconhecidas: <strong>{m.contingencias.reconhecidas}</strong></p>
            <p>Disparadas: <strong>{m.contingencias.disparadas}</strong></p>
            <p>Resolvidas: <strong>{m.contingencias.resolvidas}</strong></p>
          </div>
        </div>
        <div className="card p-4">
          <h2 className="mb-2 font-semibold">TRR / deterioração</h2>
          <div className="grid grid-cols-3 gap-2 text-sm">
            <p>Acionamentos: <strong>{m.trr.total}</strong></p>
            <p>Com contingência prévia: <strong>{m.trr.comContingencia}</strong></p>
            <p>Com preocupação prévia: <strong>{m.trr.comPreocupacao}</strong></p>
          </div>
          <p className="mt-2 text-xs text-clinic-muted">
            Cruzamento entre deterioração e sinais registrados na passagem anterior —
            insumo para fechar o ciclo passagem ↔ TRR.
          </p>
        </div>
      </div>

      {/* Gráficos */}
      <IndicadoresCharts
        passagensPorDia={m.passagensPorDia}
        passagensPorSetor={m.passagensPorSetor}
        contingencias={m.contingencias}
      />
    </div>
  );
}
