import Link from "next/link";
import { getUsuarioAtual } from "@/lib/auth";
import { calcularIndicadoresJornada } from "@/lib/jornada-metrics";
import PainelCharts from "./PainelCharts";

export const dynamic = "force-dynamic";

function pct(v: number) {
  return `${Math.round(v * 100)}%`;
}

function Kpi({
  titulo,
  valor,
  sub,
  destaque,
}: {
  titulo: string;
  valor: string;
  sub?: string;
  destaque?: "bom" | "alerta" | "critico";
}) {
  const cor =
    destaque === "critico"
      ? "text-instavel"
      : destaque === "alerta"
        ? "text-cuidado"
        : destaque === "bom"
          ? "text-estavel"
          : "";
  return (
    <div className="card p-4">
      <p className="text-xs uppercase text-clinic-muted">{titulo}</p>
      <p className={`mt-1 text-2xl font-bold ${cor}`}>{valor}</p>
      {sub && <p className="text-xs text-clinic-muted">{sub}</p>}
    </div>
  );
}

export default async function PainelJornadaPage({
  searchParams,
}: {
  searchParams: { de?: string; ate?: string };
}) {
  const u = (await getUsuarioAtual())!;
  const de = searchParams.de ? new Date(searchParams.de) : undefined;
  const ate = searchParams.ate ? new Date(searchParams.ate + "T23:59:59") : undefined;
  const m = await calcularIndicadoresJornada(u.setoresIds, de, ate);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">Painel de deshospitalização</h1>
          <p className="text-sm text-clinic-muted">
            Onde estamos perdendo dias de internação que poderiam ser evitados.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/jornada/round" className="btn-secondary">
            👥 Round
          </Link>
          <Link href="/jornada" className="btn-secondary">
            ← Funil
          </Link>
        </div>
      </div>

      <form method="get" className="card flex flex-wrap items-end gap-3 p-3">
        <div>
          <label className="label" htmlFor="de">
            De
          </label>
          <input id="de" type="date" name="de" defaultValue={searchParams.de ?? ""} className="input" />
        </div>
        <div>
          <label className="label" htmlFor="ate">
            Até
          </label>
          <input
            id="ate"
            type="date"
            name="ate"
            defaultValue={searchParams.ate ?? ""}
            className="input"
          />
        </div>
        <button className="btn-secondary">Aplicar período</button>
        <p className="text-xs text-clinic-muted">
          O período filtra altas e barreiras; os indicadores de casos ativos são sempre do momento
          atual.
        </p>
      </form>

      {/* Estado atual da enfermaria */}
      <section className="space-y-3">
        <h2 className="text-lg font-bold">Agora</h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kpi
            titulo="Casos ativos"
            valor={String(m.casosAtivos)}
            sub={`permanência média ${m.permanenciaMediaAtivos.toFixed(1)} dia(s)`}
          />
          <Kpi
            titulo="Prontos, travados por processo"
            valor={String(m.prontosTravados)}
            sub="critérios ≥80% com barreira não clínica"
            destaque={m.prontosTravados > 0 ? "critico" : "bom"}
          />
          <Kpi
            titulo="Altas previstas hoje"
            valor={String(m.altasPrevistasHoje)}
            sub={`amanhã: ${m.altasPrevistasAmanha} · 7 dias: ${m.altasPrevistas7d}`}
          />
          <Kpi
            titulo="Sem data de alta prevista"
            valor={String(m.semPrevisao)}
            sub={`previsão vencida: ${m.previsaoVencida}`}
            destaque={m.semPrevisao > 0 ? "alerta" : "bom"}
          />
          <Kpi
            titulo="Casos parados (24h+)"
            valor={String(m.paradas)}
            sub="sem registro de nenhuma equipe"
            destaque={m.paradas > 0 ? "alerta" : "bom"}
          />
          <Kpi
            titulo="Sem gestor do caso"
            valor={String(m.semGestor)}
            destaque={m.semGestor > 0 ? "alerta" : "bom"}
          />
          <Kpi
            titulo="Cobertura do round hoje"
            valor={pct(m.coberturaRound)}
            sub={`${m.revisadosHoje} de ${m.casosAtivos} casos revisados`}
            destaque={m.coberturaRound >= 0.8 ? "bom" : "alerta"}
          />
          <Kpi
            titulo="Barreiras abertas"
            valor={String(m.barreiras.abertas)}
            sub={`${m.barreiras.naoClinicasAbertas} não clínica(s)`}
          />
        </div>
      </section>

      {/* Resultado no período */}
      <section className="space-y-3">
        <h2 className="text-lg font-bold">No período</h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kpi titulo="Altas efetivadas" valor={String(m.totalAltas)} />
          <Kpi
            titulo="Permanência média das altas"
            valor={`${m.permanenciaMediaAltas.toFixed(1)} d`}
          />
          <Kpi
            titulo="Acurácia da previsão"
            valor={pct(m.acuraciaPrevisao)}
            sub={`desvio médio ${m.desvioMedioDias >= 0 ? "+" : ""}${m.desvioMedioDias.toFixed(1)} dia(s)`}
            destaque={m.acuraciaPrevisao >= 0.7 ? "bom" : "alerta"}
          />
          <Kpi
            titulo="Altas até as 12h"
            valor={pct(m.taxaAltaAteMeioDia)}
            sub="libera o leito ainda no turno"
            destaque={m.taxaAltaAteMeioDia >= 0.5 ? "bom" : "alerta"}
          />
          <Kpi
            titulo="Barreiras resolvidas"
            valor={String(m.barreiras.resolvidas)}
            sub={`tempo médio ${m.barreiras.tempoMedioResolucaoH.toFixed(1)} h`}
          />
          <Kpi
            titulo="Dias evitáveis declarados"
            valor={`${m.barreiras.diasEvitaveis} d`}
            sub="impacto somado das barreiras não clínicas"
            destaque={m.barreiras.diasEvitaveis > 0 ? "alerta" : "bom"}
          />
        </div>
      </section>

      <PainelCharts
        casosPorEtapa={m.casosPorEtapa}
        barreirasPorCategoria={m.barreiras.porCategoria}
        tempoMedioPorEtapa={m.tempoMedioPorEtapa}
        altasPorDia={m.altasPorDia}
      />

      <p className="text-center text-[11px] text-clinic-muted">
        Indicadores calculados a partir dos casos dos setores aos quais você tem acesso. &ldquo;Dias
        evitáveis&rdquo; usa o impacto estimado pela própria equipe ao registrar cada barreira não
        clínica.
      </p>
    </div>
  );
}
