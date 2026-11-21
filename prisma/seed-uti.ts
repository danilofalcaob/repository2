// Dados de demonstração FICTÍCIOS do módulo UTI · Exames: leitos da "UTI Geral"
// e pacientes com evolução laboratorial de alguns dias (para ver pontos de
// atenção, tendências, exames em linha e resumo evolutivo).
//
// Chamado pelo seed principal (npm run db:seed) ou sozinho, num banco que já
// existe, com: npm run db:seed:uti (só carrega se a UTI ainda não tem leitos).
import { PrismaClient } from "@prisma/client";
import { getAnalito } from "../src/lib/exames/catalogo";
import { chaveDia, dataLocalParaISO } from "../src/lib/exames/parser";
import { casasDe, completarResultado, formatarNumeroBR } from "../src/lib/exames/valores";

const DIA = 86_400_000;

// Série diária: valores do mais antigo (D-5) para o mais recente (hoje).
type Serie = Record<string, (number | null)[]>;

type PacienteDemo = {
  identificador: string;
  leito: string;
  idade: number;
  sexo: "F" | "M";
  diagnostico: string;
  diasInternado: number;
  exames: Serie;
  extrasPorDia?: Record<number, Serie>; // coletas adicionais (ex.: gasometria da tarde)
};

const PACIENTES: PacienteDemo[] = [
  {
    identificador: "PAC-0101 (Maria S.)",
    leito: "UTI-01",
    idade: 72,
    sexo: "F",
    diagnostico: "Pneumonia comunitária grave, VNI intermitente",
    diasInternado: 6,
    exames: {
      hb: [12.4, 12.1, 11.9, 12.0, 12.2, 12.1],
      leucocitos: [18200, 17100, 14900, 12800, 11600, 9800],
      neutrofilos: [15900, 14800, 12600, 10400, 9100, 7200],
      plaquetas: [198000, 205000, 221000, 240000, 262000, 280000],
      na: [131, 130, 131, 132, 131, 132],
      k: [4.1, 4.0, 3.9, 4.2, 4.0, 4.1],
      ureia: [48, 44, 40, 36, 33, 30],
      cr: [1.0, 0.98, 0.92, 0.88, 0.85, 0.84],
      pcr: [248, 231, 176, 120, 82, 51],
      pct: [4.8, null, 2.1, null, 0.9, 0.4],
      lactato: [2.6, 1.8, 1.4, null, null, null],
      albumina: [3.1, null, 3.0, null, 3.0, null],
    },
  },
  {
    identificador: "PAC-0102 (José P.)",
    leito: "UTI-02",
    idade: 55,
    sexo: "M",
    diagnostico: "Cetoacidose diabética",
    diasInternado: 3,
    exames: {
      glicose: [null, null, null, 520, 246, 182],
      ph: [null, null, null, 7.08, 7.29, 7.38],
      pco2: [null, null, null, 18, 28, 36],
      hco3: [null, null, null, 6.2, 14.5, 22.8],
      be: [null, null, null, -24, -11, -2.1],
      na: [null, null, null, 131, 136, 139],
      k: [null, null, null, 5.9, 4.1, 3.2],
      cl: [null, null, null, 98, 106, 108],
      p: [null, null, null, 2.8, 1.4, 0.9],
      mg: [null, null, null, 2.1, 1.8, 1.6],
      ureia: [null, null, null, 62, 48, 36],
      cr: [null, null, null, 1.62, 1.21, 0.98],
      leucocitos: [null, null, null, 16400, 11200, 8900],
      hb: [null, null, null, 15.8, 14.2, 13.9],
      plaquetas: [null, null, null, 310000, 284000, 262000],
      lactato: [null, null, null, 2.9, 1.6, 1.1],
    },
  },
  {
    identificador: "PAC-0105 (Helena M.)",
    leito: "UTI-05",
    idade: 48,
    sexo: "F",
    diagnostico: "PO de colecistectomia com coleperitônio",
    diasInternado: 4,
    exames: {
      hb: [null, null, 11.2, 10.8, 10.6, 10.4],
      leucocitos: [null, null, 10200, 12900, 15400, 17800],
      plaquetas: [null, null, 240000, 228000, 219000, 205000],
      tgo: [null, null, 88, 142, 210, 246],
      tgp: [null, null, 102, 168, 255, 301],
      ggt: [null, null, 120, 188, 260, 312],
      fa: [null, null, 140, 190, 236, 270],
      bt: [null, null, 1.4, 2.2, 3.1, 3.9],
      bd: [null, null, 0.9, 1.6, 2.4, 3.1],
      bi: [null, null, 0.5, 0.6, 0.7, 0.8],
      amilase: [null, null, 82, 76, 70, 68],
      lipase: [null, null, 44, 40, 38, 35],
      pcr: [null, null, 64, 118, 162, 205],
      na: [null, null, 138, 137, 138, 136],
      k: [null, null, 3.9, 3.6, 3.4, 3.2],
      cr: [null, null, 0.7, 0.72, 0.75, 0.74],
      albumina: [null, null, 3.2, null, 2.9, 2.7],
      inr: [null, null, 1.1, 1.2, 1.3, 1.4],
    },
  },
];

// Paciente já existente no seed principal (PAC-0005, choque séptico, UTI-04).
const EXAMES_ANTONIO: Serie = {
  hb: [11.8, 11.1, 10.4, 10.0, 9.8, 9.6],
  ht: [35.2, 33.4, 31.0, 30.1, 29.4, 28.9],
  leucocitos: [11200, 13400, 15100, 16900, 18200, 19800],
  neutrofilos: [9400, 11500, 13300, 15000, 16300, 17900],
  linfocitos: [900, 760, 640, 610, 580, 560],
  plaquetas: [210000, 182000, 151000, 128000, 109000, 95000],
  na: [138, 139, 141, 142, 143, 142],
  k: [4.8, 5.6, 6.2, 5.4, 4.7, 4.5],
  cl: [104, 106, 108, 109, 108, 107],
  mg: [1.9, 1.7, 1.6, 1.5, 1.8, 2.0],
  p: [3.8, 4.1, 4.9, 5.3, 4.6, 4.2],
  ureia: [52, 71, 94, 118, 132, 140],
  cr: [1.02, 1.35, 1.78, 2.05, 2.31, 2.42],
  lactato: [5.2, 4.1, 3.1, 2.2, 1.6, 1.3],
  ph: [7.24, 7.29, 7.33, 7.37, 7.39, 7.4],
  pco2: [31, 33, 34, 36, 38, 39],
  hco3: [13.5, 15.8, 17.9, 20.6, 22.4, 23.6],
  be: [-12.8, -9.6, -7.0, -3.9, -1.8, -0.6],
  pcr: [96, 168, 241, 222, 184, 150],
  pct: [8.5, null, 6.1, null, 4.2, 3.2],
  albumina: [2.8, null, 2.7, null, 2.6, null],
  inr: [1.12, 1.24, 1.38, 1.46, 1.55, 1.61],
  tgo: [38, 42, 45, 41, 39, 36],
  tgp: [30, 33, 35, 34, 31, 29],
  bt: [0.8, 0.9, 1.1, 1.0, 0.9, 0.9],
  glicose: [182, 164, 158, 171, 149, 152],
};

// 06:00 (horário de Brasília) de hoje — ou de ontem, se ainda não passou das 06:00.
function baseColeta(): number {
  const [a, m, d] = chaveDia(new Date()).split("-").map(Number);
  let base = new Date(dataLocalParaISO(a, m, d, 6)).getTime();
  if (base > Date.now()) base -= DIA;
  return base;
}

function resultadosDoDia(serie: Serie, indice: number, sexo: string, coletadoEm: string) {
  const lista = [];
  for (const [codigo, valores] of Object.entries(serie)) {
    const valor = valores[indice];
    if (valor == null) continue;
    const a = getAnalito(codigo)!;
    const casas = Math.max(casasDe(valor), a.casas);
    lista.push(
      completarResultado(
        {
          analito: codigo,
          nome: a.rotulo,
          valor,
          valorTexto: formatarNumeroBR(valor, casas),
          casas,
          unidade: a.unidade,
          refMin: null,
          refMax: null,
          coletadoEm,
        },
        sexo,
      ),
    );
  }
  return lista;
}

async function criarExames(prisma: PrismaClient, pacienteId: string, sexo: string, serie: Serie) {
  const base = baseColeta();
  const n = Math.max(...Object.values(serie).map((v) => v.length));
  for (let i = 0; i < n; i++) {
    const coletadoEm = new Date(base - (n - 1 - i) * DIA).toISOString();
    const lista = resultadosDoDia(serie, i, sexo, coletadoEm);
    if (!lista.length) continue;
    const dia = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" }).format(
      new Date(coletadoEm),
    );
    await prisma.documentoExame.create({
      data: {
        pacienteId,
        nomeArquivo: `Laudo demonstração ${dia}.txt`,
        tipoMime: "text/plain",
        origem: "texto",
        metodo: "texto",
        textoExtraido: "Dados fictícios de demonstração.",
        status: "confirmado",
        confirmadoEm: new Date(coletadoEm),
        dataColeta: new Date(coletadoEm),
        enviadoPorNome: "Demonstração",
        resultados: {
          create: lista.map((r) => ({
            pacienteId,
            analito: r.analito,
            nome: r.nome,
            valor: r.valor,
            valorTexto: r.valorTexto,
            casas: r.casas,
            unidade: r.unidade,
            refMin: r.refMin,
            refMax: r.refMax,
            flag: r.flag,
            coletadoEm: new Date(coletadoEm),
            criadoPor: "Demonstração",
          })),
        },
      },
    });
  }
}

export async function seedUti(prisma: PrismaClient, utiId: string) {
  const leitos = Array.from({ length: 10 }, (_, i) => `UTI-${String(i + 1).padStart(2, "0")}`);
  await prisma.leito.createMany({ data: leitos.map((numero, ordem) => ({ setorId: utiId, numero, ordem })) });

  const antonio = await prisma.paciente.findFirst({ where: { setorId: utiId, identificador: { startsWith: "PAC-0005" } } });
  if (antonio) {
    await prisma.paciente.update({ where: { id: antonio.id }, data: { dataAdmissao: new Date(Date.now() - 6 * DIA) } });
    await criarExames(prisma, antonio.id, antonio.sexo ?? "M", EXAMES_ANTONIO);
  }

  for (const p of PACIENTES) {
    const criado = await prisma.paciente.create({
      data: {
        setorId: utiId,
        identificador: p.identificador,
        leito: p.leito,
        idade: p.idade,
        sexo: p.sexo,
        diagnosticoPrincipal: p.diagnostico,
        alergias: "Nega",
        dataAdmissao: new Date(Date.now() - p.diasInternado * DIA),
      },
    });
    await criarExames(prisma, criado.id, p.sexo, p.exames);
  }
  console.log(`🧪 UTI · Exames: ${leitos.length} leitos e ${PACIENTES.length + (antonio ? 1 : 0)} pacientes com exames.`);
}

// Execução avulsa: npm run db:seed:uti
if (process.argv[1]?.includes("seed-uti")) {
  const prisma = new PrismaClient();
  (async () => {
    const uti = await prisma.setor.findFirst({ where: { tipo: "UTI", nome: "UTI Geral" } });
    if (!uti) {
      console.log("Setor 'UTI Geral' não encontrado — rode o seed completo (npm run db:seed).");
      return;
    }
    if (await prisma.leito.count({ where: { setorId: uti.id } })) {
      console.log("A UTI Geral já tem leitos configurados — nada a fazer.");
      return;
    }
    await seedUti(prisma, uti.id);
  })()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
