import {
  STATUS_CIRANDA_LABEL,
  STATUS_INTENCAO_LABEL,
  type StatusCiranda,
  type StatusIntencao,
} from "@/lib/constants";

const COR_CIRANDA: Record<StatusCiranda, string> = {
  proposta: "bg-alerta/15 text-alerta",
  aguardando_loja: "bg-app-primary/15 text-app-primary",
  em_avaliacao: "bg-app-primary/15 text-app-primary",
  confirmacao_final: "bg-alerta/15 text-alerta",
  em_liquidacao: "bg-app-primary/15 text-app-primary",
  concluida: "bg-ok/15 text-ok",
  cancelada: "bg-app-muted/15 text-app-muted",
};

const COR_INTENCAO: Record<StatusIntencao, string> = {
  ativa: "bg-app-primary/15 text-app-primary",
  em_ciranda: "bg-alerta/15 text-alerta",
  pausada: "bg-app-muted/15 text-app-muted",
  concluida: "bg-ok/15 text-ok",
  cancelada: "bg-app-muted/15 text-app-muted",
};

export function BadgeCiranda({ status }: { status: string }) {
  const s = status as StatusCiranda;
  return <span className={`badge ${COR_CIRANDA[s] ?? ""}`}>{STATUS_CIRANDA_LABEL[s] ?? status}</span>;
}

export function BadgeIntencao({ status }: { status: string }) {
  const s = status as StatusIntencao;
  return <span className={`badge ${COR_INTENCAO[s] ?? ""}`}>{STATUS_INTENCAO_LABEL[s] ?? status}</span>;
}

export function Kpi({ rotulo, valor, detalhe }: { rotulo: string; valor: string; detalhe?: string }) {
  return (
    <div className="card p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-app-muted">{rotulo}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums">{valor}</p>
      {detalhe && <p className="mt-0.5 text-xs text-app-muted">{detalhe}</p>}
    </div>
  );
}
