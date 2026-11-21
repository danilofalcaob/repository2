import Link from "next/link";
import { getUsuarioAtual, podeVerGestao } from "@/lib/auth";
import { getMapaLeitos, getUtisDoUsuario } from "@/lib/exames/queries";
import { formatarDataHora } from "@/lib/format";
import AdmitirPaciente from "./AdmitirPaciente";
import VincularLeito from "./VincularLeito";

export const dynamic = "force-dynamic";

function diasDesde(iso: string) {
  return Math.max(1, Math.ceil((Date.now() - new Date(iso).getTime()) / 86_400_000));
}

export default async function MapaLeitosPage({ searchParams }: { searchParams: { setor?: string } }) {
  const u = (await getUsuarioAtual())!;
  const utis = await getUtisDoUsuario(u);
  const configuradas = utis.filter((s) => s.leitos.length > 0);
  const atual = configuradas.find((s) => s.id === searchParams.setor) ?? configuradas[0];

  if (!atual) {
    return (
      <div className="mx-auto max-w-xl space-y-4 py-8 text-center">
        <div className="text-5xl">🛏️</div>
        <h1 className="text-2xl font-bold">UTI · Evolução de exames</h1>
        <p className="text-clinic-muted">
          Para começar, configure a unidade: quantos leitos ela tem e como eles são numerados. Depois é só admitir os
          pacientes e anexar os exames (PDF ou printscreen).
        </p>
        {u.perfil !== "profissional" ? (
          <Link href="/uti/configurar" className="btn-primary">
            Configurar leitos
          </Link>
        ) : (
          <p className="text-sm text-clinic-muted">Peça à coordenação ou a um médico da unidade para configurar os leitos.</p>
        )}
      </div>
    );
  }

  const { mapa, semLeito } = await getMapaLeitos(atual.id);
  const ocupados = mapa.filter((l) => l.paciente).length;
  const comCritico = mapa.filter((l) => (l.paciente?.criticos ?? 0) > 0).length;
  const leitosLivres = mapa.filter((l) => !l.paciente).map((l) => l.numero);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{atual.nome}</h1>
          <p className="text-sm text-clinic-muted">
            {ocupados}/{mapa.length} leitos ocupados
            {comCritico > 0 && <span className="font-semibold text-instavel"> · {comCritico} com valor crítico</span>}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {configuradas.length > 1 && (
            <div className="flex flex-wrap gap-1">
              {configuradas.map((s) => (
                <Link
                  key={s.id}
                  href={`/uti?setor=${s.id}`}
                  className={`rounded-lg px-3 py-1.5 text-sm ${
                    s.id === atual.id ? "bg-clinic-primary/15 font-semibold text-clinic-primary" : "text-clinic-muted hover:bg-clinic-surface"
                  }`}
                >
                  {s.nome}
                </Link>
              ))}
            </div>
          )}
          {u.perfil !== "profissional" && (
            <Link href={`/uti/configurar?setor=${atual.id}`} className="btn-secondary !py-1.5 text-sm">
              ⚙️ Leitos
            </Link>
          )}
          {podeVerGestao(u.perfil) && (
            <Link href="/uti/configurar?nova=1" className="btn-secondary !py-1.5 text-sm">
              ＋ Nova UTI
            </Link>
          )}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {mapa.map((l) =>
          l.paciente ? (
            <Link
              key={l.leitoId}
              href={`/uti/paciente/${l.paciente.id}`}
              className={`card block p-3 transition hover:shadow-md ${
                l.paciente.criticos > 0 ? "border-instavel/60" : l.paciente.alterados > 0 ? "border-cuidado/50" : ""
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="rounded-md bg-clinic-primary/15 px-2 py-0.5 text-sm font-bold text-clinic-primary">
                  {l.numero}
                </span>
                <span className="text-xs text-clinic-muted">D{diasDesde(l.paciente.admissao)}</span>
              </div>
              <p className="mt-2 truncate font-semibold">{l.paciente.identificador}</p>
              <p className="truncate text-xs text-clinic-muted">
                {l.paciente.idade ?? "?"}a · {l.paciente.sexo ?? "—"} · {l.paciente.diagnostico ?? "sem diagnóstico"}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {l.paciente.criticos > 0 && (
                  <span className="badge bg-instavel/15 text-instavel">🚨 {l.paciente.criticos} crítico(s)</span>
                )}
                {l.paciente.alterados - l.paciente.criticos > 0 && (
                  <span className="badge bg-cuidado/15 text-cuidado">
                    ⚠️ {l.paciente.alterados - l.paciente.criticos} alterado(s)
                  </span>
                )}
                {l.paciente.ultimaColeta && l.paciente.alterados === 0 && (
                  <span className="badge bg-estavel/15 text-estavel">✓ sem alterações</span>
                )}
              </div>
              {l.paciente.destaques.length > 0 && (
                <p className="mt-1.5 line-clamp-2 text-xs text-clinic-text">{l.paciente.destaques.join(" · ")}</p>
              )}
              <p className="mt-2 text-[11px] text-clinic-muted">
                {l.paciente.ultimaColeta ? `Último lab: ${formatarDataHora(l.paciente.ultimaColeta)}` : "Sem exames anexados"}
              </p>
            </Link>
          ) : (
            <div key={l.leitoId} className="card flex flex-col border-dashed p-3">
              <div className="flex items-start justify-between">
                <span className="rounded-md bg-clinic-bg px-2 py-0.5 text-sm font-bold text-clinic-muted">{l.numero}</span>
                <span className="text-xs text-clinic-muted">Livre</span>
              </div>
              <div className="mt-auto pt-3">
                <AdmitirPaciente setorId={atual.id} leito={l.numero} />
              </div>
            </div>
          ),
        )}
      </div>

      {semLeito.length > 0 && (
        <div className="card p-4">
          <h2 className="font-semibold">Pacientes da unidade sem leito configurado</h2>
          <p className="mb-3 text-xs text-clinic-muted">
            Internados neste setor cujo leito não corresponde a nenhum leito da configuração. Vincule a um leito livre.
          </p>
          <ul className="space-y-2">
            {semLeito.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-3 text-sm">
                <Link href={`/uti/paciente/${p.id}`} className="font-medium text-clinic-primary hover:underline">
                  {p.identificador}
                </Link>
                <span className="text-xs text-clinic-muted">leito atual: {p.leitoAtual ?? "—"}</span>
                <VincularLeito pacienteId={p.id} leitosLivres={leitosLivres} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
