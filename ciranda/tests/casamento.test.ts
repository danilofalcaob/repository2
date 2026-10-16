import { describe, it, expect } from "vitest";
import { casar, atendeDesejo, pontuarCiclo } from "@/lib/casamento";
import type { DesejoCasamento, Participante, VeiculoOferta } from "@/lib/casamento";

let seq = 0;
function carro(marca: string, modelo: string, cor: string, valor: number, extra: Partial<VeiculoOferta> = {}): VeiculoOferta {
  return { id: `v${++seq}`, marca, modelo, cor, valor, ano: 2022, km: 30000, cambio: "automatico", ...extra };
}
function quer(marca: string, modelo: string | null, cores: string[] = [], extra: Partial<DesejoCasamento> = {}): DesejoCasamento {
  return { ordem: 1, marca, modelo, cores, anoMin: null, kmMax: null, cambio: null, ...extra };
}
function troca(id: string, veiculo: VeiculoOferta, desejos: DesejoCasamento[], maxPagar = 100000, cidade = "São Paulo"): Participante {
  return { id, tipo: "troca", cidade, veiculo, desejos: desejos.map((d, i) => ({ ...d, ordem: d.ordem ?? i + 1 })), maxPagar };
}

// O exemplo que originou o app.
function exemploOriginal() {
  const a3 = carro("Audi", "A3", "branco", 152000);
  const compass = carro("Jeep", "Compass", "azul", 139000);
  const nivus = carro("Volkswagen", "Nivus", "cinza", 124000);
  const x1 = carro("BMW", "X1", "prata", 168000);
  return {
    carros: { a3, compass, nivus, x1 },
    participantes: [
      troca("joao", a3, [quer("Jeep", "Compass", ["azul"])]),
      troca("maria", compass, [quer("Volkswagen", "Nivus", ["cinza"])]),
      troca("pedro", x1, [quer("Audi", "A3", ["branco"])]),
      troca("guilherme", nivus, [quer("BMW", "X1", ["prata"])]),
    ],
  };
}

describe("casamento — o exemplo original (João, Maria, Pedro, Guilherme)", () => {
  it("fecha uma única ciranda com os quatro", () => {
    const { participantes } = exemploOriginal();
    const r = casar(participantes);
    expect(r.ciclos).toHaveLength(1);
    expect(r.ciclos[0].elos.map((e) => e.participanteId).sort()).toEqual(["guilherme", "joao", "maria", "pedro"]);
    expect(r.naoAtendidos).toEqual([]);
  });

  it("cada um recebe exatamente o carro que queria, e todo carro muda de dono", () => {
    const { participantes, carros } = exemploOriginal();
    const elos = casar(participantes).ciclos[0].elos;
    const recebe = Object.fromEntries(elos.map((e) => [e.participanteId, e.veiculoRecebidoId]));
    expect(recebe).toEqual({
      joao: carros.compass.id,
      maria: carros.nivus.id,
      pedro: carros.a3.id,
      guilherme: carros.x1.id,
    });
    const entregues = elos.map((e) => e.veiculoEntregueId).sort();
    const recebidos = elos.map((e) => e.veiculoRecebidoId).sort();
    expect(recebidos).toEqual(entregues);
  });

  it("a soma dos trocos é zero (o dinheiro só circula entre os participantes)", () => {
    const elos = casar(exemploOriginal().participantes).ciclos[0].elos;
    expect(elos.reduce((s, e) => s + e.diferenca, 0)).toBe(0);
    const guilherme = elos.find((e) => e.participanteId === "guilherme")!;
    expect(guilherme.diferenca).toBe(168000 - 124000); // paga a diferença para subir para a X1
  });

  it("não fecha se alguém não aceita pagar o troco necessário", () => {
    const { participantes } = exemploOriginal();
    participantes[3].maxPagar = 20000; // Guilherme precisaria pagar R$ 44 mil
    const r = casar(participantes);
    expect(r.ciclos).toHaveLength(0);
    expect(r.naoAtendidos).toHaveLength(4);
  });

  it("respeita o tamanho máximo da ciranda", () => {
    expect(casar(exemploOriginal().participantes, { maxTamanho: 3 }).ciclos).toHaveLength(0);
  });

  it("não propõe de novo um carro que o participante já recusou", () => {
    const { participantes, carros } = exemploOriginal();
    const r = casar(participantes, { bloqueios: [{ participanteId: "joao", veiculoId: carros.compass.id }] });
    expect(r.ciclos).toHaveLength(0);
  });

  it("não mistura cidades", () => {
    const { participantes } = exemploOriginal();
    participantes[2].cidade = "Campinas";
    expect(casar(participantes).ciclos).toHaveLength(0);
  });
});

describe("casamento — filtros do desejo", () => {
  const v = carro("Jeep", "Compass", "Azul", 139000, { ano: 2021, km: 45000, cambio: "automatico" });

  it("compara sem acento/caixa e aceita cor no feminino", () => {
    expect(atendeDesejo(quer("JEEP", "compass", ["azul"]), v)).toBe(true);
    const branca = carro("Audi", "A3", "Branca", 1);
    expect(atendeDesejo(quer("Audi", "A3", ["branco"]), branca)).toBe(true);
  });

  it("modelo em branco aceita qualquer modelo da marca; prefixo por palavra inteira", () => {
    expect(atendeDesejo(quer("Jeep", null), v)).toBe(true);
    expect(atendeDesejo(quer("Audi", "A3"), carro("Audi", "A3 Sedan", "preto", 1))).toBe(true);
    expect(atendeDesejo(quer("Hyundai", "HB20"), carro("Hyundai", "HB20S", "preto", 1))).toBe(false);
  });

  it("aplica ano mínimo, km máximo, câmbio e cores", () => {
    expect(atendeDesejo(quer("Jeep", "Compass", [], { anoMin: 2022 }), v)).toBe(false);
    expect(atendeDesejo(quer("Jeep", "Compass", [], { kmMax: 40000 }), v)).toBe(false);
    expect(atendeDesejo(quer("Jeep", "Compass", [], { cambio: "manual" }), v)).toBe(false);
    expect(atendeDesejo(quer("Jeep", "Compass", ["preto", "prata"]), v)).toBe(false);
    expect(atendeDesejo(quer("Jeep", "Compass", ["preto", "azul"], { anoMin: 2020, kmMax: 50000 }), v)).toBe(true);
  });
});

describe("casamento — escolha entre ciranda(s) possíveis", () => {
  it("troca direta entre dois", () => {
    const a = carro("Fiat", "Pulse", "branco", 100000);
    const b = carro("Renault", "Duster", "preto", 105000);
    const r = casar([troca("a", a, [quer("Renault", "Duster")]), troca("b", b, [quer("Fiat", "Pulse")])]);
    expect(r.ciclos).toHaveLength(1);
    expect(r.ciclos[0].elos).toHaveLength(2);
  });

  it("maximiza o número de pessoas atendidas, mesmo que o ciclo seja mais longo", () => {
    // a↔b fecharia uma troca direta, mas o ciclo a→b→c→a atende três pessoas.
    const va = carro("Fiat", "Argo", "branco", 80000);
    const vb = carro("Fiat", "Cronos", "branco", 85000);
    const vc = carro("Fiat", "Pulse", "branco", 90000);
    const r = casar([
      troca("a", va, [quer("Fiat", "Cronos")]),
      troca("b", vb, [quer("Fiat", "Argo"), quer("Fiat", "Pulse", [], { ordem: 2 })]),
      troca("c", vc, [quer("Fiat", "Argo")]),
    ]);
    // a recebe de b? a quer Cronos (de b). b aceita Argo (de a) ou Pulse (de c). c quer Argo (de a).
    // Possíveis: {a,b} direto; ou a←b, b←c, c←a (todos atendidos).
    expect(r.ciclos).toHaveLength(1);
    expect(r.ciclos[0].elos).toHaveLength(3);
    expect(r.naoAtendidos).toEqual([]);
  });

  it("com as mesmas pessoas, prefere duas trocas diretas a um ciclo de quatro", () => {
    const v = (m: string) => carro("Toyota", m, "prata", 120000);
    const [c1, c2, c3, c4] = [v("Corolla"), v("Yaris"), v("Hilux"), v("SW4")];
    const todos = [quer("Toyota", null)];
    const r = casar([troca("p1", c1, todos), troca("p2", c2, todos), troca("p3", c3, todos), troca("p4", c4, todos)]);
    expect(r.naoAtendidos).toEqual([]);
    expect(r.ciclos.map((c) => c.elos.length)).toEqual([2, 2]);
  });

  it("prefere atender a primeira opção de cada um", () => {
    const va = carro("Honda", "Civic", "preto", 130000);
    const vb = carro("Honda", "HR-V", "preto", 130000);
    const vc = carro("Honda", "City", "preto", 130000);
    // a gosta mais do HR-V (b), mas aceita o City (c). b e c querem o Civic.
    const r = casar([
      troca("a", va, [quer("Honda", "HR-V"), quer("Honda", "City", [], { ordem: 2 })]),
      troca("b", vb, [quer("Honda", "Civic")]),
      troca("c", vc, [quer("Honda", "Civic")]),
    ]);
    expect(r.ciclos).toHaveLength(1);
    const a = r.ciclos[0].elos.find((e) => e.participanteId === "a")!;
    expect(a.veiculoRecebidoId).toBe(vb.id);
    expect(a.desejoAtendido).toBe(1);
  });

  it("os ciclos escolhidos nunca compartilham participantes", () => {
    const ps: Participante[] = [];
    const modelos = ["Argo", "Cronos", "Pulse", "Toro", "Strada", "Mobi", "Fastback"];
    modelos.forEach((m, i) => {
      ps.push(troca(`p${i}`, carro("Fiat", m, "branco", 90000 + i * 1000), [quer("Fiat", null)]));
    });
    const r = casar(ps);
    const vistos = r.ciclos.flatMap((c) => c.elos.map((e) => e.participanteId));
    expect(new Set(vistos).size).toBe(vistos.length);
    expect(vistos.length + r.naoAtendidos.length).toBe(ps.length);
    expect(r.naoAtendidos).toEqual([]); // 7 = 2 + 2 + 3: ninguém sobra
    expect(r.ciclos.map((c) => c.elos.length).sort()).toEqual([2, 2, 3]);
  });
});

describe("casamento — quem só compra e quem só vende", () => {
  it("compra simples fecha como ciclo de dois com pagamento", () => {
    const corolla = carro("Toyota", "Corolla", "prata", 140000);
    const r = casar([
      { id: "vendedor", tipo: "venda", cidade: "SP", veiculo: corolla, desejos: [], maxPagar: 0 },
      { id: "comprador", tipo: "compra", cidade: "SP", veiculo: null, desejos: [quer("Toyota", "Corolla")], maxPagar: 150000 },
    ]);
    expect(r.ciclos).toHaveLength(1);
    const vend = r.ciclos[0].elos.find((e) => e.participanteId === "vendedor")!;
    const comp = r.ciclos[0].elos.find((e) => e.participanteId === "comprador")!;
    expect(vend.veiculoRecebidoId).toBeNull();
    expect(vend.diferenca).toBe(-140000); // recebe o valor do carro
    expect(comp.diferenca).toBe(140000); // paga o valor do carro
  });

  it("respeita o orçamento de quem só compra", () => {
    const corolla = carro("Toyota", "Corolla", "prata", 140000);
    const r = casar([
      { id: "v", tipo: "venda", cidade: "SP", veiculo: corolla, desejos: [], maxPagar: 0 },
      { id: "c", tipo: "compra", cidade: "SP", veiculo: null, desejos: [quer("Toyota", "Corolla")], maxPagar: 120000 },
    ]);
    expect(r.ciclos).toHaveLength(0);
  });

  it("cadeia comprador → troca → vendedor", () => {
    const hrv = carro("Honda", "HR-V", "cinza", 130000);
    const creta = carro("Hyundai", "Creta", "branco", 125000);
    const r = casar([
      { id: "comprador", tipo: "compra", cidade: "SP", veiculo: null, desejos: [quer("Honda", "HR-V")], maxPagar: 135000 },
      troca("trocador", hrv, [quer("Hyundai", "Creta")], 0, "SP"),
      { id: "vendedor", tipo: "venda", cidade: "SP", veiculo: creta, desejos: [], maxPagar: 0 },
    ]);
    expect(r.ciclos).toHaveLength(1);
    const elos = r.ciclos[0].elos;
    expect(elos).toHaveLength(3);
    expect(elos.reduce((s, e) => s + e.diferenca, 0)).toBe(0);
    expect(elos.find((e) => e.participanteId === "trocador")!.diferenca).toBe(-5000);
  });

  it("não amarra duas cadeias independentes num só ciclo", () => {
    const c1 = carro("Fiat", "Argo", "branco", 70000);
    const c2 = carro("Fiat", "Mobi", "branco", 60000);
    const r = casar(
      [
        { id: "v1", tipo: "venda", cidade: "SP", veiculo: c1, desejos: [], maxPagar: 0 },
        { id: "c1", tipo: "compra", cidade: "SP", veiculo: null, desejos: [quer("Fiat", "Argo")], maxPagar: 80000 },
        { id: "v2", tipo: "venda", cidade: "SP", veiculo: c2, desejos: [], maxPagar: 0 },
        { id: "c2", tipo: "compra", cidade: "SP", veiculo: null, desejos: [quer("Fiat", "Mobi")], maxPagar: 80000 },
      ],
    );
    expect(r.ciclos.map((c) => c.elos.length)).toEqual([2, 2]);
  });
});

describe("casamento — robustez", () => {
  it("pool vazio", () => {
    const r = casar([]);
    expect(r.ciclos).toEqual([]);
    expect(r.naoAtendidos).toEqual([]);
  });

  it("pool grande e denso termina e devolve ciclos disjuntos válidos", () => {
    const ps: Participante[] = [];
    const modelos = ["Argo", "Cronos", "Pulse", "Toro", "Strada", "Mobi"];
    for (let i = 0; i < 60; i++) {
      ps.push(
        troca(`p${i}`, carro("Fiat", modelos[i % modelos.length], "branco", 80000 + (i % 7) * 3000), [
          quer("Fiat", modelos[(i + 1) % modelos.length]),
          quer("Fiat", modelos[(i + 2) % modelos.length], [], { ordem: 2 }),
        ]),
      );
    }
    const r = casar(ps, { limiteCiclos: 5000, limiteBusca: 20000 });
    const vistos = r.ciclos.flatMap((c) => c.elos.map((e) => e.participanteId));
    expect(new Set(vistos).size).toBe(vistos.length);
    expect(vistos.length).toBeGreaterThan(40);
    for (const c of r.ciclos) expect(c.elos.reduce((s, e) => s + e.diferenca, 0)).toBe(0);
  });

  it("pontuação: um participante a mais vale mais que as penalidades de tamanho", () => {
    const e = (desejoAtendido: number) => ({ desejoAtendido, diferenca: 10000 });
    expect(pontuarCiclo([e(1), e(1), e(1)])).toBeGreaterThan(pontuarCiclo([e(1), e(1)]));
    expect(pontuarCiclo([e(3), e(3), e(3), e(3), e(3), e(3)])).toBeGreaterThan(pontuarCiclo([e(1), e(1), e(1), e(1), e(1)]));
  });
});
