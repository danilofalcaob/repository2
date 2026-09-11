import Link from "next/link";
import { getUsuarioAtual } from "@/lib/auth";
import { getSetoresDoUsuario } from "@/lib/queries";
import { getJornadasDoFunil, getMinhaCaixa, getPacientesSemJornada } from "@/lib/jornada-queries";
import { DISCIPLINAS, DISCIPLINA_LABEL, type Disciplina } from "@/lib/constants";
import FunilBoard from "./FunilBoard";

export const dynamic = "force-dynamic";

export default async function FunilPage({
  searchParams,
}: {
  searchParams: { setor?: string; q?: string; disciplina?: string; minha?: string };
}) {
  const u = (await getUsuarioAtual())!;
  const setores = await getSetoresDoUsuario(u.setoresIds);
  const setorFiltro =
    searchParams.setor && u.setoresIds.includes(searchParams.setor) ? searchParams.setor : undefined;
  const disciplina = (searchParams.disciplina as Disciplina | undefined) ?? u.disciplina ?? undefined;
  const somenteMinha = searchParams.minha === "1";

  const [cards, semJornada, caixa] = await Promise.all([
    getJornadasDoFunil(u.setoresIds, {
      setorId: setorFiltro,
      busca: searchParams.q,
      disciplina,
      somenteMinhaDisciplina: somenteMinha,
    }),
    getPacientesSemJornada(setorFiltro ? [setorFiltro] : u.setoresIds),
    getMinhaCaixa(u.id, u.disciplina, u.setoresIds),
  ]);

  const comAlertaCritico = cards.filter((c) => c.alertas.some((a) => a.nivel === "critico")).length;
  const altasHoje = cards.filter((c) => c.situacaoDAP === "hoje").length;
  const travadosPorProcesso = cards.filter(
    (c) => c.barreirasNaoClinicas > 0 && c.prontidao.percentual >= 0.8,
  ).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Funil de Alta</h1>
          <p className="text-sm text-clinic-muted">
            {cards.length} caso(s) em acompanhamento · {altasHoje} alta(s) prevista(s) para hoje
            {comAlertaCritico ? ` · ${comAlertaCritico} com alerta crítico` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/jornada/round" className="btn-secondary">
            👥 Round do dia
          </Link>
          <Link href="/jornada/nova" className="btn-primary">
            ＋ Abrir jornada
          </Link>
        </div>
      </div>

      {/* Painel do profissional: o que está no colo de quem está olhando */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="card p-3">
          <p className="text-xs text-clinic-muted">Minhas tarefas abertas</p>
          <p className="text-2xl font-bold">{caixa.tarefas.length}</p>
          <p className="text-[11px] text-clinic-muted">
            {u.disciplina ? DISCIPLINA_LABEL[u.disciplina] : "Sem disciplina definida"}
          </p>
        </div>
        <div className="card p-3">
          <p className="text-xs text-clinic-muted">Barreiras sob minha responsabilidade</p>
          <p className="text-2xl font-bold">{caixa.barreiras.length}</p>
          <p className="text-[11px] text-clinic-muted">Abertas ou em andamento</p>
        </div>
        <div className="card p-3">
          <p className="text-xs text-clinic-muted">Prontos, travados por processo</p>
          <p className="text-2xl font-bold text-cuidado">{travadosPorProcesso}</p>
          <p className="text-[11px] text-clinic-muted">
            Critérios clínicos ≥ 80% com barreira não clínica
          </p>
        </div>
      </div>

      {semJornada.length > 0 && (
        <div className="card flex flex-wrap items-center justify-between gap-2 border-cuidado/40 bg-cuidado/5 p-3">
          <p className="text-sm">
            <strong>{semJornada.length}</strong> paciente(s) internado(s) ainda fora do funil — sem
            plano de alta compartilhado.
          </p>
          <Link href="/jornada/nova" className="btn-secondary !py-2 text-sm">
            Incluir no funil
          </Link>
        </div>
      )}

      <form className="card flex flex-wrap items-end gap-3 p-3" method="get">
        <div className="min-w-[170px] flex-1">
          <label className="label" htmlFor="setor">
            Setor
          </label>
          <select id="setor" name="setor" defaultValue={setorFiltro ?? ""} className="input">
            <option value="">Todos os meus setores</option>
            {setores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nome}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-[170px] flex-1">
          <label className="label" htmlFor="disciplina">
            Disciplina
          </label>
          <select id="disciplina" name="disciplina" defaultValue={disciplina ?? ""} className="input">
            <option value="">Todas</option>
            {DISCIPLINAS.map((d) => (
              <option key={d} value={d}>
                {DISCIPLINA_LABEL[d]}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-[170px] flex-1">
          <label className="label" htmlFor="q">
            Buscar
          </label>
          <input
            id="q"
            name="q"
            defaultValue={searchParams.q ?? ""}
            className="input"
            placeholder="Paciente, leito ou diagnóstico"
          />
        </div>
        <label className="flex items-center gap-2 pb-2.5 text-sm">
          <input type="checkbox" name="minha" value="1" defaultChecked={somenteMinha} className="h-4 w-4" />
          Só casos com pendência da disciplina
        </label>
        <button className="btn-secondary" type="submit">
          Filtrar
        </button>
      </form>

      {cards.length === 0 ? (
        <div className="card p-8 text-center text-clinic-muted">
          Nenhum caso no funil com esses filtros.{" "}
          <Link href="/jornada/nova" className="text-clinic-primary underline">
            Abrir a primeira jornada
          </Link>
          .
        </div>
      ) : (
        <FunilBoard cards={cards} />
      )}

      <p className="text-center text-[11px] text-clinic-muted">
        Arraste o cartão entre as colunas (ou use o seletor) para mover o caso de etapa. A alta só é
        efetivada com as barreiras bloqueantes resolvidas.
      </p>
    </div>
  );
}
