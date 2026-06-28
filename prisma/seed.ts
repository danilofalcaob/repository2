// Dados de demonstração FICTÍCIOS. Nenhum dado real de paciente.
// Roda com: npm run db:seed
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Populando banco com dados de demonstração (fictícios)...");

  // Limpeza idempotente (ordem respeita as FKs).
  await prisma.logAuditoria.deleteMany();
  await prisma.reconhecimento.deleteMany();
  await prisma.snapshotVersao.deleteMany();
  await prisma.snapshotPaciente.deleteMany();
  await prisma.eventoTRR.deleteMany();
  await prisma.contingencia.deleteMany();
  await prisma.pendencia.deleteMany();
  await prisma.passagemEvento.deleteMany();
  await prisma.paciente.deleteMany();
  await prisma.turno.deleteMany();
  await prisma.usuarioSetor.deleteMany();
  await prisma.sessao.deleteMany();
  await prisma.usuario.deleteMany();
  await prisma.setor.deleteMany();

  const senhaHash = await bcrypt.hash("demo123", 12);

  // Setores
  const ps = await prisma.setor.create({
    data: { nome: "Pronto-Socorro Adulto", tipo: "PS", instituicao: "Hospital Demonstração" },
  });
  const uti = await prisma.setor.create({
    data: { nome: "UTI Geral", tipo: "UTI", instituicao: "Hospital Demonstração" },
  });
  const enf = await prisma.setor.create({
    data: { nome: "Enfermaria Clínica", tipo: "enfermaria", instituicao: "Hospital Demonstração" },
  });

  // Usuários
  const admin = await prisma.usuario.create({
    data: {
      nome: "Dra. Ana Coordenadora",
      email: "admin@demo.com",
      senhaHash,
      registro: "CRM-SP 100000",
      perfil: "admin",
      setores: { create: [{ setorId: ps.id }, { setorId: uti.id }, { setorId: enf.id }] },
    },
  });
  const coord = await prisma.usuario.create({
    data: {
      nome: "Dr. Carlos Coordenador",
      email: "coord@demo.com",
      senhaHash,
      registro: "CRM-SP 100001",
      perfil: "coordenador",
      setores: { create: [{ setorId: ps.id }, { setorId: uti.id }] },
    },
  });
  const drBruno = await prisma.usuario.create({
    data: {
      nome: "Dr. Bruno Plantonista",
      email: "bruno@demo.com",
      senhaHash,
      registro: "CRM-SP 200001",
      perfil: "plantonista",
      setores: { create: [{ setorId: ps.id }, { setorId: uti.id }] },
    },
  });
  const draDaniela = await prisma.usuario.create({
    data: {
      nome: "Dra. Daniela Plantonista",
      email: "daniela@demo.com",
      senhaHash,
      registro: "CRM-SP 200002",
      perfil: "plantonista",
      setores: { create: [{ setorId: ps.id }, { setorId: uti.id }] },
    },
  });

  // Turnos (diurno que sai, noturno que entra)
  const hoje = new Date();
  const inicioDiurno = new Date(hoje);
  inicioDiurno.setHours(7, 0, 0, 0);
  const fimDiurno = new Date(hoje);
  fimDiurno.setHours(19, 0, 0, 0);

  const turnoDiurno = await prisma.turno.create({
    data: {
      setorId: ps.id,
      tipo: "diurno",
      rotulo: "Plantão Diurno 07h-19h",
      inicio: inicioDiurno,
      fim: fimDiurno,
      responsavelId: drBruno.id,
    },
  });
  const turnoNoturno = await prisma.turno.create({
    data: {
      setorId: ps.id,
      tipo: "noturno",
      rotulo: "Plantão Noturno 19h-07h",
      inicio: fimDiurno,
      responsavelId: draDaniela.id,
    },
  });

  // Pacientes (fictícios) no PS
  const p1 = await prisma.paciente.create({
    data: {
      setorId: ps.id,
      identificador: "PAC-0001 (João S.)",
      leito: "B-12",
      idade: 67,
      sexo: "M",
      diagnosticoPrincipal: "IAM sem supra de ST",
      alergias: "Dipirona",
      status: "ativo",
    },
  });
  const p2 = await prisma.paciente.create({
    data: {
      setorId: ps.id,
      identificador: "PAC-0002 (Maria O.)",
      leito: "B-07",
      idade: 54,
      sexo: "F",
      diagnosticoPrincipal: "Pneumonia comunitária",
      alergias: "Nega",
      status: "ativo",
    },
  });
  const p3 = await prisma.paciente.create({
    data: {
      setorId: ps.id,
      identificador: "PAC-0003 (Pedro L.)",
      leito: "Sala Vermelha 1",
      idade: 72,
      sexo: "M",
      diagnosticoPrincipal: "Sepse de foco urinário",
      alergias: "Penicilina",
      status: "ativo",
    },
  });
  const p4 = await prisma.paciente.create({
    data: {
      setorId: ps.id,
      identificador: "PAC-0004 (Lucia F.)",
      leito: "B-03",
      idade: 38,
      sexo: "F",
      diagnosticoPrincipal: "Crise asmática",
      alergias: "Nega",
      status: "ativo",
    },
  });
  // UTI
  const p5 = await prisma.paciente.create({
    data: {
      setorId: uti.id,
      identificador: "PAC-0005 (Antônio R.)",
      leito: "UTI-04",
      idade: 60,
      sexo: "M",
      diagnosticoPrincipal: "Choque séptico, VM",
      alergias: "Nega",
      status: "ativo",
    },
  });

  // Pendências
  await prisma.pendencia.createMany({
    data: [
      {
        pacienteId: p1.id,
        descricao: "Reavaliar troponina às 02:00 e comparar curva",
        responsavel: "Plantonista noturno",
        prioridade: "alta",
        status: "aberta",
        prazo: new Date(Date.now() + 4 * 3600 * 1000),
      },
      {
        pacienteId: p1.id,
        descricao: "Contatar hemodinâmica pela manhã",
        responsavel: "Dr. Bruno",
        prioridade: "media",
        status: "aberta",
        prazo: new Date(Date.now() + 12 * 3600 * 1000),
      },
      {
        pacienteId: p3.id,
        descricao: "Coletar lactato de controle (vencida)",
        responsavel: "Equipe",
        prioridade: "alta",
        status: "aberta",
        prazo: new Date(Date.now() - 2 * 3600 * 1000),
        herdada: true,
        criadaEm: new Date(Date.now() - 14 * 3600 * 1000),
      },
      {
        pacienteId: p2.id,
        descricao: "Solicitar cultura de escarro",
        responsavel: "Dra. Daniela",
        prioridade: "baixa",
        status: "concluida",
        concluidaEm: new Date(),
      },
    ],
  });

  // Contingências estruturadas
  await prisma.contingencia.createMany({
    data: [
      {
        pacienteId: p1.id,
        parametro: "Dor torácica",
        limiar: "recorrência ou EAP",
        acao: "ECG imediato, repetir troponina e acionar plantonista",
        prioridade: "alta",
        status: "ativa",
      },
      {
        pacienteId: p3.id,
        parametro: "PAM",
        limiar: "< 65 mmHg",
        acao: "Expandir volume e considerar noradrenalina; chamar a UTI",
        prioridade: "alta",
        status: "ativa",
      },
      {
        pacienteId: p4.id,
        parametro: "SatO₂",
        limiar: "< 90% em ar ambiente",
        acao: "Iniciar O₂, nebulização contínua e reavaliar gasometria",
        prioridade: "media",
        status: "ativa",
      },
      {
        pacienteId: p5.id,
        parametro: "Lactato",
        limiar: "> 4 mmol/L",
        acao: "Reavaliar ressuscitação e foco infeccioso; comunicar diarista",
        prioridade: "alta",
        status: "ativa",
        lembreteEm: new Date(Date.now() + 3 * 3600 * 1000),
      },
    ],
  });

  // Uma passagem CONCLUÍDA do dia anterior (para histórico/indicadores)
  const ontem = new Date(Date.now() - 24 * 3600 * 1000);
  const ontemFim = new Date(ontem.getTime() + 18 * 60 * 1000); // 18 min
  const passagemAnterior = await prisma.passagemEvento.create({
    data: {
      setorId: ps.id,
      turnoSaiId: turnoNoturno.id,
      turnoEntraId: turnoDiurno.id,
      medicoPassaId: draDaniela.id,
      medicoRecebeId: drBruno.id,
      inicioEm: ontem,
      concluidaEm: ontemFim,
      status: "concluida",
      duracaoSeg: 18 * 60,
    },
  });

  const snapsAnteriores = [
    {
      pacienteId: p1.id,
      gravidade: "cuidado",
      resumoPaciente: "IAM SSST, dor controlada, aguardando estratificação.",
      nivelPreocupacao: "medio",
      oQueMePreocupa: "Curva de troponina ainda ascendente.",
    },
    {
      pacienteId: p2.id,
      gravidade: "estavel",
      resumoPaciente: "Pneumonia em ATB, boa resposta, sem desconforto.",
      nivelPreocupacao: "baixo",
    },
    {
      pacienteId: p3.id,
      gravidade: "instavel",
      resumoPaciente: "Sepse urinária, hipotenso responsivo a volume.",
      nivelPreocupacao: "alto",
      oQueMePreocupa: "Pode evoluir para choque; vigiar PAM e lactato.",
    },
  ];

  for (const s of snapsAnteriores) {
    const snap = await prisma.snapshotPaciente.create({
      data: {
        passagemId: passagemAnterior.id,
        pacienteId: s.pacienteId,
        gravidade: s.gravidade,
        resumoPaciente: s.resumoPaciente,
        nivelPreocupacao: s.nivelPreocupacao,
        oQueMePreocupa: s.oQueMePreocupa,
        sinteseReceptor: "Ciente. Plano mantido.",
        reconhecido: true,
        imutavel: true,
        versao: 1,
      },
    });
    await prisma.snapshotVersao.create({
      data: { snapshotId: snap.id, versao: 1, dadosJson: JSON.stringify(s) },
    });
    await prisma.reconhecimento.create({
      data: {
        passagemId: passagemAnterior.id,
        usuarioId: drBruno.id,
        tipo: "snapshot",
        referenciaId: snap.id,
      },
    });
  }

  // Evento TRR (deterioração) com contexto de passagem prévia
  await prisma.eventoTRR.create({
    data: {
      pacienteId: p3.id,
      criterio: "Hipotensão sustentada (PAS < 90) + rebaixamento",
      equipe: "TRR Plantão A",
      desfecho: "Transferido para UTI",
      passagemId: passagemAnterior.id,
      tinhaContingencia: true,
      tinhaPreocupacao: true,
      ocorridoEm: new Date(Date.now() - 20 * 3600 * 1000),
    },
  });

  await prisma.logAuditoria.create({
    data: {
      usuarioId: admin.id,
      acao: "seed.executado",
      detalhe: "Carga de dados de demonstração fictícios.",
    },
  });

  console.log("✅ Seed concluído.");
  console.log("\nUsuários de demonstração (senha: demo123):");
  console.log("  admin@demo.com     → Administrador");
  console.log("  coord@demo.com     → Coordenador");
  console.log("  bruno@demo.com     → Plantonista");
  console.log("  daniela@demo.com   → Plantonista");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
