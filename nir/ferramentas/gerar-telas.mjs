// Gera as telas do Power Apps (nir/powerapps/telas/*.pa.yaml).
//
// Cada guia fica em um módulo de ferramentas/pa/. Os blocos comuns (menu lateral,
// relógio, cronômetros, barra da rotina, construtores de controles) ficam em
// ferramentas/pa/base.mjs, para que nenhuma cópia fique diferente da outra.
//
// Uso:  node nir/ferramentas/gerar-telas.mjs
// Os arquivos gerados são os que você cola no Power Apps Studio.
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { definirSintaxePtBr } from "./pa/base.mjs";
import { telaPrincipal } from "./pa/tela-principal.mjs";
import { telaRotina } from "./pa/tela-rotina.mjs";
import { telaVagas } from "./pa/tela-vagas.mjs";
import { telaPrevisoes } from "./pa/tela-previsoes.mjs";
import { telaPermanencia } from "./pa/tela-permanencia.mjs";
import { telaAmbulancias } from "./pa/tela-ambulancias.mjs";
import { telaCateterismos } from "./pa/tela-cateterismos.mjs";
import { telaRecepcao } from "./pa/tela-recepcao.mjs";
import { telaPassagem } from "./pa/tela-passagem.mjs";
import { telaMetas } from "./pa/tela-metas.mjs";

const AQUI = dirname(fileURLToPath(import.meta.url));
const SAIDA = join(AQUI, "..", "powerapps", "telas");

// ordem = ordem de colagem no Power Apps Studio
const TELAS = [
  ["1-Principal.pa.yaml", telaPrincipal],
  ["2-RotinaAtualizacao.pa.yaml", telaRotina],
  ["3-GestaoVagas.pa.yaml", telaVagas],
  ["4-PrevisoesAlta.pa.yaml", telaPrevisoes],
  ["5-GestaoPermanencia.pa.yaml", telaPermanencia],
  ["6-Ambulancias.pa.yaml", telaAmbulancias],
  ["7-Cateterismos.pa.yaml", telaCateterismos],
  ["8-PrevisaoRecepcao.pa.yaml", telaRecepcao],
  ["9-PassagemPlantao.pa.yaml", telaPassagem],
  ["10-Metas.pa.yaml", telaMetas],
];

function gerar(pasta, ptbr) {
  definirSintaxePtBr(ptbr);
  mkdirSync(pasta, { recursive: true });
  for (const [nome, fn] of TELAS) {
    const conteudo = fn();
    writeFileSync(join(pasta, nome), conteudo, "utf8");
    console.log("gerado:", join(pasta.slice(pasta.indexOf("nir")), nome), `(${conteudo.split("\n").length} linhas)`);
  }
}
gerar(SAIDA, false); // padrão: sintaxe en-US (a usada pelo código das telas do Power Apps)
gerar(join(SAIDA, "pt-BR"), true); // alternativa, se o Studio recusar a versão padrão
