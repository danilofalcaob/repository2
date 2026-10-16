const MOEDA = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const NUMERO = new Intl.NumberFormat("pt-BR");

export function reais(valor: number): string {
  return MOEDA.format(valor);
}

// "+ R$ 1.000" / "− R$ 1.000" para mostrar sentido do dinheiro.
export function reaisComSinal(valor: number): string {
  if (valor === 0) return reais(0);
  return `${valor > 0 ? "+" : "−"} ${reais(Math.abs(valor))}`;
}

export function km(valor: number): string {
  return `${NUMERO.format(valor)} km`;
}

export function percentual(taxa: number): string {
  return `${NUMERO.format(Math.round(taxa * 1000) / 10)}%`;
}

// O servidor pode rodar em UTC; os horários são sempre mostrados no fuso de Brasília.
const FUSO = "America/Sao_Paulo";

export function dataHora(d: Date): string {
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: FUSO });
}

export function data(d: Date): string {
  return d.toLocaleDateString("pt-BR", { timeZone: FUSO });
}

export function tempoRestante(prazo: Date, agora: Date = new Date()): string {
  const ms = prazo.getTime() - agora.getTime();
  if (ms <= 0) return "prazo vencido";
  const h = Math.floor(ms / 3600000);
  if (h >= 24) return `${Math.floor(h / 24)}d ${h % 24}h restantes`;
  return `${h}h ${Math.floor((ms % 3600000) / 60000)}min restantes`;
}

// Entre participantes só aparece o primeiro nome (minimização de dados — LGPD).
export function primeiroNome(nome: string): string {
  return nome.trim().split(/\s+/)[0] ?? nome;
}

export function capitalizar(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

type CarroResumo = { marca: string; modelo: string; cor: string; anoModelo?: number; ano?: number };

export function nomeCarro(v: CarroResumo, comAno = true): string {
  const ano = v.anoModelo ?? v.ano;
  return `${v.marca} ${v.modelo} ${v.cor.toLowerCase()}${comAno && ano ? ` ${ano}` : ""}`;
}

// Converte "152.000", "R$ 152.000,00" ou "152000" em 152000.
export function lerReais(texto: string | null | undefined): number | null {
  if (!texto) return null;
  const limpo = texto.replace(/[^\d,]/g, "").split(",")[0];
  if (!limpo) return null;
  const n = parseInt(limpo, 10);
  return Number.isFinite(n) ? n : null;
}

type DesejoResumo = { marca: string; modelo: string | null; cores: string; anoMin: number | null; kmMax: number | null; cambio: string | null };

// "Jeep Compass · azul ou prata · 2021+ · até 60.000 km · automático"
export function descreverDesejo(d: DesejoResumo): string {
  const partes = [`${d.marca} ${d.modelo ?? "(qualquer modelo)"}`];
  const cores = d.cores.split(",").filter(Boolean);
  if (cores.length) partes.push(cores.join(" ou "));
  if (d.anoMin) partes.push(`${d.anoMin}+`);
  if (d.kmMax) partes.push(`até ${km(d.kmMax)}`);
  if (d.cambio) partes.push(d.cambio === "automatico" ? "automático" : "manual");
  return partes.join(" · ");
}
