// Copia o motor de OCR (tesseract.js) e o idioma português para public/ocr,
// para que a leitura de printscreens funcione no navegador SEM depender de CDN
// externo (redes hospitalares costumam bloquear CDNs, e a imagem nunca sai do
// computador do usuário). Roda no postinstall, no predev e no build.

import { copyFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const destino = path.join(raiz, "public", "ocr");
const nm = (...p) => path.join(raiz, "node_modules", ...p);

const origens = [
  [nm("tesseract.js", "dist", "worker.min.js"), "worker.min.js"],
  [nm("@tesseract.js-data", "por", "4.0.0_best_int", "por.traineddata.gz"), path.join("lang", "por.traineddata.gz")],
];
const core = nm("tesseract.js-core");
if (existsSync(core)) {
  for (const f of readdirSync(core)) {
    // O tesseract.js escolhe a variante (simd/relaxedsimd, lstm) conforme o navegador.
    if (/^tesseract-core.*\.(wasm\.js|js|wasm)$/.test(f) && f.includes("lstm")) origens.push([path.join(core, f), f]);
  }
}

let copiados = 0;
for (const [de, para] of origens) {
  if (!existsSync(de)) {
    console.warn(`[ocr] arquivo não encontrado (OCR local indisponível até rodar npm install): ${path.relative(raiz, de)}`);
    continue;
  }
  const alvo = path.join(destino, para);
  mkdirSync(path.dirname(alvo), { recursive: true });
  copyFileSync(de, alvo);
  copiados++;
}
console.log(`[ocr] ${copiados} arquivo(s) do OCR copiados para public/ocr.`);
