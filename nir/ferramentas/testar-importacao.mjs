// Testes automáticos das regras do NIR (mesma lógica das fórmulas do Power Apps).
// Uso: node nir/ferramentas/testar-importacao.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const AQUI = dirname(fileURLToPath(import.meta.url));
const NIR = createRequire(import.meta.url)(join(AQUI, "..", "prototipo", "logica.js"));
const ex = (n) => readFileSync(join(AQUI, "..", "exemplos", n), "utf8");

let ok = 0;
let falhas = 0;
function teste(nome, fn) {
  try {
    fn();
    ok++;
    console.log("  ✓", nome);
  } catch (e) {
    falhas++;
    console.log("  ✗", nome, "\n     ", e.message);
  }
}

const TODOS = ["PS_GERAL", "PS_ONCO", "EMERGENCIA", "UTI", "UI4_P1", "UI4_SM", "UI6_P1", "UI6_P2", "UI6_P3", "UI6_P4", "UI7_P1", "UI7_P2", "UI7_P3", "UI7_P4"];
const novoEstado = () => ({ internacoes: [], movimentacoes: [], censoResumo: {}, importacoes: [], solicitacoes: [] });

function importar(estado, arquivoOuTexto, setor, chaveData, janela, agora, setoresRotina = TODOS) {
  const texto = arquivoOuTexto.includes("\t") ? arquivoOuTexto : ex(arquivoOuTexto);
  const lido = NIR.lerCenso(texto);
  assert.ok(lido.ok, lido.erro);
  const { previa, ausentes } = NIR.classificar(lido.censo, setor, estado.internacoes, agora);
  const r = NIR.aplicarImportacao(estado, { setor, chaveData, janela, previa, ausentes, leitos: 10, agora, setoresRotina });
  return { lido, previa, ausentes, ...r };
}

console.log("Sinônimos de colunas");
teste("logica.js e App.Formulas.fx têm exatamente os mesmos sinônimos", () => {
  const fx = readFileSync(join(AQUI, "..", "powerapps", "App.Formulas.fx"), "utf8");
  const bloco = fx.slice(fx.indexOf("tblMapaColunas = Table("), fx.indexOf(");", fx.indexOf("tblMapaColunas = Table(")));
  const pares = [...bloco.matchAll(/\{Campo: "(\w+)", Sinonimo: "([^"]+)"\}/g)].map((m) => m[1] + "=" + m[2]).sort();
  const js = Object.entries(NIR.MAPA_COLUNAS).flatMap(([c, s]) => s.map((x) => c + "=" + x)).sort();
  assert.deepEqual(js, pares);
});

console.log("Leitura do Ctrl+E");
teste("acha o cabeçalho depois das linhas de título e ignora a linha de total", () => {
  const r = NIR.lerCenso(ex("manha-PS_GERAL.tsv"));
  assert.equal(r.linhaCab, 3);
  assert.equal(r.censo.length, 6);
  assert.equal(r.ignoradas, 1);
  assert.deepEqual(r.colunasFaltando, []);
  assert.equal(r.censo[0].NrAtendimento, "900101");
  assert.equal(r.censo[0].Leito, "PS-01");
  assert.equal(r.censo[0].DataInternacao.getDate(), 22);
  assert.equal(r.censo[0].DataInternacao.getHours(), 8);
  assert.equal(r.censo[0].Especialidade, "CLÍNICA MÉDICA");
});
teste("texto sem coluna de atendimento é recusado", () => {
  assert.equal(NIR.lerCenso("Nome\tLeito\nFulano\t1").ok, false);
});
teste("atendimento com pontos é normalizado (900.101 → 900101)", () => {
  const r = NIR.lerCenso("Atendimento\tPaciente\tLeito\tData Internação\n900.101\tX\t1\t01/11/2026");
  assert.equal(r.censo[0].NrAtendimento, "900101");
});

console.log("Cenário manhã → tarde");
const estado = novoEstado();
const d = (s) => new Date(s);
teste("manhã: 3 setores importados, todos os pacientes como novos", () => {
  const a = importar(estado, "manha-PS_GERAL.tsv", "PS_GERAL", "2026-11-23", "MANHA", d("2026-11-23T09:05:00"));
  const b = importar(estado, "manha-UTI.tsv", "UTI", "2026-11-23", "MANHA", d("2026-11-23T09:10:00"));
  const c = importar(estado, "manha-UI6_P1.tsv", "UI6_P1", "2026-11-23", "MANHA", d("2026-11-23T09:15:00"));
  assert.equal(a.previa.filter((p) => p.Classe === "NOVO").length, 6);
  assert.equal(b.previa.length, 5);
  assert.equal(c.previa.length, 6);
  assert.equal(estado.internacoes.length, 17);
  assert.equal(a.rotinaCompleta, false);
});
teste("UTI: 2 pacientes com 15 dias ou mais no resumo do censo (internados em 01/11 e 05/11)", () => {
  assert.equal(estado.censoResumo["2026-11-23|MANHA|UTI"].Perm15d, 2);
});
teste("tarde UI6-P1: 1 transferência, 1 troca de leito, 1 saída", () => {
  const r = importar(estado, "tarde-UI6_P1.tsv", "UI6_P1", "2026-11-23", "TARDE", d("2026-11-23T17:10:00"));
  const classe = (at) => r.previa.find((p) => p.NrAtendimento === at).Classe;
  assert.equal(classe("900102"), "TRANSFERENCIA");
  assert.equal(classe("900302"), "TROCA_LEITO");
  assert.equal(classe("900301"), "SEM_MUDANCA");
  assert.deepEqual(r.ausentes.map((a) => a.NrAtendimento), ["900303"]);
  const p102 = estado.internacoes.find((i) => i.NrAtendimento === "900102");
  assert.equal(p102.SetorCodigo, "UI6_P1");
  assert.equal(p102.Leito, "603");
  assert.equal(estado.internacoes.find((i) => i.NrAtendimento === "900303").Status, "SAIDA_VERIFICAR");
  const mov = estado.movimentacoes.filter((m) => m.JanelaChave === "2026-11-23|TARDE").map((m) => m.Tipo).sort();
  assert.deepEqual(mov, ["SAIDA_VERIFICAR", "TRANSFERENCIA", "TROCA_LEITO"]);
});

console.log("Fechamento da rotina (alta presumida)");
teste("quando todos os setores da rotina chegam, quem sumiu vira alta presumida", () => {
  const e = novoEstado();
  const rot = ["PS_GERAL", "UTI", "UI6_P1"];
  importar(e, "manha-PS_GERAL.tsv", "PS_GERAL", "2026-11-23", "MANHA", d("2026-11-23T09:00:00"), rot);
  importar(e, "manha-UTI.tsv", "UTI", "2026-11-23", "MANHA", d("2026-11-23T09:01:00"), rot);
  importar(e, "manha-UI6_P1.tsv", "UI6_P1", "2026-11-23", "MANHA", d("2026-11-23T09:02:00"), rot);
  // tarde: UI6 primeiro (900102 chega do PS, 900303 some), depois PS sem o 900102, depois UTI
  const t1 = importar(e, "tarde-UI6_P1.tsv", "UI6_P1", "2026-11-23", "TARDE", d("2026-11-23T17:00:00"), rot);
  assert.equal(t1.rotinaCompleta, false);
  assert.equal(t1.proximoSetor, "PS_GERAL");
  const psTarde = ex("manha-PS_GERAL.tsv").split("\r\n").filter((l) => !l.includes("900102")).join("\r\n");
  const t2 = importar(e, psTarde, "PS_GERAL", "2026-11-23", "TARDE", d("2026-11-23T17:05:00"), rot);
  assert.equal(t2.ausentes.length, 0, "900102 já está na UI6, não pode virar ausente do PS");
  const t3 = importar(e, "manha-UTI.tsv", "UTI", "2026-11-23", "TARDE", d("2026-11-23T17:10:00"), rot);
  assert.equal(t3.rotinaCompleta, true);
  assert.equal(t3.altasPresumidas, 1);
  assert.equal(e.internacoes.find((i) => i.NrAtendimento === "900303").Status, "ALTA_PRESUMIDA");
  assert.equal(e.internacoes.find((i) => i.NrAtendimento === "900102").Status, "INTERNADO");
});
teste("paciente com alta presumida que reaparece no mesmo setor volta como retorno", () => {
  const e = novoEstado();
  const rot = ["UI6_P1"];
  importar(e, "manha-UI6_P1.tsv", "UI6_P1", "2026-11-23", "MANHA", d("2026-11-23T09:00:00"), rot);
  importar(e, "tarde-UI6_P1.tsv", "UI6_P1", "2026-11-23", "TARDE", d("2026-11-23T17:00:00"), rot); // 900303 → alta presumida
  assert.equal(e.internacoes.find((i) => i.NrAtendimento === "900303").Status, "ALTA_PRESUMIDA");
  const r = importar(e, "manha-UI6_P1.tsv", "UI6_P1", "2026-11-23", "NOITE", d("2026-11-23T23:00:00"), rot);
  assert.equal(r.previa.find((p) => p.NrAtendimento === "900303").Classe, "RETORNO");
});
teste("leito cedido + paciente aparece no destino → solicitação concluída", () => {
  const e = novoEstado();
  importar(e, "manha-PS_GERAL.tsv", "PS_GERAL", "2026-11-23", "MANHA", d("2026-11-23T09:00:00"));
  importar(e, "manha-UI6_P1.tsv", "UI6_P1", "2026-11-23", "MANHA", d("2026-11-23T09:01:00"));
  e.solicitacoes.push({ NrAtendimento: "900102", SetorDestino: "UI6_P1", Status: "LEITO_CEDIDO" });
  importar(e, "tarde-UI6_P1.tsv", "UI6_P1", "2026-11-23", "TARDE", d("2026-11-23T17:00:00"));
  assert.equal(e.solicitacoes[0].Status, "CONCLUIDA");
});

console.log("Dia do NIR e rotinas");
teste("janelas: 07h–13h manhã, 13h–20h tarde, 20h–03h noite, 03h–07h madrugada", () => {
  const j = (s) => NIR.janelaDe(d(s));
  assert.equal(j("2026-11-23T07:00:00").janelaChave, "2026-11-23|MANHA");
  assert.equal(j("2026-11-23T12:59:00").janela, "MANHA");
  assert.equal(j("2026-11-23T13:00:00").janela, "TARDE");
  assert.equal(j("2026-11-23T20:00:00").janela, "NOITE");
  assert.equal(j("2026-11-24T02:30:00").janelaChave, "2026-11-23|NOITE");
  assert.equal(j("2026-11-24T05:00:00").janelaChave, "2026-11-23|MADRUGADA");
  assert.equal(j("2026-11-24T06:59:00").janelaChave, "2026-11-23|MADRUGADA");
});
teste("situação das rotinas às 10h30 com a manhã incompleta", () => {
  const imps = [{ ChaveData: "2026-11-23", Janela: "MANHA", TipoGuia: "CENSO", SetorCodigo: "UTI" }];
  const s = NIR.statusRotina(imps, ["UTI", "PS_GERAL"], d("2026-11-23T10:30:00"));
  const m = s.find((x) => x.codigo === "MANHA");
  assert.equal(m.recebidos, 1);
  assert.equal(m.situacao, "Atrasada"); // 09h + 60 min de tolerância
  assert.deepEqual(m.faltam, ["PS_GERAL"]);
  assert.equal(s.find((x) => x.codigo === "TARDE").situacao, "Aguardando");
});

console.log("SLA");
teste("cores do cronômetro: verde < 70%, amarelo 70–99%, vermelho ≥ 100%", () => {
  const sol = { SolicitadoEm: d("2026-11-23T09:00:00"), SLAMinutos: 100 };
  assert.equal(NIR.nivelSla(NIR.slaPct(sol, d("2026-11-23T10:00:00"))), "verde");
  assert.equal(NIR.nivelSla(NIR.slaPct(sol, d("2026-11-23T10:15:00"))), "amarelo");
  assert.equal(NIR.nivelSla(NIR.slaPct(sol, d("2026-11-23T10:40:00"))), "vermelho");
  assert.equal(NIR.crono(3725), "01:02:05");
  assert.equal(NIR.minutosTexto(135), "2h 15min");
});

console.log(`\n${ok} teste(s) OK, ${falhas} falha(s).`);
process.exit(falhas ? 1 : 0);
