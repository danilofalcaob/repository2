import {
  CATEGORIA_BARREIRA_LABEL,
  CONFIANCA_LABEL,
  COR_ETAPA,
  DESTINO_ALTA_LABEL,
  DISCIPLINA_ICONE,
  DISCIPLINA_LABEL,
  ETAPA_LABEL,
  STATUS_BARREIRA_LABEL,
  type CategoriaBarreira,
  type Confianca,
  type DestinoAlta,
  type Disciplina,
  type EtapaJornada,
  type StatusBarreira,
} from "@/lib/constants";
import { SITUACAO_DAP_LABEL, type Alerta, type SituacaoDAP } from "@/lib/jornada";

export function BadgeEtapa({ valor }: { valor: string }) {
  const cor = COR_ETAPA[valor as EtapaJornada] ?? "#64748b";
  return (
    <span
      className="badge"
      style={{ backgroundColor: `${cor}22`, color: cor }}
      title="Etapa da jornada de alta"
    >
      {ETAPA_LABEL[valor as EtapaJornada] ?? valor}
    </span>
  );
}

export function BadgeDisciplina({ valor }: { valor: string }) {
  return (
    <span className="badge bg-clinic-bg text-clinic-muted">
      {DISCIPLINA_ICONE[valor as Disciplina] ?? "•"}{" "}
      {DISCIPLINA_LABEL[valor as Disciplina] ?? valor}
    </span>
  );
}

export function BadgeCategoriaBarreira({ valor, clinica }: { valor: string; clinica: boolean }) {
  return (
    <span
      className={`badge ${clinica ? "bg-clinic-primary/15 text-clinic-primary" : "bg-cuidado/15 text-cuidado"}`}
      title={clinica ? "Barreira clínica" : "Barreira não clínica (processo)"}
    >
      {CATEGORIA_BARREIRA_LABEL[valor as CategoriaBarreira] ?? valor}
    </span>
  );
}

export function BadgeStatusBarreira({ valor }: { valor: string }) {
  const map: Record<string, string> = {
    aberta: "bg-instavel/15 text-instavel",
    em_andamento: "bg-cuidado/15 text-cuidado",
    resolvida: "bg-estavel/15 text-estavel",
    cancelada: "bg-clinic-bg text-clinic-muted",
  };
  return (
    <span className={`badge ${map[valor] ?? "bg-clinic-bg text-clinic-muted"}`}>
      {STATUS_BARREIRA_LABEL[valor as StatusBarreira] ?? valor}
    </span>
  );
}

export function BadgeDAP({ situacao, data }: { situacao: SituacaoDAP; data?: Date | null }) {
  const map: Record<SituacaoDAP, string> = {
    sem_previsao: "bg-clinic-bg text-clinic-muted",
    vencida: "bg-instavel/15 text-instavel",
    hoje: "bg-estavel/15 text-estavel",
    amanha: "bg-estavel/15 text-estavel",
    proximos_dias: "bg-clinic-primary/15 text-clinic-primary",
    futura: "bg-clinic-bg text-clinic-muted",
  };
  const texto = data
    ? `${new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" }).format(data)} · ${
        SITUACAO_DAP_LABEL[situacao]
      }`
    : SITUACAO_DAP_LABEL[situacao];
  return <span className={`badge ${map[situacao]}`}>🗓 {texto}</span>;
}

export function BadgeConfianca({ valor }: { valor: string }) {
  const map: Record<string, string> = {
    baixa: "bg-instavel/15 text-instavel",
    media: "bg-cuidado/15 text-cuidado",
    alta: "bg-estavel/15 text-estavel",
  };
  return (
    <span className={`badge ${map[valor] ?? "bg-clinic-bg text-clinic-muted"}`}>
      Confiança: {CONFIANCA_LABEL[valor as Confianca] ?? valor}
    </span>
  );
}

export function BadgeDestino({ valor }: { valor: string }) {
  return (
    <span className="badge bg-clinic-bg text-clinic-muted">
      🏠 {DESTINO_ALTA_LABEL[valor as DestinoAlta] ?? valor}
    </span>
  );
}

// Barra de prontidão: o equivalente à "probabilidade de fechamento" do CRM,
// só que ancorada em critérios clínicos objetivos.
export function BarraProntidao({
  atendidos,
  aplicaveis,
  percentual,
  compacta = false,
}: {
  atendidos: number;
  aplicaveis: number;
  percentual: number;
  compacta?: boolean;
}) {
  const pct = Math.round(percentual * 100);
  const cor = pct >= 80 ? "#16a34a" : pct >= 50 ? "#d97706" : "#64748b";
  return (
    <div className={compacta ? "" : "space-y-1"}>
      {!compacta && (
        <div className="flex items-center justify-between text-xs text-clinic-muted">
          <span>Critérios de alta</span>
          <span className="font-semibold text-clinic-text">
            {atendidos}/{aplicaveis} ({pct}%)
          </span>
        </div>
      )}
      <div
        className="h-1.5 w-full overflow-hidden rounded-full bg-clinic-bg"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Critérios de alta atendidos: ${atendidos} de ${aplicaveis}`}
      >
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: cor }} />
      </div>
      {compacta && (
        <p className="mt-1 text-[11px] text-clinic-muted">
          Critérios {atendidos}/{aplicaveis}
        </p>
      )}
    </div>
  );
}

export function ChipsAlertas({ alertas, max = 3 }: { alertas: Alerta[]; max?: number }) {
  if (!alertas.length) return null;
  const mostrar = alertas.slice(0, max);
  const restantes = alertas.length - mostrar.length;
  return (
    <div className="flex flex-wrap gap-1">
      {mostrar.map((a) => (
        <span
          key={a.tipo}
          title={a.texto}
          className={`badge ${
            a.nivel === "critico"
              ? "bg-instavel/15 text-instavel"
              : a.nivel === "atencao"
                ? "bg-cuidado/15 text-cuidado"
                : "bg-clinic-bg text-clinic-muted"
          }`}
        >
          {a.nivel === "critico" ? "⚠" : "•"} {a.texto}
        </span>
      ))}
      {restantes > 0 && (
        <span className="badge bg-clinic-bg text-clinic-muted">+{restantes}</span>
      )}
    </div>
  );
}
