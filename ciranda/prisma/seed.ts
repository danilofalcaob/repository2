// Dados de demonstração (fictícios). Cada cenário passa pelo motor de
// casamento real: se os dados não fecharem exatamente uma roda, o seed falha.
//
//  CR-7JMP  o exemplo original (João, Maria, Pedro, Guilherme) — aguardando aceites
//  CR-3ABC  Ana, Bruno e Carla — em vistoria na Prime Seminovos
//  CR-9DEP  Diego ↔ Elisa — concluída (Auto Vale)
//  CR-5FGH  Henrique compra, Gabriela troca, Felipe vende — concluída (Prime)
//  CR-8LMX  Lucas ↔ Mariana — cancelada (Mariana recusou)
//  Fila: Rafael e Sabrina esperam o elo que falta (um VW T-Cross querendo um
//  Corolla Cross) — cadastre-o e veja a ciranda fechar na hora.

import { PrismaClient, type Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { casar, type Participante } from "../src/lib/casamento";
import { calcularLiquidacao } from "../src/lib/liquidacao";
import { listaCores } from "../src/lib/normalizar";
import { TAXA_PLATAFORMA, type TipoIntencao } from "../src/lib/constants";

const prisma = new PrismaClient();
const HORA = 3600_000;
const DIA = 24 * HORA;
const agora = Date.now();
const atras = (ms: number) => new Date(agora - ms);

type Carro = {
  marca: string;
  modelo: string;
  versao?: string;
  anoModelo: number;
  cor: string;
  km: number;
  cambio?: "manual" | "automatico";
  valor: number;
  fipe?: number;
  placa?: string;
};
type DesejoSeed = { marca: string; modelo?: string; cores?: string[]; anoMin?: number; kmMax?: number; cambio?: string };

let senhaHash = "";

async function usuario(nome: string, email: string, telefone: string, cidade = "São Paulo", extra: Partial<Prisma.UsuarioUncheckedCreateInput> = {}) {
  return prisma.usuario.create({ data: { nome, email, telefone, cidade, senhaHash, ...extra } });
}

async function intencao(
  u: { id: string; cidade: string },
  tipo: TipoIntencao,
  opts: { carro?: Carro; desejos?: DesejoSeed[]; maxPagar?: number; criadoEm?: Date },
) {
  const v = opts.carro;
  const veiculo = v
    ? await prisma.veiculo.create({
        data: {
          donoId: u.id,
          marca: v.marca,
          modelo: v.modelo,
          versao: v.versao,
          anoModelo: v.anoModelo,
          cor: v.cor,
          km: v.km,
          cambio: v.cambio ?? "automatico",
          combustivel: "Flex",
          placa: v.placa,
          valorPretendido: v.valor,
          valorFipe: v.fipe,
          criadoEm: opts.criadoEm,
        },
      })
    : null;
  return prisma.intencao.create({
    data: {
      usuarioId: u.id,
      tipo,
      cidade: u.cidade,
      veiculoId: veiculo?.id,
      maxPagar: opts.maxPagar ?? 0,
      criadoEm: opts.criadoEm,
      desejos: {
        create: (opts.desejos ?? []).map((d, i) => ({
          ordem: i + 1,
          marca: d.marca,
          modelo: d.modelo ?? null,
          cores: (d.cores ?? []).join(","),
          anoMin: d.anoMin ?? null,
          kmMax: d.kmMax ?? null,
          cambio: d.cambio ?? null,
        })),
      },
    },
    include: { veiculo: true, desejos: true, usuario: true },
  });
}

type IntencaoSeed = Awaited<ReturnType<typeof intencao>>;

function participante(i: IntencaoSeed): Participante {
  return {
    id: i.id,
    tipo: i.tipo as TipoIntencao,
    cidade: i.cidade,
    maxPagar: i.maxPagar,
    veiculo: i.veiculo
      ? {
          id: i.veiculo.id,
          marca: i.veiculo.marca,
          modelo: i.veiculo.modelo,
          ano: i.veiculo.anoModelo,
          cor: i.veiculo.cor,
          km: i.veiculo.km,
          cambio: i.veiculo.cambio,
          valor: i.veiculo.valorPretendido,
        }
      : null,
    desejos: i.desejos.map((d) => ({
      ordem: d.ordem,
      marca: d.marca,
      modelo: d.modelo,
      cores: listaCores(d.cores),
      anoMin: d.anoMin,
      kmMax: d.kmMax,
      cambio: d.cambio,
    })),
  };
}

type Etapa = "proposta" | "em_avaliacao" | "concluida" | "cancelada";

async function ciranda(
  codigo: string,
  grupo: IntencaoSeed[],
  cfg: {
    etapa: Etapa;
    criadaHa: number;
    loja?: { id: string; nome: string; taxaServico: number };
    aceitos?: string[]; // ids de intenção que já aceitaram (etapa proposta)
    avaliacoes?: Record<string, { valor: number; obs?: string }>; // por id de intenção
    recusou?: { intencao: IntencaoSeed; motivo: string };
  },
) {
  const r = casar(grupo.map(participante));
  if (r.ciclos.length !== 1 || r.ciclos[0].elos.length !== grupo.length) {
    throw new Error(`Seed ${codigo}: o motor não fechou exatamente uma roda com ${grupo.length} participantes.`);
  }
  const ciclo = r.ciclos[0];
  const criadoEm = atras(cfg.criadaHa);
  const concluida = cfg.etapa === "concluida";
  const avaliada = (id: string) => concluida || cfg.avaliacoes?.[id] !== undefined;
  const nome = (id: string) => grupo.find((g) => g.id === id)!.usuario.nome.split(" ")[0];

  const status = cfg.etapa === "concluida" ? "concluida" : cfg.etapa === "cancelada" ? "cancelada" : cfg.etapa;
  const c = await prisma.ciranda.create({
    data: {
      codigo,
      cidade: ciclo.cidade,
      status,
      lojaId: cfg.loja?.id,
      taxaPlataforma: TAXA_PLATAFORMA,
      taxaLoja: cfg.loja?.taxaServico,
      prazo: cfg.etapa === "proposta" ? new Date(criadoEm.getTime() + 48 * HORA) : new Date(criadoEm.getTime() + 48 * HORA),
      pontuacao: ciclo.pontuacao,
      criadoEm,
      concluidaEm: concluida ? atras(cfg.criadaHa - 5 * DIA) : null,
      motivoCancelamento: cfg.recusou ? `${nome(cfg.recusou.intencao.id)} recusou a proposta.` : null,
      elos: {
        create: ciclo.elos.map((e, posicao) => {
          const av = cfg.avaliacoes?.[e.participanteId];
          const temCarro = !!e.veiculoEntregueId;
          const recusou = cfg.recusou?.intencao.id === e.participanteId;
          const aceitou =
            cfg.etapa !== "proposta" && cfg.etapa !== "cancelada" ? true : (cfg.aceitos ?? []).includes(e.participanteId);
          return {
            posicao,
            intencaoId: e.participanteId,
            veiculoEntregueId: e.veiculoEntregueId,
            veiculoRecebidoId: e.veiculoRecebidoId,
            desejoAtendido: e.desejoAtendido,
            valorProposta: e.valorEntregue,
            aceite: recusou ? "recusado" : aceitou ? "aceito" : "pendente",
            aceiteEm: aceitou || recusou ? new Date(criadoEm.getTime() + 3 * HORA) : null,
            motivoRecusa: recusou ? cfg.recusou!.motivo : null,
            ...(temCarro && avaliada(e.participanteId)
              ? {
                  avaliacao: "aprovado",
                  docOk: true,
                  gravameOk: true,
                  cautelarOk: true,
                  estadoOk: true,
                  valorAvaliado: av?.valor ?? e.valorEntregue,
                  obsAvaliacao: av?.obs ?? null,
                  avaliadoEm: new Date(criadoEm.getTime() + 2 * DIA),
                }
              : {}),
            ...(concluida
              ? {
                  confirmacao: "confirmado",
                  confirmadoEm: new Date(criadoEm.getTime() + 3 * DIA),
                  pagamentoOk: true,
                  transferenciaOk: temCarro,
                }
              : {}),
          };
        }),
      },
    },
    include: { elos: true },
  });

  // Histórico coerente com a etapa.
  const ev = (ms: number, tipo: string, descricao: string) =>
    prisma.eventoCiranda.create({ data: { cirandaId: c.id, tipo, descricao, criadoEm: new Date(criadoEm.getTime() + ms) } });
  await ev(0, "formada", `Ciranda formada pelo motor de casamento com ${grupo.length} participantes. Prazo de 48h para os aceites.`);
  if (cfg.etapa === "proposta") {
    for (const id of cfg.aceitos ?? []) await ev(3 * HORA, "aceite", `${nome(id)} aceitou a proposta.`);
  }
  if (cfg.recusou) {
    await ev(5 * HORA, "cancelada", `Ciranda cancelada: ${nome(cfg.recusou.intencao.id)} recusou a proposta. Os demais participantes voltaram para a fila de casamento.`);
  }
  if (cfg.etapa === "em_avaliacao" || concluida) {
    for (const g of grupo) await ev(3 * HORA, "aceite", `${nome(g.id)} aceitou a proposta.`);
    await ev(3 * HORA + 1, "aguardando_loja", "Todos aceitaram. A ciranda está disponível para as lojas parceiras da cidade.");
    await ev(6 * HORA, "loja_assumiu", `${cfg.loja!.nome} assumiu a ciranda e vai agendar a vistoria dos carros.`);
    for (const g of grupo) {
      if (!g.veiculo || !avaliada(g.id)) continue;
      const v = cfg.avaliacoes?.[g.id]?.valor ?? g.veiculo.valorPretendido;
      await ev(2 * DIA, "avaliacao", `O ${g.veiculo.marca} ${g.veiculo.modelo} de ${nome(g.id)} foi aprovado na vistoria. Valor validado: R$ ${v.toLocaleString("pt-BR")}.`);
    }
  }
  if (concluida) {
    await ev(2 * DIA + HORA, "confirmacao_final", "Todos os carros aprovados. Os participantes devem confirmar os valores finais.");
    await ev(3 * DIA, "em_liquidacao", "Todos confirmaram. A loja vai acertar os pagamentos e transferir os carros.");
    const valorPorVeiculo = new Map(c.elos.map((e) => [e.veiculoEntregueId, e.valorAvaliado ?? e.valorProposta]));
    const liq = calcularLiquidacao(
      c.elos.map((e) => ({
        valorEntregue: e.veiculoEntregueId ? e.valorAvaliado ?? e.valorProposta : 0,
        valorRecebido: e.veiculoRecebidoId ? valorPorVeiculo.get(e.veiculoRecebidoId) ?? 0 : 0,
      })),
      { plataforma: TAXA_PLATAFORMA, loja: cfg.loja!.taxaServico },
    );
    await ev(
      cfg.criadaHa - 5 * DIA,
      "concluida",
      `Ciranda concluída: ${grupo.length} participantes, R$ ${liq.valorBruto.toLocaleString("pt-BR")} em carros. Comissão da plataforma: R$ ${liq.receitaPlataforma.toLocaleString("pt-BR")}. Taxa da loja: R$ ${liq.receitaLoja.toLocaleString("pt-BR")}.`,
    );
    for (const e of c.elos) {
      const g = grupo.find((x) => x.id === e.intencaoId)!;
      if (e.veiculoRecebidoId) await prisma.veiculo.update({ where: { id: e.veiculoRecebidoId }, data: { donoId: g.usuarioId } });
    }
  }

  const statusIntencao = cfg.etapa === "concluida" ? "concluida" : cfg.etapa === "cancelada" ? "ativa" : "em_ciranda";
  await prisma.intencao.updateMany({ where: { id: { in: grupo.map((g) => g.id) } }, data: { status: statusIntencao } });
  if (cfg.recusou) {
    const quem = cfg.recusou.intencao;
    const elo = c.elos.find((e) => e.intencaoId === quem.id)!;
    await prisma.bloqueio.create({ data: { intencaoId: quem.id, veiculoId: elo.veiculoRecebidoId! } });
  }
  return c;
}

async function main() {
  console.log("🌱 Limpando e populando o banco de demonstração da Ciranda…");
  await prisma.eventoCiranda.deleteMany();
  await prisma.elo.deleteMany();
  await prisma.ciranda.deleteMany();
  await prisma.bloqueio.deleteMany();
  await prisma.desejo.deleteMany();
  await prisma.intencao.deleteMany();
  await prisma.veiculo.deleteMany();
  await prisma.sessao.deleteMany();
  await prisma.usuario.deleteMany();
  await prisma.loja.deleteMany();

  senhaHash = await bcrypt.hash("demo123", 10);

  // Plataforma e lojas parceiras -------------------------------------------
  await usuario("Equipe Ciranda", "admin@demo.com", "(11) 4000-0000", "São Paulo", { perfil: "admin" });
  const prime = await prisma.loja.create({
    data: { nome: "Prime Seminovos", cnpj: "12.345.678/0001-90", cidade: "São Paulo", endereco: "Av. Brasil, 1500 — Jardins", telefone: "(11) 3333-1000", taxaServico: 0.03 },
  });
  const vale = await prisma.loja.create({
    data: { nome: "Auto Vale Seminovos", cnpj: "98.765.432/0001-10", cidade: "São Paulo", endereco: "Av. Ricardo Jafet, 800 — Ipiranga", telefone: "(11) 3333-2000", taxaServico: 0.025 },
  });
  const campinas = await prisma.loja.create({
    data: { nome: "Campinas Motors", cidade: "Campinas", telefone: "(19) 3333-3000", taxaServico: 0.03 },
  });
  await usuario("Ricardo Prime", "loja@demo.com", "(11) 3333-1000", "São Paulo", { perfil: "loja", lojaId: prime.id });
  await usuario("Sueli Vale", "loja2@demo.com", "(11) 3333-2000", "São Paulo", { perfil: "loja", lojaId: vale.id });
  await usuario("Marcos Campinas", "loja3@demo.com", "(19) 3333-3000", "Campinas", { perfil: "loja", lojaId: campinas.id });

  // 1) O exemplo original — aguardando aceites -----------------------------
  const joao = await usuario("João Almeida", "joao@demo.com", "(11) 98888-0001");
  const maria = await usuario("Maria Souza", "maria@demo.com", "(11) 98888-0002");
  const pedro = await usuario("Pedro Lima", "pedro@demo.com", "(11) 98888-0003");
  const guilherme = await usuario("Guilherme Rocha", "guilherme@demo.com", "(11) 98888-0004");
  const iJoao = await intencao(joao, "troca", {
    carro: { marca: "Audi", modelo: "A3", versao: "Sedan Performance 2.0 TFSI", anoModelo: 2021, cor: "branco", km: 38000, valor: 152000, fipe: 155000, placa: "FAB1C23" },
    desejos: [{ marca: "Jeep", modelo: "Compass", cores: ["azul"], anoMin: 2021 }],
    maxPagar: 10000,
    criadoEm: atras(4 * DIA),
  });
  const iMaria = await intencao(maria, "troca", {
    carro: { marca: "Jeep", modelo: "Compass", versao: "Longitude 1.3 T270", anoModelo: 2022, cor: "azul", km: 31000, valor: 139000, fipe: 141000, placa: "GHI4J56" },
    desejos: [{ marca: "Volkswagen", modelo: "Nivus", cores: ["cinza"] }],
    maxPagar: 5000,
    criadoEm: atras(3 * DIA),
  });
  const iPedro = await intencao(pedro, "troca", {
    carro: { marca: "BMW", modelo: "X1", versao: "sDrive20i GP", anoModelo: 2021, cor: "prata", km: 42000, valor: 168000, fipe: 170000, placa: "KLM7N89" },
    desejos: [{ marca: "Audi", modelo: "A3", cores: ["branco"] }],
    maxPagar: 0,
    criadoEm: atras(2 * DIA),
  });
  const iGuilherme = await intencao(guilherme, "troca", {
    carro: { marca: "Volkswagen", modelo: "Nivus", versao: "Highline 200 TSI", anoModelo: 2023, cor: "cinza", km: 18000, valor: 124000, fipe: 126000, placa: "OPQ1R23" },
    desejos: [{ marca: "BMW", modelo: "X1", cores: ["prata"] }],
    maxPagar: 50000,
    criadoEm: atras(1 * DIA),
  });
  await ciranda("CR-7JMP", [iJoao, iMaria, iPedro, iGuilherme], {
    etapa: "proposta",
    criadaHa: 12 * HORA,
    aceitos: [iJoao.id, iMaria.id],
  });

  // 2) Em vistoria na Prime ------------------------------------------------
  const ana = await usuario("Ana Ferreira", "ana@demo.com", "(11) 97777-0001");
  const bruno = await usuario("Bruno Martins", "bruno@demo.com", "(11) 97777-0002");
  const carla = await usuario("Carla Nogueira", "carla@demo.com", "(11) 97777-0003");
  const iAna = await intencao(ana, "troca", {
    carro: { marca: "Toyota", modelo: "Corolla", versao: "XEi 2.0", anoModelo: 2022, cor: "prata", km: 35000, valor: 128000, fipe: 129000, placa: "STU4V56" },
    desejos: [{ marca: "Honda", modelo: "HR-V" }, { marca: "Jeep", modelo: "Compass", anoMin: 2021 }],
    maxPagar: 25000,
    criadoEm: atras(9 * DIA),
  });
  const iBruno = await intencao(bruno, "troca", {
    carro: { marca: "Honda", modelo: "HR-V", versao: "EXL 1.5 Turbo", anoModelo: 2023, cor: "cinza", km: 22000, valor: 145000, fipe: 147000, placa: "WXY7Z89" },
    desejos: [{ marca: "Jeep", modelo: "Renegade", anoMin: 2021 }],
    maxPagar: 0,
    criadoEm: atras(8 * DIA),
  });
  const iCarla = await intencao(carla, "troca", {
    carro: { marca: "Jeep", modelo: "Renegade", versao: "Longitude 1.3 T270", anoModelo: 2022, cor: "branco", km: 40000, valor: 112000, fipe: 114000, placa: "ABD2E34" },
    desejos: [{ marca: "Toyota", modelo: "Corolla", cores: ["prata", "preto"] }],
    maxPagar: 20000,
    criadoEm: atras(7 * DIA),
  });
  await ciranda("CR-3ABC", [iAna, iBruno, iCarla], {
    etapa: "em_avaliacao",
    criadaHa: 3 * DIA,
    loja: prime,
    avaliacoes: { [iAna.id]: { valor: 126000, obs: "Amassado leve na porta traseira direita; valor ajustado." } },
  });

  // 3) Concluídas (histórico para os painéis) -------------------------------
  const diego = await usuario("Diego Ramos", "diego@demo.com", "(11) 96666-0001");
  const elisa = await usuario("Elisa Prado", "elisa@demo.com", "(11) 96666-0002");
  const iDiego = await intencao(diego, "troca", {
    carro: { marca: "Volkswagen", modelo: "Polo", versao: "Highline 200 TSI", anoModelo: 2021, cor: "vermelho", km: 52000, valor: 82000, placa: "FGH5I67" },
    desejos: [{ marca: "Hyundai", modelo: "HB20" }],
    maxPagar: 0,
    criadoEm: atras(30 * DIA),
  });
  const iElisa = await intencao(elisa, "troca", {
    carro: { marca: "Hyundai", modelo: "HB20", versao: "Platinum 1.0 TGDI", anoModelo: 2022, cor: "branco", km: 30000, valor: 78000, placa: "JKL8M90" },
    desejos: [{ marca: "Volkswagen", modelo: "Polo" }],
    maxPagar: 6000,
    criadoEm: atras(28 * DIA),
  });
  await ciranda("CR-9DEP", [iDiego, iElisa], { etapa: "concluida", criadaHa: 25 * DIA, loja: vale });

  const felipe = await usuario("Felipe Costa", "felipe@demo.com", "(11) 95555-0001");
  const gabriela = await usuario("Gabriela Dias", "gabriela@demo.com", "(11) 95555-0002");
  const henrique = await usuario("Henrique Sato", "henrique@demo.com", "(11) 95555-0003");
  const iFelipe = await intencao(felipe, "venda", {
    carro: { marca: "Fiat", modelo: "Toro", versao: "Volcano 2.0 Diesel 4x4", anoModelo: 2022, cor: "preto", km: 48000, valor: 135000, placa: "NOP1Q23" },
    criadoEm: atras(20 * DIA),
  });
  const iGabriela = await intencao(gabriela, "troca", {
    carro: { marca: "Chevrolet", modelo: "Tracker", versao: "Premier 1.2 Turbo", anoModelo: 2023, cor: "branco", km: 15000, valor: 125000, placa: "RST4U56" },
    desejos: [{ marca: "Fiat", modelo: "Toro" }],
    maxPagar: 15000,
    criadoEm: atras(19 * DIA),
  });
  const iHenrique = await intencao(henrique, "compra", {
    desejos: [{ marca: "Chevrolet", modelo: "Tracker", anoMin: 2022 }],
    maxPagar: 130000,
    criadoEm: atras(18 * DIA),
  });
  await ciranda("CR-5FGH", [iFelipe, iGabriela, iHenrique], {
    etapa: "concluida",
    criadaHa: 15 * DIA,
    loja: prime,
    avaliacoes: { [iFelipe.id]: { valor: 133000, obs: "Pneus dianteiros a trocar." } },
  });

  // 4) Cancelada: Mariana recusou o Kicks (ambos seguem na fila) -------------
  const lucas = await usuario("Lucas Pereira", "lucas@demo.com", "(11) 94444-0001");
  const mariana = await usuario("Mariana Alves", "mariana@demo.com", "(11) 94444-0002");
  const iLucas = await intencao(lucas, "troca", {
    carro: { marca: "Nissan", modelo: "Kicks", versao: "Advance 1.6", anoModelo: 2022, cor: "branco", km: 41000, valor: 105000 },
    desejos: [{ marca: "Renault", modelo: "Duster" }],
    maxPagar: 0,
    criadoEm: atras(6 * DIA),
  });
  const iMariana = await intencao(mariana, "troca", {
    carro: { marca: "Renault", modelo: "Duster", versao: "Iconic 1.3 Turbo", anoModelo: 2022, cor: "cinza", km: 37000, valor: 98000 },
    desejos: [{ marca: "Nissan", modelo: "Kicks" }],
    maxPagar: 10000,
    criadoEm: atras(5 * DIA),
  });
  await ciranda("CR-8LMX", [iLucas, iMariana], {
    etapa: "cancelada",
    criadaHa: 4 * DIA,
    recusou: { intencao: iMariana, motivo: "Fui ver o carro e preferi não ficar com câmbio CVT." },
  });

  // 5) Fila: a roda que falta um elo ----------------------------------------
  const rafael = await usuario("Rafael Teixeira", "rafael@demo.com", "(11) 93333-0001");
  const sabrina = await usuario("Sabrina Lopes", "sabrina@demo.com", "(11) 93333-0002");
  const tiago = await usuario("Tiago Mendes", "tiago@demo.com", "(11) 93333-0003");
  const vanessa = await usuario("Vanessa Ribeiro", "vanessa@demo.com", "(11) 93333-0004");
  await intencao(rafael, "troca", {
    carro: { marca: "Toyota", modelo: "Corolla Cross", versao: "XRE 2.0", anoModelo: 2023, cor: "preto", km: 20000, valor: 155000, fipe: 157000 },
    desejos: [{ marca: "Jeep", modelo: "Compass", anoMin: 2021 }],
    maxPagar: 10000,
    criadoEm: atras(2 * DIA),
  });
  await intencao(sabrina, "troca", {
    carro: { marca: "Jeep", modelo: "Compass", versao: "Limited 1.3 T270", anoModelo: 2022, cor: "prata", km: 33000, valor: 142000, fipe: 144000 },
    desejos: [{ marca: "Volkswagen", modelo: "T-Cross", anoMin: 2022 }],
    maxPagar: 10000,
    criadoEm: atras(1 * DIA),
  });
  await intencao(tiago, "compra", {
    desejos: [{ marca: "Honda", modelo: "Civic", anoMin: 2020, kmMax: 70000 }],
    maxPagar: 120000,
    criadoEm: atras(3 * DIA),
  });
  await intencao(vanessa, "venda", {
    carro: { marca: "Chevrolet", modelo: "Onix", versao: "LT 1.0 Turbo", anoModelo: 2020, cor: "prata", km: 61000, valor: 68000, cambio: "manual" },
    criadoEm: atras(5 * DIA),
  });

  // A fila não pode formar nada sozinha (senão a demo do "elo que falta" perde a graça).
  const fila = await prisma.intencao.findMany({
    where: { status: "ativa" },
    include: { veiculo: true, desejos: true, usuario: true, bloqueios: true },
  });
  const teste = casar(fila.map(participante), {
    bloqueios: fila.flatMap((i) => i.bloqueios.map((b) => ({ participanteId: i.id, veiculoId: b.veiculoId }))),
  });
  if (teste.ciclos.length > 0) throw new Error("Seed: a fila de demonstração já forma uma ciranda sozinha.");

  console.log("✅ Pronto. Usuários: admin@demo.com, loja@demo.com, loja2@demo.com, joao@/maria@/pedro@/guilherme@demo.com …");
  console.log("   Senha de todos: demo123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
