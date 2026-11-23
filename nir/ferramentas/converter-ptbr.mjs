// Converte fórmulas do Power Apps da sintaxe en-US para a sintaxe pt-BR.
//
//   en-US:  If(a, 1.5, 2); Set(x, 1)
//   pt-BR:  If(a; 1,5; 2);; Set(x; 1)
//
// Regras (aplicadas só FORA de textos "..." , de nomes '...' e de comentários):
//   ;  → ;;     (encadeamento de comandos / fim de fórmula nomeada)
//   ,  → ;      (separador de argumentos e de campos)
//   .  → ,      (apenas o ponto decimal de números, como 0.7)
//
// Uso: node nir/ferramentas/converter-ptbr.mjs
// Gera nir/powerapps/pt-BR/*.fx a partir de nir/powerapps/*.fx
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export function converterPtBr(src) {
  let out = "";
  let i = 0;
  const n = src.length;
  while (i < n) {
    const ch = src[i];
    // comentário de linha
    if (ch === "/" && src[i + 1] === "/") {
      const fim = src.indexOf("\n", i);
      const j = fim < 0 ? n : fim;
      out += src.slice(i, j);
      i = j;
      continue;
    }
    // comentário de bloco
    if (ch === "/" && src[i + 1] === "*") {
      const fim = src.indexOf("*/", i + 2);
      const j = fim < 0 ? n : fim + 2;
      out += src.slice(i, j);
      i = j;
      continue;
    }
    // texto "..." (aspas duplas escapadas como "")
    if (ch === '"') {
      let j = i + 1;
      while (j < n) {
        if (src[j] === '"') {
          if (src[j + 1] === '"') {
            j += 2;
            continue;
          }
          break;
        }
        j++;
      }
      out += src.slice(i, j + 1);
      i = j + 1;
      continue;
    }
    // nome entre aspas simples, ex.: Font.'Segoe UI'
    if (ch === "'") {
      let j = i + 1;
      while (j < n && src[j] !== "'") j++;
      out += src.slice(i, j + 1);
      i = j + 1;
      continue;
    }
    if (ch === ";") {
      out += ";;";
      i++;
      continue;
    }
    if (ch === ",") {
      out += ";";
      i++;
      continue;
    }
    if (ch === "." && /[0-9]/.test(src[i - 1] || "") && /[0-9]/.test(src[i + 1] || "")) {
      // só é decimal se os dígitos antes do ponto não fazem parte de um nome (ex.: Label1.Text)
      let k = i - 1;
      while (k >= 0 && /[0-9]/.test(src[k])) k--;
      if (k < 0 || !/[A-Za-z_]/.test(src[k])) {
        out += ",";
        i++;
        continue;
      }
    }
    out += ch;
    i++;
  }
  return out;
}

// execução direta: converte os arquivos .fx
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const AQUI = dirname(fileURLToPath(import.meta.url));
  const ORIGEM = join(AQUI, "..", "powerapps");
  const DESTINO = join(ORIGEM, "pt-BR");
  mkdirSync(DESTINO, { recursive: true });
  for (const nome of readdirSync(ORIGEM).filter((f) => f.endsWith(".fx"))) {
    const src = readFileSync(join(ORIGEM, nome), "utf8");
    const cab =
      "// >>> VERSÃO pt-BR (ponto e vírgula entre argumentos, ;; entre comandos).\n" +
      "// >>> Gerada automaticamente a partir de ../" + nome + " — não edite aqui.\n";
    writeFileSync(join(DESTINO, nome), cab + converterPtBr(src), "utf8");
    console.log("gerado:", join("nir/powerapps/pt-BR", nome));
  }
}
