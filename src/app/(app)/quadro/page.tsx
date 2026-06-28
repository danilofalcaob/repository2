import Link from "next/link";
import { getUsuarioAtual } from "@/lib/auth";
import { getPacientesDoQuadro, getSetoresDoUsuario } from "@/lib/queries";
import { BadgeGravidade, BadgePreocupacao } from "@/components/Badges";
import { TIPO_SETOR_LABEL, type TipoSetor } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function QuadroPage({
  searchParams,
}: {
  searchParams: { setor?: string; q?: string };
}) {
  const u = (await getUsuarioAtual())!;
  const setores = await getSetoresDoUsuario(u.setoresIds);
  const setorFiltro = searchParams.setor && u.setoresIds.includes(searchParams.setor)
    ? searchParams.setor
    : undefined;

  let pacientes = await getPacientesDoQuadro(u.setoresIds, setorFiltro);
  const q = (searchParams.q ?? "").trim().toLowerCase();
  if (q) {
    pacientes = pacientes.filter(
      (p) =>
        p.identificador.toLowerCase().includes(q) ||
        (p.leito ?? "").toLowerCase().includes(q) ||
        (p.diagnosticoPrincipal ?? "").toLowerCase().includes(q),
    );
  }

  const totalCriticos = pacientes.filter(
    (p) => p.gravidade === "instavel" || p.nivelPreocupacao === "alto",
  ).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Quadro de Passagem</h1>
          <p className="text-sm text-clinic-muted">
            {pacientes.length} paciente(s) ativo(s){totalCriticos ? ` · ${totalCriticos} crítico(s)` : ""}
          </p>
        </div>
        <Link href="/passagem/nova" className="btn-primary">
          ＋ Nova passagem
        </Link>
      </div>

      {/* Filtros */}
      <form className="card flex flex-wrap items-end gap-3 p-3" method="get">
        <div className="min-w-[180px] flex-1">
          <label className="label" htmlFor="setor">
            Setor
          </label>
          <select id="setor" name="setor" defaultValue={setorFiltro ?? ""} className="input">
            <option value="">Todos os meus setores</option>
            {setores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nome} · {TIPO_SETOR_LABEL[s.tipo as TipoSetor] ?? s.tipo}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-[180px] flex-1">
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
        <button className="btn-secondary" type="submit">
          Filtrar
        </button>
      </form>

      {pacientes.length === 0 ? (
        <div className="card p-8 text-center text-clinic-muted">
          Nenhum paciente ativo encontrado.{" "}
          <Link href="/pacientes" className="text-clinic-primary underline">
            Cadastrar paciente
          </Link>
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {pacientes.map((p) => (
            <li key={p.id}>
              <Link
                href={`/pacientes/${p.id}`}
                className={`card block h-full p-4 transition hover:border-clinic-primary ${
                  p.gravidade === "instavel" || p.nivelPreocupacao === "alto"
                    ? "ring-1 ring-instavel/40"
                    : ""
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold leading-tight">{p.identificador}</p>
                    <p className="text-xs text-clinic-muted">
                      Leito {p.leito ?? "—"} · {p.idade ?? "?"}a · {p.sexo ?? "—"}
                    </p>
                  </div>
                  <BadgeGravidade valor={p.gravidade} />
                </div>

                {p.diagnosticoPrincipal && (
                  <p className="mt-2 line-clamp-2 text-sm text-clinic-text">
                    {p.diagnosticoPrincipal}
                  </p>
                )}

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {p.nivelPreocupacao !== "baixo" && <BadgePreocupacao valor={p.nivelPreocupacao} />}
                  {p.contingenciasAtivas > 0 && (
                    <span className="badge bg-instavel/15 text-instavel">
                      🛡️ {p.contingenciasAtivas} conting.
                    </span>
                  )}
                  {p.pendenciasAbertas > 0 && (
                    <span className="badge bg-clinic-bg text-clinic-muted">
                      ✓ {p.pendenciasAbertas} pend.
                    </span>
                  )}
                  {p.pendenciasVencidas > 0 && (
                    <span className="badge bg-instavel/15 text-instavel">
                      ⏰ {p.pendenciasVencidas} vencida(s)
                    </span>
                  )}
                </div>

                {p.oQueMePreocupa && p.nivelPreocupacao === "alto" && (
                  <p className="mt-2 rounded-lg bg-instavel/10 px-2 py-1 text-xs text-instavel">
                    ⚠ {p.oQueMePreocupa}
                  </p>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
