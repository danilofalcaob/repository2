import {
  GRAVIDADE_LABEL,
  PREOCUPACAO_LABEL,
  STATUS_CONTINGENCIA_LABEL,
  STATUS_PACIENTE_LABEL,
  PRIORIDADE_LABEL,
  type Gravidade,
  type Preocupacao,
  type StatusContingencia,
  type StatusPaciente,
  type Prioridade,
} from "@/lib/constants";

export function BadgeGravidade({ valor }: { valor: string }) {
  const map: Record<string, string> = {
    estavel: "bg-estavel/15 text-estavel",
    cuidado: "bg-cuidado/15 text-cuidado",
    instavel: "bg-instavel/15 text-instavel",
  };
  return (
    <span className={`badge ${map[valor] ?? "bg-clinic-bg text-clinic-muted"}`}>
      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: corDot(valor) }} />
      {GRAVIDADE_LABEL[valor as Gravidade] ?? valor}
    </span>
  );
}

function corDot(g: string) {
  return g === "instavel" ? "#dc2626" : g === "cuidado" ? "#d97706" : "#16a34a";
}

export function BadgePreocupacao({ valor }: { valor: string }) {
  const map: Record<string, string> = {
    baixo: "bg-estavel/15 text-estavel",
    medio: "bg-cuidado/15 text-cuidado",
    alto: "bg-instavel/15 text-instavel",
  };
  return (
    <span className={`badge ${map[valor] ?? "bg-clinic-bg text-clinic-muted"}`}>
      Preocupação: {PREOCUPACAO_LABEL[valor as Preocupacao] ?? valor}
    </span>
  );
}

export function BadgeStatusPaciente({ valor }: { valor: string }) {
  const map: Record<string, string> = {
    ativo: "bg-clinic-primary/15 text-clinic-primary",
    alta: "bg-estavel/15 text-estavel",
    obito: "bg-clinic-text/10 text-clinic-text",
    transferido: "bg-cuidado/15 text-cuidado",
  };
  return (
    <span className={`badge ${map[valor] ?? "bg-clinic-bg text-clinic-muted"}`}>
      {STATUS_PACIENTE_LABEL[valor as StatusPaciente] ?? valor}
    </span>
  );
}

export function BadgeStatusContingencia({ valor }: { valor: string }) {
  const map: Record<string, string> = {
    ativa: "bg-clinic-primary/15 text-clinic-primary",
    reconhecida: "bg-estavel/15 text-estavel",
    disparada: "bg-instavel/15 text-instavel",
    resolvida: "bg-clinic-bg text-clinic-muted",
  };
  return (
    <span className={`badge ${map[valor] ?? "bg-clinic-bg text-clinic-muted"}`}>
      {STATUS_CONTINGENCIA_LABEL[valor as StatusContingencia] ?? valor}
    </span>
  );
}

export function BadgePrioridade({ valor }: { valor: string }) {
  const map: Record<string, string> = {
    baixa: "bg-clinic-bg text-clinic-muted",
    media: "bg-cuidado/15 text-cuidado",
    alta: "bg-instavel/15 text-instavel",
  };
  return (
    <span className={`badge ${map[valor] ?? "bg-clinic-bg text-clinic-muted"}`}>
      {PRIORIDADE_LABEL[valor as Prioridade] ?? valor}
    </span>
  );
}
