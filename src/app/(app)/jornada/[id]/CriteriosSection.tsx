import { BarraProntidao } from "@/components/JornadaBadges";
import { CATEGORIAS_CRITERIO, CATEGORIA_CRITERIO_LABEL, type CategoriaCriterio } from "@/lib/constants";
import type { Prontidao } from "@/lib/jornada";
import CriterioToggle from "./CriterioToggle";

type Criterio = {
  id: string;
  categoria: string;
  descricao: string;
  atendido: boolean;
  naoAplicavel: boolean;
  avaliadoPorId: string | null;
};

export default function CriteriosSection({
  criterios,
  prontidao,
  avaliadores,
}: {
  criterios: Criterio[];
  prontidao: Prontidao;
  avaliadores: Map<string, string>;
}) {
  return (
    <section className="card p-4">
      <header className="mb-3">
        <h2 className="text-lg font-bold">📋 Critérios de alta</h2>
        <p className="text-xs text-clinic-muted">
          Checklist objetivo compartilhado: enquanto ele não fecha, a alta não é segura.
        </p>
      </header>

      <div className="mb-3">
        <BarraProntidao
          atendidos={prontidao.atendidos}
          aplicaveis={prontidao.aplicaveis}
          percentual={prontidao.percentual}
        />
      </div>

      <div className="space-y-3">
        {CATEGORIAS_CRITERIO.map((cat) => {
          const lista = criterios.filter((c) => c.categoria === cat);
          if (!lista.length) return null;
          const atendidos = lista.filter((c) => c.atendido && !c.naoAplicavel).length;
          const aplicaveis = lista.filter((c) => !c.naoAplicavel).length;
          return (
            <div key={cat}>
              <h3 className="mb-1 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-clinic-muted">
                <span>{CATEGORIA_CRITERIO_LABEL[cat as CategoriaCriterio]}</span>
                <span>
                  {atendidos}/{aplicaveis}
                </span>
              </h3>
              <ul className="space-y-0.5">
                {lista.map((c) => (
                  <CriterioToggle
                    key={c.id}
                    criterioId={c.id}
                    descricao={c.descricao}
                    atendido={c.atendido}
                    naoAplicavel={c.naoAplicavel}
                    avaliadoPor={c.avaliadoPorId ? avaliadores.get(c.avaliadoPorId) : null}
                  />
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </section>
  );
}
