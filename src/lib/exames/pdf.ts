import "server-only";
import { extractTextItems, getDocumentProxy } from "unpdf";

// Extrai o texto de um PDF reconstruindo as linhas pela posição dos trechos
// (laudos costumam ser tabelas: nome, resultado, unidade e referência na mesma
// altura). PDFs digitalizados (só imagem) retornam texto vazio.
export async function textoDoPdf(bytes: Uint8Array): Promise<{ texto: string; paginas: number }> {
  const pdf = await getDocumentProxy(new Uint8Array(bytes));
  const { totalPages, items } = await extractTextItems(pdf);
  const paginas: string[] = [];

  for (const pagina of items) {
    const trechos = pagina.filter((i) => i.str && i.str.trim() !== "");
    // Agrupa por linha (mesma altura, com tolerância proporcional à fonte).
    const linhas: { y: number; tam: number; itens: typeof trechos }[] = [];
    for (const it of trechos) {
      const tam = it.fontSize || it.height || 10;
      const linha = linhas.find((l) => Math.abs(l.y - it.y) <= Math.max(2, Math.min(tam, l.tam) * 0.45));
      if (linha) linha.itens.push(it);
      else linhas.push({ y: it.y, tam, itens: [it] });
    }
    linhas.sort((a, b) => b.y - a.y);
    const texto = linhas.map((l) => {
      const itens = [...l.itens].sort((a, b) => a.x - b.x);
      let out = "";
      let fimAnterior: number | null = null;
      for (const it of itens) {
        if (fimAnterior != null) {
          const gap = it.x - fimAnterior;
          const tam = it.fontSize || 10;
          out += gap > tam * 1.2 ? "   " : gap > tam * 0.12 ? " " : "";
        }
        out += it.str;
        fimAnterior = it.x + (it.width || it.str.length * (it.fontSize || 10) * 0.5);
      }
      return out.replace(/\s+$/, "");
    });
    paginas.push(texto.join("\n"));
  }
  return { texto: paginas.join("\n\n"), paginas: totalPages };
}
