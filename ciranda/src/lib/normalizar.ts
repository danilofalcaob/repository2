// Normalização de texto livre para comparação (marca, modelo, cor, cidade):
// sem acento, minúsculo, espaços simples. "São Paulo" === "sao  paulo".
export function normalizar(texto: string | null | undefined): string {
  return (texto ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// Forma canônica da cor: "Branca" → "branco", "PRATA" → "prata".
const COR_FEMININO: Record<string, string> = {
  branca: "branco",
  preta: "preto",
  vermelha: "vermelho",
  amarela: "amarelo",
  dourada: "dourado",
};

export function corCanonica(cor: string | null | undefined): string {
  const c = normalizar(cor);
  return COR_FEMININO[c] ?? c;
}

// Converte "azul, prata" (como fica salvo no banco) em lista canônica.
export function listaCores(cores: string | null | undefined): string[] {
  return (cores ?? "")
    .split(",")
    .map(corCanonica)
    .filter((c) => c !== "");
}

// O modelo desejado casa com o modelo do carro se for igual ou um prefixo por
// palavra inteira: quem quer "A3" aceita "A3 Sedan", mas "HB20" não casa com "HB20S".
export function modeloCompativel(desejado: string, doCarro: string): boolean {
  const d = normalizar(desejado);
  const c = normalizar(doCarro);
  return c === d || c.startsWith(d + " ");
}
