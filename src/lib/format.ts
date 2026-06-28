// Formatação pt-BR de datas, horas e durações.

const TZ = "America/Sao_Paulo";

export function formatarDataHora(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const data = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TZ,
  }).format(data);
}

export function formatarData(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const data = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: TZ,
  }).format(data);
}

export function formatarHora(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const data = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TZ,
  }).format(data);
}

// Duração legível a partir de segundos.
export function formatarDuracao(segundos: number | null | undefined): string {
  if (segundos == null) return "—";
  const min = Math.floor(segundos / 60);
  const seg = segundos % 60;
  if (min < 60) return `${min}min ${seg.toString().padStart(2, "0")}s`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}h ${m.toString().padStart(2, "0")}min`;
}

// Tempo relativo em pt-BR (ex.: "há 3 h").
export function tempoRelativo(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const data = typeof d === "string" ? new Date(d) : d;
  const diffMs = Date.now() - data.getTime();
  const min = Math.round(diffMs / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h} h`;
  const dias = Math.round(h / 24);
  return `há ${dias} d`;
}

export function estaVencida(prazo: Date | string | null | undefined): boolean {
  if (!prazo) return false;
  const data = typeof prazo === "string" ? new Date(prazo) : prazo;
  return data.getTime() < Date.now();
}
