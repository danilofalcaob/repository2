// Dados de demonstração FICTÍCIOS. Nenhum dado real de paciente.
// Roda com: npm run db:seed
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { CRITERIOS_ALTA_PADRAO } from "../src/lib/constants";

const prisma = new PrismaClient();

const HORA = 3600 * 1000;
const DIA = 24 * HORA;

// Data relativa a agora, em dias (negativo = passado), com hora opcional.
function dias(qtd: number, hora?: number): Date {
  const d = new Date(Date.now() + qtd * DIA);
  if (hora !== undefined) d.setHours(hora, 0, 0, 0);
  return d;
}

async function main() {
  console.log("🌱 Populando banco com dados de demonstração (fictícios)...");

  // Limpeza idempotente (ordem respeita as FKs).
  await prisma.interacaoJornada.deleteMany();
  await prisma.tarefaJornada.deleteMany();
  await prisma.barreira.deleteMany();
  await prisma.criterioAlta.deleteMany();
  await prisma.movimentacaoEtapa.deleteMany();
  await prisma.membroEquipe.deleteMany();
  await prisma.jornada.deleteMany();
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
      disciplina: "medicina",
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
      disciplina: "medicina",
      setores: { create: [{ setorId: ps.id }, { setorId: uti.id }, { setorId: enf.id }] },
    },
  });
  const drBruno = await prisma.usuario.create({
    data: {
      nome: "Dr. Bruno Plantonista",
      email: "bruno@demo.com",
      senhaHash,
      registro: "CRM-SP 200001",
      perfil: "plantonista",
      disciplina: "medicina",
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
      disciplina: "medicina",
      setores: { create: [{ setorId: ps.id }, { setorId: uti.id }] },
    },
  });

  // Equipe multiprofissional da enfermaria — o time que compartilha o funil de
  // alta. Todos usam a mesma senha de demonstração.
  const equipeEnfermaria = [
    {
      nome: "Dr. Gustavo Lima",
      email: "gustavo@demo.com",
      registro: "CRM-SP 300001",
      perfil: "plantonista",
      disciplina: "medicina",
    },
    {
      nome: "Enf. Sofia Nunes",
      email: "sofia@demo.com",
      registro: "COREN-SP 400111",
      perfil: "profissional",
      disciplina: "enfermagem",
    },
    {
      nome: "Fisio. Rafael Prado",
      email: "rafael@demo.com",
      registro: "CREFITO-3 55222",
      perfil: "profissional",
      disciplina: "fisioterapia",
    },
    {
      nome: "Marina Alves (Serviço Social)",
      email: "marina@demo.com",
      registro: "CRESS-SP 66333",
      perfil: "profissional",
      disciplina: "servico_social",
    },
    {
      nome: "Farm. Helena Dias",
      email: "helena@demo.com",
      registro: "CRF-SP 77444",
      perfil: "profissional",
      disciplina: "farmacia",
    },
    {
      nome: "Nutri. Camila Rocha",
      email: "camila@demo.com",
      registro: "CRN-3 88555",
      perfil: "profissional",
      disciplina: "nutricao",
    },
    {
      nome: "Paula Nogueira (NIR)",
      email: "paula@demo.com",
      registro: "NIR-001",
      perfil: "profissional",
      disciplina: "gestao_leitos",
    },
  ] as const;

  const equipe: Record<string, { id: string; nome: string }> = {};
  for (const membro of equipeEnfermaria) {
    const criado = await prisma.usuario.create({
      data: {
        nome: membro.nome,
        email: membro.email,
        senhaHash,
        registro: membro.registro,
        perfil: membro.perfil,
        disciplina: membro.disciplina,
        setores: { create: [{ setorId: enf.id }] },
      },
    });
    equipe[membro.disciplina] = { id: criado.id, nome: criado.nome };
  }

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

  // -------------------------------------------------------------------------
  // CRM de deshospitalização: enfermaria clínica com casos em várias etapas do
  // funil, barreiras clínicas e não clínicas, tarefas por disciplina e timeline.
  // -------------------------------------------------------------------------

  type CasoSeed = {
    identificador: string;
    leito: string;
    idade: number;
    sexo: string;
    diagnostico: string;
    alergias?: string;
    admissaoDias: number; // dias atrás
    etapa: string;
    gestorDisciplina?: keyof typeof equipe | null;
    dapDias?: number | null; // dias a partir de hoje
    dapInicialDias?: number | null;
    confianca?: string;
    destino?: string | null;
    complexidade?: string;
    risco?: string;
    criteriosAtendidos: number;
    criteriosNaoAplicaveis?: number[];
    ultimaInteracaoHoras: number;
    equipe?: (keyof typeof equipe)[];
    movimentacoes: { de?: string; para: string; diasAtras: number }[];
    barreiras?: {
      categoria: string;
      descricao: string;
      disciplina: string;
      prioridade?: string;
      bloqueia?: boolean;
      impacto?: number;
      prazoDias?: number;
      status?: string;
      abertaDias: number;
      resolvidaDias?: number;
      resolucao?: string;
    }[];
    tarefas?: {
      titulo: string;
      detalhe?: string;
      disciplina: keyof typeof equipe;
      prazoDias?: number;
      prioridade?: string;
      status?: string;
      concluidaDias?: number;
    }[];
    interacoes: {
      disciplina: keyof typeof equipe | "medicina";
      tipo: string;
      texto: string;
      horasAtras: number;
    }[];
    alta?: { horasAtras: number; hora: number };
  };

  async function criarCaso(caso: CasoSeed) {
    const paciente = await prisma.paciente.create({
      data: {
        setorId: enf.id,
        identificador: caso.identificador,
        leito: caso.leito,
        idade: caso.idade,
        sexo: caso.sexo,
        diagnosticoPrincipal: caso.diagnostico,
        alergias: caso.alergias ?? "Nega",
        dataAdmissao: dias(-caso.admissaoDias, 10),
        status: caso.alta ? "alta" : "ativo",
      },
    });

    const gestor = caso.gestorDisciplina ? equipe[caso.gestorDisciplina] : null;
    const jornada = await prisma.jornada.create({
      data: {
        pacienteId: paciente.id,
        setorId: enf.id,
        etapa: caso.etapa,
        status: caso.alta ? "concluida" : "aberta",
        altaEfetivadaEm: caso.alta ? dias(-caso.alta.horasAtras / 24, caso.alta.hora) : null,
        gestorCasoId: gestor?.id ?? null,
        motivoInternacao: caso.diagnostico,
        dataAltaPrevista: caso.dapDias == null ? null : dias(caso.dapDias, 12),
        dataAltaPrevistaInicial:
          caso.dapInicialDias == null
            ? caso.dapDias == null
              ? null
              : dias(caso.dapDias, 12)
            : dias(caso.dapInicialDias, 12),
        confiancaAlta: caso.confianca ?? "media",
        destinoAlta: caso.destino ?? null,
        complexidade: caso.complexidade ?? "media",
        riscoReinternacao: caso.risco ?? "baixo",
        ultimaInteracaoEm: new Date(Date.now() - caso.ultimaInteracaoHoras * HORA),
        criadaEm: dias(-caso.admissaoDias, 11),
      },
    });

    // Checklist padrão: os primeiros N critérios entram como atendidos, o que
    // aproxima a progressão real (clínicos primeiro, logísticos por último).
    const naoAplicaveis = new Set(caso.criteriosNaoAplicaveis ?? []);
    await prisma.criterioAlta.createMany({
      data: CRITERIOS_ALTA_PADRAO.map((c, i) => ({
        jornadaId: jornada.id,
        categoria: c.categoria,
        descricao: c.descricao,
        ordem: i,
        naoAplicavel: naoAplicaveis.has(i),
        atendido: !naoAplicaveis.has(i) && i < caso.criteriosAtendidos,
        avaliadoPorId: i < caso.criteriosAtendidos ? (gestor?.id ?? admin.id) : null,
        avaliadoEm: i < caso.criteriosAtendidos ? dias(-1, 11) : null,
      })),
    });

    for (const m of caso.movimentacoes) {
      await prisma.movimentacaoEtapa.create({
        data: {
          jornadaId: jornada.id,
          de: m.de ?? null,
          para: m.para,
          usuarioId: gestor?.id ?? admin.id,
          usuarioNome: gestor?.nome ?? admin.nome,
          criadoEm: dias(-m.diasAtras, 9),
        },
      });
    }

    for (const b of caso.barreiras ?? []) {
      const responsavel = equipe[b.disciplina as keyof typeof equipe];
      await prisma.barreira.create({
        data: {
          jornadaId: jornada.id,
          categoria: b.categoria,
          descricao: b.descricao,
          disciplina: b.disciplina,
          responsavelId: responsavel?.id ?? null,
          prioridade: b.prioridade ?? "media",
          bloqueiaAlta: b.bloqueia ?? true,
          impactoDias: b.impacto ?? null,
          prazo: b.prazoDias == null ? null : dias(b.prazoDias, 12),
          status: b.status ?? "aberta",
          abertaEm: dias(-b.abertaDias, 10),
          resolvidaEm: b.resolvidaDias == null ? null : dias(-b.resolvidaDias, 15),
          resolucao: b.resolucao ?? null,
          criadaPorNome: gestor?.nome ?? admin.nome,
        },
      });
    }

    for (const t of caso.tarefas ?? []) {
      const responsavel = equipe[t.disciplina];
      await prisma.tarefaJornada.create({
        data: {
          jornadaId: jornada.id,
          titulo: t.titulo,
          detalhe: t.detalhe ?? null,
          disciplina: t.disciplina as string,
          responsavelId: responsavel?.id ?? null,
          prazo: t.prazoDias == null ? null : dias(t.prazoDias, 12),
          prioridade: t.prioridade ?? "media",
          status: t.status ?? "aberta",
          concluidaEm: t.concluidaDias == null ? null : dias(-t.concluidaDias, 14),
          concluidaPor: t.status === "concluida" ? responsavel?.nome ?? null : null,
        },
      });
    }

    for (const m of caso.equipe ?? []) {
      const membro = equipe[m];
      if (!membro) continue;
      await prisma.membroEquipe.create({
        data: { jornadaId: jornada.id, usuarioId: membro.id, disciplina: m as string },
      });
    }

    for (const i of caso.interacoes) {
      const autor = equipe[i.disciplina as keyof typeof equipe];
      await prisma.interacaoJornada.create({
        data: {
          jornadaId: jornada.id,
          autorId: autor?.id ?? admin.id,
          autorNome: autor?.nome ?? admin.nome,
          disciplina: i.disciplina as string,
          tipo: i.tipo,
          texto: i.texto,
          criadoEm: new Date(Date.now() - i.horasAtras * HORA),
        },
      });
    }

    return { paciente, jornada };
  }

  const casos: CasoSeed[] = [
    {
      identificador: "ENF-0101 (Rosa M.)",
      leito: "201",
      idade: 78,
      sexo: "F",
      diagnostico: "Pneumonia aspirativa",
      admissaoDias: 9,
      etapa: "planejamento",
      gestorDisciplina: "medicina",
      dapDias: -1,
      dapInicialDias: -3,
      confianca: "media",
      destino: "domicilio_apoio",
      complexidade: "alta",
      risco: "alto",
      // Clinicamente pronta: o que a segura no hospital é o processo, não a doença.
      criteriosAtendidos: 13,
      ultimaInteracaoHoras: 5,
      equipe: ["medicina", "enfermagem", "fisioterapia", "servico_social"],
      movimentacoes: [
        { para: "admissao", diasAtras: 9 },
        { de: "admissao", para: "investigacao", diasAtras: 8 },
        { de: "investigacao", para: "tratamento", diasAtras: 6 },
        { de: "tratamento", para: "criterios", diasAtras: 3 },
        { de: "criterios", para: "planejamento", diasAtras: 2 },
      ],
      barreiras: [
        {
          categoria: "domiciliar",
          descricao: "Oxigênio domiciliar: aguardando autorização do convênio para concentrador",
          disciplina: "servico_social",
          prioridade: "alta",
          impacto: 3,
          prazoDias: -1,
          abertaDias: 3,
        },
        {
          categoria: "social",
          descricao: "Filha só consegue receber a mãe a partir de sábado; treinar cuidador",
          disciplina: "servico_social",
          prioridade: "media",
          impacto: 2,
          prazoDias: 1,
          abertaDias: 2,
        },
        {
          categoria: "clinica",
          descricao: "Manter saturação ≥ 92% em ar ambiente por 24h",
          disciplina: "medicina",
          status: "resolvida",
          abertaDias: 6,
          resolvidaDias: 2,
          resolucao: "Saturação estável em AA desde anteontem",
        },
      ],
      tarefas: [
        {
          titulo: "Treinar filha para aspiração e posicionamento na alimentação",
          disciplina: "fonoaudiologia",
          prazoDias: 1,
          prioridade: "alta",
        },
        {
          titulo: "Orientar exercícios respiratórios domiciliares",
          disciplina: "fisioterapia",
          status: "concluida",
          concluidaDias: 1,
        },
        {
          titulo: "Conciliar receitas e checar disponibilidade na UBS",
          disciplina: "farmacia",
          prazoDias: 0,
        },
      ],
      interacoes: [
        {
          disciplina: "medicina",
          tipo: "round",
          texto:
            "Clinicamente pronta há dois dias. Alta depende exclusivamente do O₂ domiciliar. @servico_social acompanhar autorização.",
          horasAtras: 5,
        },
        {
          disciplina: "servico_social",
          tipo: "nota",
          texto: "Convênio pediu novo relatório médico; protocolo reaberto hoje de manhã.",
          horasAtras: 7,
        },
        {
          disciplina: "fisioterapia",
          tipo: "nota",
          texto: "Deambula com apoio, tolera 20 metros. Funcionalidade compatível com domicílio.",
          horasAtras: 26,
        },
      ],
    },
    {
      identificador: "ENF-0102 (Jorge P.)",
      leito: "202",
      idade: 64,
      sexo: "M",
      diagnostico: "Insuficiência cardíaca descompensada",
      admissaoDias: 4,
      etapa: "tratamento",
      gestorDisciplina: "medicina",
      dapDias: 2,
      confianca: "media",
      destino: "domicilio",
      criteriosAtendidos: 5,
      ultimaInteracaoHoras: 3,
      equipe: ["medicina", "enfermagem", "nutricao"],
      movimentacoes: [
        { para: "admissao", diasAtras: 4 },
        { de: "admissao", para: "investigacao", diasAtras: 3 },
        { de: "investigacao", para: "tratamento", diasAtras: 2 },
      ],
      barreiras: [
        {
          categoria: "clinica",
          descricao: "Ainda em diurético EV; meta de peso seco não atingida",
          disciplina: "medicina",
          prioridade: "alta",
          impacto: 2,
          prazoDias: 1,
          abertaDias: 2,
        },
      ],
      tarefas: [
        {
          titulo: "Orientação de dieta hipossódica com a esposa",
          disciplina: "nutricao",
          prazoDias: 1,
        },
        {
          titulo: "Registrar peso diário e balanço hídrico",
          disciplina: "enfermagem",
          prioridade: "alta",
        },
      ],
      interacoes: [
        {
          disciplina: "medicina",
          tipo: "round",
          texto: "Boa resposta ao diurético; se mantiver, converte para VO amanhã e alta em 2 dias.",
          horasAtras: 3,
        },
        {
          disciplina: "enfermagem",
          tipo: "nota",
          texto: "Balanço negativo de 1,2 L nas últimas 24h. Sem dispneia ao repouso.",
          horasAtras: 9,
        },
      ],
    },
    {
      identificador: "ENF-0103 (Célia R.)",
      leito: "203",
      idade: 71,
      sexo: "F",
      diagnostico: "Infecção do trato urinário complicada",
      admissaoDias: 6,
      etapa: "criterios",
      gestorDisciplina: "medicina",
      dapDias: 1,
      confianca: "alta",
      destino: "domicilio",
      criteriosAtendidos: 9,
      ultimaInteracaoHoras: 2,
      equipe: ["medicina", "enfermagem", "farmacia"],
      movimentacoes: [
        { para: "admissao", diasAtras: 6 },
        { de: "admissao", para: "tratamento", diasAtras: 5 },
        { de: "tratamento", para: "criterios", diasAtras: 1 },
      ],
      barreiras: [
        {
          categoria: "medicamento",
          descricao: "Converter ceftriaxona EV para antibiótico oral conforme antibiograma",
          disciplina: "farmacia",
          prioridade: "alta",
          impacto: 1,
          prazoDias: 0,
          abertaDias: 1,
        },
      ],
      tarefas: [
        {
          titulo: "Checar antibiograma e sugerir esquema oral",
          disciplina: "farmacia",
          prazoDias: 0,
          prioridade: "alta",
        },
        { titulo: "Retirar acesso venoso após conversão", disciplina: "enfermagem", prazoDias: 1 },
      ],
      interacoes: [
        {
          disciplina: "farmacia",
          tipo: "nota",
          texto: "Antibiograma sensível a ciprofloxacino; sugerido esquema oral por mais 4 dias.",
          horasAtras: 2,
        },
        {
          disciplina: "medicina",
          tipo: "round",
          texto: "Afebril há 48h. Se tolerar VO hoje, alta amanhã pela manhã.",
          horasAtras: 6,
        },
      ],
    },
    {
      identificador: "ENF-0104 (Marcos T.)",
      leito: "204",
      idade: 55,
      sexo: "M",
      diagnostico: "Pancreatite aguda leve",
      admissaoDias: 3,
      etapa: "investigacao",
      gestorDisciplina: "medicina",
      dapDias: null,
      confianca: "baixa",
      criteriosAtendidos: 3,
      ultimaInteracaoHoras: 12,
      equipe: ["medicina", "nutricao"],
      movimentacoes: [
        { para: "admissao", diasAtras: 3 },
        { de: "admissao", para: "investigacao", diasAtras: 2 },
      ],
      barreiras: [
        {
          categoria: "exame",
          descricao: "Ultrassom de abdome para investigar litíase — fila do setor de imagem",
          disciplina: "medicina",
          prioridade: "alta",
          impacto: 2,
          prazoDias: 1,
          abertaDias: 2,
        },
      ],
      tarefas: [
        { titulo: "Progredir dieta conforme tolerância", disciplina: "nutricao", prazoDias: 1 },
      ],
      interacoes: [
        {
          disciplina: "medicina",
          tipo: "nota",
          texto:
            "Dor em melhora, amilase caindo. Sem previsão de alta até definir se há indicação cirúrgica.",
          horasAtras: 12,
        },
      ],
    },
    {
      identificador: "ENF-0105 (Ivone G.)",
      leito: "205",
      idade: 83,
      sexo: "F",
      diagnostico: "Pós-operatório de fratura de fêmur",
      admissaoDias: 12,
      etapa: "planejamento",
      gestorDisciplina: "gestao_leitos",
      dapDias: 4,
      dapInicialDias: -2,
      confianca: "baixa",
      destino: "retaguarda",
      complexidade: "alta",
      risco: "alto",
      criteriosAtendidos: 13,
      criteriosNaoAplicaveis: [7],
      ultimaInteracaoHoras: 31,
      equipe: ["medicina", "fisioterapia", "servico_social", "gestao_leitos"],
      movimentacoes: [
        { para: "admissao", diasAtras: 12 },
        { de: "admissao", para: "tratamento", diasAtras: 11 },
        { de: "tratamento", para: "criterios", diasAtras: 6 },
        { de: "criterios", para: "planejamento", diasAtras: 5 },
      ],
      barreiras: [
        {
          categoria: "vaga_externa",
          descricao: "Aguardando vaga em hospital de retaguarda para reabilitação",
          disciplina: "gestao_leitos",
          prioridade: "alta",
          impacto: 5,
          prazoDias: -2,
          abertaDias: 5,
        },
        {
          categoria: "transporte",
          descricao: "Remoção em ambulância a combinar após confirmação da vaga",
          disciplina: "servico_social",
          prioridade: "media",
          bloqueia: true,
          impacto: 1,
          abertaDias: 4,
        },
        {
          categoria: "reabilitacao",
          descricao: "Transferência leito-cadeira ainda dependente de duas pessoas",
          disciplina: "fisioterapia",
          prioridade: "media",
          bloqueia: false,
          abertaDias: 6,
        },
      ],
      tarefas: [
        {
          titulo: "Reenviar relatório para a central de regulação",
          disciplina: "gestao_leitos",
          prazoDias: -1,
          prioridade: "alta",
        },
        {
          titulo: "Manter treino de transferência 2x/dia",
          disciplina: "fisioterapia",
          prioridade: "media",
        },
      ],
      interacoes: [
        {
          disciplina: "gestao_leitos",
          tipo: "nota",
          texto: "Central de regulação sem vaga até o momento; caso segue priorizado na fila.",
          horasAtras: 31,
        },
        {
          disciplina: "fisioterapia",
          tipo: "round",
          texto: "Ganho funcional lento, mas consistente. Sem intercorrências na reabilitação.",
          horasAtras: 54,
        },
      ],
    },
    {
      identificador: "ENF-0106 (Sérgio A.)",
      leito: "206",
      idade: 47,
      sexo: "M",
      diagnostico: "Celulite de membro inferior",
      admissaoDias: 2,
      etapa: "tratamento",
      gestorDisciplina: "medicina",
      dapDias: 2,
      confianca: "alta",
      destino: "domicilio",
      complexidade: "baixa",
      criteriosAtendidos: 6,
      ultimaInteracaoHoras: 4,
      equipe: ["medicina", "enfermagem"],
      movimentacoes: [
        { para: "admissao", diasAtras: 2 },
        { de: "admissao", para: "tratamento", diasAtras: 1 },
      ],
      barreiras: [
        {
          categoria: "clinica",
          descricao: "Completar 48h de antibiótico EV com redução do eritema",
          disciplina: "medicina",
          prioridade: "media",
          impacto: 1,
          prazoDias: 1,
          abertaDias: 1,
        },
      ],
      tarefas: [
        { titulo: "Marcar limites do eritema e fotografar diariamente", disciplina: "enfermagem" },
      ],
      interacoes: [
        {
          disciplina: "medicina",
          tipo: "round",
          texto: "Eritema regredindo, afebril. Previsão mantida para depois de amanhã.",
          horasAtras: 4,
        },
      ],
    },
    {
      identificador: "ENF-0107 (Lurdes F.)",
      leito: "207",
      idade: 88,
      sexo: "F",
      diagnostico: "Delirium hipoativo e desidratação",
      admissaoDias: 7,
      etapa: "criterios",
      gestorDisciplina: "enfermagem",
      dapDias: 0,
      dapInicialDias: -1,
      confianca: "baixa",
      destino: "domicilio_apoio",
      complexidade: "alta",
      risco: "alto",
      criteriosAtendidos: 10,
      ultimaInteracaoHoras: 8,
      equipe: ["medicina", "enfermagem", "servico_social", "nutricao"],
      movimentacoes: [
        { para: "admissao", diasAtras: 7 },
        { de: "admissao", para: "tratamento", diasAtras: 6 },
        { de: "tratamento", para: "criterios", diasAtras: 2 },
      ],
      barreiras: [
        {
          categoria: "social",
          descricao: "Família não localizada; paciente mora sozinha e não tem cuidador definido",
          disciplina: "servico_social",
          prioridade: "alta",
          impacto: 4,
          prazoDias: 0,
          abertaDias: 4,
        },
        {
          categoria: "documentacao",
          descricao: "Relatório social e encaminhamento à rede de assistência do município",
          disciplina: "servico_social",
          prioridade: "media",
          bloqueia: false,
          abertaDias: 2,
        },
      ],
      tarefas: [
        {
          titulo: "Contatar vizinha indicada no prontuário e o CRAS da região",
          disciplina: "servico_social",
          prazoDias: 0,
          prioridade: "alta",
        },
        {
          titulo: "Manter protocolo de prevenção de delirium no plantão noturno",
          disciplina: "enfermagem",
          prioridade: "alta",
        },
      ],
      interacoes: [
        {
          disciplina: "servico_social",
          tipo: "familia",
          texto:
            "Três tentativas de contato sem sucesso. Acionado CRAS para busca ativa da rede de apoio.",
          horasAtras: 8,
        },
        {
          disciplina: "enfermagem",
          tipo: "round",
          texto: "Orientada no tempo e espaço desde ontem; aceitando dieta e hidratação oral.",
          horasAtras: 10,
        },
      ],
    },
    {
      identificador: "ENF-0108 (Tiago B.)",
      leito: "208",
      idade: 33,
      sexo: "M",
      diagnostico: "Primeira crise convulsiva a esclarecer",
      admissaoDias: 1,
      etapa: "admissao",
      gestorDisciplina: null,
      dapDias: null,
      confianca: "baixa",
      criteriosAtendidos: 2,
      ultimaInteracaoHoras: 20,
      equipe: ["medicina"],
      movimentacoes: [{ para: "admissao", diasAtras: 1 }],
      barreiras: [
        {
          categoria: "exame",
          descricao: "Eletroencefalograma e ressonância de crânio a agendar",
          disciplina: "medicina",
          prioridade: "alta",
          impacto: 2,
          abertaDias: 1,
        },
      ],
      interacoes: [
        {
          disciplina: "medicina",
          tipo: "nota",
          texto: "Admitido na enfermaria para investigação. Ainda sem gestor de caso definido.",
          horasAtras: 20,
        },
      ],
    },
    // Altas já concluídas — alimentam acurácia da previsão e permanência média.
    {
      identificador: "ENF-0091 (Alberto S.)",
      leito: "209",
      idade: 59,
      sexo: "M",
      diagnostico: "Pneumonia comunitária",
      admissaoDias: 7,
      etapa: "alta_efetivada",
      gestorDisciplina: "medicina",
      dapDias: -2,
      dapInicialDias: -2,
      confianca: "alta",
      destino: "domicilio",
      criteriosAtendidos: 15,
      ultimaInteracaoHoras: 48,
      equipe: ["medicina", "enfermagem"],
      movimentacoes: [
        { para: "admissao", diasAtras: 7 },
        { de: "admissao", para: "tratamento", diasAtras: 6 },
        { de: "tratamento", para: "criterios", diasAtras: 4 },
        { de: "criterios", para: "alta_pactuada", diasAtras: 3 },
        { de: "alta_pactuada", para: "alta_efetivada", diasAtras: 2 },
      ],
      barreiras: [
        {
          categoria: "clinica",
          descricao: "Sem O₂ suplementar por 24h",
          disciplina: "medicina",
          status: "resolvida",
          abertaDias: 5,
          resolvidaDias: 3,
          resolucao: "Saturação estável em ar ambiente",
        },
      ],
      interacoes: [
        {
          disciplina: "medicina",
          tipo: "alta",
          texto: "Alta às 10h com receita, relatório e retorno ambulatorial em 7 dias.",
          horasAtras: 48,
        },
      ],
      alta: { horasAtras: 48, hora: 10 },
    },
    {
      identificador: "ENF-0092 (Neide C.)",
      leito: "210",
      idade: 76,
      sexo: "F",
      diagnostico: "Erisipela com descompensação de diabetes",
      admissaoDias: 13,
      etapa: "alta_efetivada",
      gestorDisciplina: "medicina",
      dapDias: -4,
      dapInicialDias: -7,
      confianca: "media",
      destino: "domicilio_apoio",
      complexidade: "alta",
      criteriosAtendidos: 15,
      ultimaInteracaoHoras: 96,
      equipe: ["medicina", "enfermagem", "servico_social"],
      movimentacoes: [
        { para: "admissao", diasAtras: 13 },
        { de: "admissao", para: "tratamento", diasAtras: 12 },
        { de: "tratamento", para: "criterios", diasAtras: 8 },
        { de: "criterios", para: "planejamento", diasAtras: 7 },
        { de: "planejamento", para: "alta_pactuada", diasAtras: 5 },
        { de: "alta_pactuada", para: "alta_efetivada", diasAtras: 4 },
      ],
      barreiras: [
        {
          categoria: "domiciliar",
          descricao: "Curativo especial e material para troca domiciliar",
          disciplina: "enfermagem",
          status: "resolvida",
          impacto: 3,
          abertaDias: 8,
          resolvidaDias: 5,
          resolucao: "Material garantido pela farmácia da unidade básica",
        },
        {
          categoria: "social",
          descricao: "Cuidador treinado para curativo e aplicação de insulina",
          disciplina: "servico_social",
          status: "resolvida",
          impacto: 2,
          abertaDias: 7,
          resolvidaDias: 4,
          resolucao: "Sobrinha treinada pela enfermagem",
        },
      ],
      interacoes: [
        {
          disciplina: "servico_social",
          tipo: "alta",
          texto: "Alta às 15h após treinamento da cuidadora e garantia do material de curativo.",
          horasAtras: 96,
        },
      ],
      alta: { horasAtras: 96, hora: 15 },
    },
    {
      identificador: "ENF-0093 (Valdir O.)",
      leito: "211",
      idade: 68,
      sexo: "M",
      diagnostico: "Fibrilação atrial de alta resposta",
      admissaoDias: 5,
      etapa: "alta_efetivada",
      gestorDisciplina: "medicina",
      dapDias: -1,
      dapInicialDias: 0,
      confianca: "alta",
      destino: "domicilio",
      criteriosAtendidos: 15,
      ultimaInteracaoHoras: 24,
      equipe: ["medicina", "farmacia"],
      movimentacoes: [
        { para: "admissao", diasAtras: 5 },
        { de: "admissao", para: "tratamento", diasAtras: 4 },
        { de: "tratamento", para: "criterios", diasAtras: 2 },
        { de: "criterios", para: "alta_pactuada", diasAtras: 2 },
        { de: "alta_pactuada", para: "alta_efetivada", diasAtras: 1 },
      ],
      barreiras: [
        {
          categoria: "medicamento",
          descricao: "Início de anticoagulação com orientação de uso",
          disciplina: "farmacia",
          status: "resolvida",
          abertaDias: 3,
          resolvidaDias: 1,
          resolucao: "Orientação feita com material impresso e teste de compreensão",
        },
      ],
      interacoes: [
        {
          disciplina: "farmacia",
          tipo: "alta",
          texto: "Alta às 11h com anticoagulante conciliado e retorno em 15 dias.",
          horasAtras: 24,
        },
      ],
      alta: { horasAtras: 24, hora: 11 },
    },
  ];

  for (const caso of casos) await criarCaso(caso);

  await prisma.logAuditoria.create({
    data: {
      usuarioId: admin.id,
      acao: "seed.executado",
      detalhe: "Carga de dados de demonstração fictícios.",
    },
  });

  console.log("✅ Seed concluído.");
  console.log("\nUsuários de demonstração (senha: demo123):");
  console.log("  admin@demo.com     → Administrador (medicina)");
  console.log("  coord@demo.com     → Coordenador (medicina)");
  console.log("  bruno@demo.com     → Plantonista (medicina)");
  console.log("  daniela@demo.com   → Plantonista (medicina)");
  console.log("\nEquipe multiprofissional da Enfermaria Clínica (CRM de alta):");
  console.log("  gustavo@demo.com   → Medicina (diarista / gestor de casos)");
  console.log("  sofia@demo.com     → Enfermagem");
  console.log("  rafael@demo.com    → Fisioterapia");
  console.log("  marina@demo.com    → Serviço Social");
  console.log("  helena@demo.com    → Farmácia");
  console.log("  camila@demo.com    → Nutrição");
  console.log("  paula@demo.com     → Gestão de Leitos / NIR");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
