import { describe, it, expect } from "vitest";
import {
  alertasJornada,
  atrasoEstimadoDias,
  barreirasPorNatureza,
  desvioPrevisaoDias,
  diasInternacao,
  extrairMencoes,
  jornadaParada,
  previsaoAcertou,
  prontidaoAlta,
  resumoJornada,
  scorePrioridade,
  situacaoDAP,
  validarMudancaEtapa,
  type JornadaLite,
} from "@/lib/jornada";

const AGORA = new Date("2026-03-10T09:00:00");
const DIA = 24 * 3600 * 1000;
const emDias = (n: number) => new Date(AGORA.getTime() + n * DIA);

function jornadaBase(over: Partial<JornadaLite> = {}): JornadaLite {
  return {
    etapa: "tratamento",
    status: "aberta",
    dataAltaPrevista: emDias(2),
    dataAltaPrevistaInicial: emDias(2),
    gestorCasoId: "u1",
    ultimaInteracaoEm: new Date(AGORA.getTime() - 2 * 3600 * 1000),
    criadaEm: emDias(-3),
    dataAdmissao: emDias(-3),
    barreiras: [],
    criterios: [],
    tarefas: [],
    ...over,
  };
}

describe("prontidão para alta", () => {
  it("ignora critérios marcados como não aplicáveis", () => {
    const p = prontidaoAlta([
      { atendido: true, naoAplicavel: false },
      { atendido: false, naoAplicavel: false },
      { atendido: false, naoAplicavel: true },
    ]);
    expect(p.aplicaveis).toBe(2);
    expect(p.atendidos).toBe(1);
    expect(p.percentual).toBe(0.5);
  });

  it("não divide por zero quando não há critérios", () => {
    expect(prontidaoAlta([]).percentual).toBe(0);
    expect(prontidaoAlta(undefined).percentual).toBe(0);
  });
});

describe("data de alta prevista (DAP)", () => {
  it("classifica a situação em relação a hoje", () => {
    expect(situacaoDAP(null, AGORA)).toBe("sem_previsao");
    expect(situacaoDAP(emDias(-1), AGORA)).toBe("vencida");
    expect(situacaoDAP(AGORA, AGORA)).toBe("hoje");
    expect(situacaoDAP(emDias(1), AGORA)).toBe("amanha");
    expect(situacaoDAP(emDias(3), AGORA)).toBe("proximos_dias");
    expect(situacaoDAP(emDias(10), AGORA)).toBe("futura");
  });

  it("mede o desvio entre a primeira previsão e a alta real", () => {
    expect(desvioPrevisaoDias(emDias(0), emDias(3))).toBe(3);
    expect(desvioPrevisaoDias(emDias(0), emDias(-1))).toBe(-1);
    expect(desvioPrevisaoDias(null, emDias(3))).toBeNull();
  });

  it("considera acerto dentro da tolerância de um dia", () => {
    expect(previsaoAcertou(0)).toBe(true);
    expect(previsaoAcertou(1)).toBe(true);
    expect(previsaoAcertou(-1)).toBe(true);
    expect(previsaoAcertou(2)).toBe(false);
    expect(previsaoAcertou(null)).toBe(false);
  });

  it("conta os dias de internação a partir da admissão", () => {
    expect(diasInternacao(emDias(-5), AGORA)).toBe(5);
    expect(diasInternacao(null, AGORA)).toBe(0);
  });
});

describe("barreiras", () => {
  const barreiras = [
    { categoria: "clinica", status: "aberta", bloqueiaAlta: true, impactoDias: 2 },
    { categoria: "transporte", status: "em_andamento", bloqueiaAlta: true, impactoDias: 3 },
    { categoria: "social", status: "resolvida", bloqueiaAlta: true, impactoDias: 5 },
  ];

  it("separa barreiras clínicas das de processo, considerando só as abertas", () => {
    const { clinicas, naoClinicas } = barreirasPorNatureza(barreiras);
    expect(clinicas).toHaveLength(1);
    expect(naoClinicas).toHaveLength(1);
    expect(naoClinicas[0].categoria).toBe("transporte");
  });

  it("estima o atraso pelo maior impacto entre as barreiras abertas", () => {
    expect(atrasoEstimadoDias(barreiras)).toBe(3);
    expect(atrasoEstimadoDias([])).toBe(0);
  });
});

describe("validação de movimentação no funil", () => {
  it("impede efetivar a alta com barreira bloqueante em aberto", () => {
    const j = jornadaBase({
      etapa: "alta_pactuada",
      barreiras: [{ categoria: "domiciliar", status: "aberta", bloqueiaAlta: true }],
      criterios: [{ atendido: true, naoAplicavel: false }],
    });
    const r = validarMudancaEtapa(j, "alta_efetivada", AGORA);
    expect(r.ok).toBe(false);
    expect(r.motivo).toMatch(/bloqueante/i);
  });

  it("permite a alta quando a barreira foi resolvida e os critérios fecham", () => {
    const j = jornadaBase({
      etapa: "alta_pactuada",
      barreiras: [{ categoria: "domiciliar", status: "resolvida", bloqueiaAlta: true }],
      criterios: [
        { atendido: true, naoAplicavel: false },
        { atendido: false, naoAplicavel: true },
      ],
    });
    expect(validarMudancaEtapa(j, "alta_efetivada", AGORA).ok).toBe(true);
  });

  it("não deixa a alta sair com critério pendente", () => {
    const j = jornadaBase({
      etapa: "alta_pactuada",
      criterios: [
        { atendido: true, naoAplicavel: false },
        { atendido: false, naoAplicavel: false },
      ],
    });
    const r = validarMudancaEtapa(j, "alta_efetivada", AGORA);
    expect(r.ok).toBe(false);
    expect(r.motivo).toMatch(/critério/i);
  });

  it("exige data de alta prevista para pactuar a alta", () => {
    const j = jornadaBase({ etapa: "planejamento", dataAltaPrevista: null });
    const r = validarMudancaEtapa(j, "alta_pactuada", AGORA);
    expect(r.ok).toBe(false);
    expect(r.motivo).toMatch(/data de alta prevista/i);
  });

  it("recusa etapa desconhecida, repetida ou jornada encerrada", () => {
    expect(validarMudancaEtapa(jornadaBase(), "inexistente", AGORA).ok).toBe(false);
    expect(validarMudancaEtapa(jornadaBase(), "tratamento", AGORA).ok).toBe(false);
    expect(validarMudancaEtapa(jornadaBase({ status: "concluida" }), "criterios", AGORA).ok).toBe(
      false,
    );
  });
});

describe("alertas da jornada", () => {
  it("aponta paciente pronto travado por barreira não clínica", () => {
    const j = jornadaBase({
      criterios: Array.from({ length: 10 }, (_, i) => ({
        atendido: i < 9,
        naoAplicavel: false,
      })),
      barreiras: [{ categoria: "autorizacao", status: "aberta", bloqueiaAlta: true }],
    });
    const tipos = alertasJornada(j, AGORA).map((a) => a.tipo);
    expect(tipos).toContain("alta_travada_processo");
  });

  it("sinaliza previsão vencida, barreira vencida e caso sem gestor", () => {
    const j = jornadaBase({
      dataAltaPrevista: emDias(-2),
      gestorCasoId: null,
      barreiras: [
        { categoria: "exame", status: "aberta", bloqueiaAlta: true, prazo: emDias(-1) },
      ],
    });
    const alertas = alertasJornada(j, AGORA);
    const tipos = alertas.map((a) => a.tipo);
    expect(tipos).toContain("dap_vencida");
    expect(tipos).toContain("barreira_vencida");
    expect(tipos).toContain("sem_gestor");
    expect(alertas.find((a) => a.tipo === "dap_vencida")?.nivel).toBe("critico");
  });

  it("detecta caso parado e não alerta em jornada encerrada", () => {
    const parada = new Date(AGORA.getTime() - 30 * 3600 * 1000);
    expect(jornadaParada(parada, AGORA)).toBe(true);
    expect(jornadaParada(new Date(AGORA.getTime() - 3 * 3600 * 1000), AGORA)).toBe(false);

    const encerrada = jornadaBase({ status: "concluida", dataAltaPrevista: null });
    expect(alertasJornada(encerrada, AGORA)).toHaveLength(0);
  });
});

describe("priorização do funil", () => {
  it("coloca o caso com previsão vencida e barreira de processo à frente do caso em dia", () => {
    const critico = jornadaBase({
      dataAltaPrevista: emDias(-2),
      barreiras: [
        { categoria: "transporte", status: "aberta", bloqueiaAlta: true, prazo: emDias(-1) },
      ],
    });
    const tranquilo = jornadaBase();
    expect(scorePrioridade(critico, AGORA)).toBeGreaterThan(scorePrioridade(tranquilo, AGORA));
  });

  it("tira do ranking as jornadas encerradas", () => {
    expect(scorePrioridade(jornadaBase({ status: "concluida" }), AGORA)).toBe(-1);
  });
});

describe("menções a disciplinas", () => {
  it("reconhece a chave da disciplina com e sem underscore", () => {
    expect(extrairMencoes("@servico_social confirmar cuidador")).toEqual(["servico_social"]);
    expect(extrairMencoes("pedir avaliação @fisioterapia e @nutricao")).toEqual([
      "fisioterapia",
      "nutricao",
    ]);
    expect(extrairMencoes("chamar @servicosocial")).toEqual(["servico_social"]);
  });

  it("ignora menções que não correspondem a disciplinas e não repete", () => {
    expect(extrairMencoes("@qualquer coisa")).toEqual([]);
    expect(extrairMencoes("@farmacia e de novo @farmacia")).toEqual(["farmacia"]);
  });
});

describe("resumo do caso", () => {
  it("reúne etapa, permanência, previsão, critérios e barreiras", () => {
    const j = jornadaBase({
      criterios: [
        { atendido: true, naoAplicavel: false },
        { atendido: false, naoAplicavel: false },
      ],
      barreiras: [{ categoria: "social", status: "aberta", bloqueiaAlta: true }],
    });
    const texto = resumoJornada(j, AGORA);
    expect(texto).toMatch(/Tratamento/);
    expect(texto).toMatch(/3 dia\(s\) de internação/);
    expect(texto).toMatch(/critérios 1\/2/);
    expect(texto).toMatch(/Social\/cuidador/);
  });
});
