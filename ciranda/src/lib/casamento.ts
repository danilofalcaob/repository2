// Motor de casamento da Ciranda.
//
// Modelo: um grafo dirigido em que cada participante é um nó e a aresta
// i → j significa "i aceita receber o carro de j" (o carro de j atende a um
// dos desejos de i, na mesma cidade, dentro do troco que i aceita pagar).
// Um ciclo i1 → i2 → … → ik → i1 é uma ciranda: cada um recebe o carro do
// próximo e todo carro sai de um dono e chega a exatamente um novo dono.
// É o mesmo problema dos programas de doação cruzada de rim.
//
// Quem só vende ou só compra entra por "arestas de dinheiro": quem só vende
// recebe o pagamento de quem só compra (venda → compra). Assim uma cadeia
// comprador → … → vendedor vira um ciclo. No máximo uma aresta de dinheiro por
// ciclo: duas cadeias independentes não devem ficar amarradas uma à outra.
//
// Etapas: (1) monta o grafo; (2) enumera os ciclos simples de até
// `maxTamanho` participantes; (3) escolhe o conjunto de ciclos disjuntos de
// maior pontuação — busca exata (branch and bound) partindo da solução gulosa,
// com orçamento de passos para nunca travar.

import { corCanonica, modeloCompativel, normalizar } from "./normalizar";
import { TAMANHO_MAXIMO_CIRANDA } from "./constants";
import type { TipoIntencao } from "./constants";

export type VeiculoOferta = {
  id: string;
  marca: string;
  modelo: string;
  ano: number;
  cor: string;
  km: number;
  cambio: string;
  valor: number;
};

export type DesejoCasamento = {
  ordem: number; // 1 = primeira opção
  marca: string;
  modelo: string | null; // null = qualquer modelo da marca
  cores: string[]; // vazio = qualquer cor
  anoMin: number | null;
  kmMax: number | null;
  cambio: string | null; // null = indiferente
};

export type Participante = {
  id: string; // id da intenção
  tipo: TipoIntencao;
  cidade: string;
  veiculo: VeiculoOferta | null; // null para quem só compra
  desejos: DesejoCasamento[]; // vazio para quem só vende
  maxPagar: number; // troca: troco máximo que aceita pagar · compra: orçamento
};

// "Este participante já recusou este carro" — a aresta não é recriada.
export type Bloqueio = { participanteId: string; veiculoId: string };

export type OpcoesCasamento = {
  maxTamanho?: number;
  limiteCiclos?: number;
  limiteBusca?: number;
  bloqueios?: Bloqueio[];
};

export type EloCasamento = {
  participanteId: string;
  veiculoEntregueId: string | null; // null: só compra
  veiculoRecebidoId: string | null; // null: só vende (recebe dinheiro)
  desejoAtendido: number | null;
  valorEntregue: number;
  valorRecebido: number;
  diferenca: number; // > 0 paga troco · < 0 recebe troco
};

export type CicloCasamento = { cidade: string; elos: EloCasamento[]; pontuacao: number };

export type ResultadoCasamento = {
  ciclos: CicloCasamento[];
  naoAtendidos: string[];
  estatisticas: {
    participantes: number;
    arestas: number;
    ciclosCandidatos: number;
    enumeracaoCompleta: boolean;
    buscaCompleta: boolean;
  };
};

type Aresta = { para: number; ordem: number; dinheiro: boolean };

// ---------------------------------------------------------------------------
// Compatibilidade
// ---------------------------------------------------------------------------

export function atendeDesejo(desejo: DesejoCasamento, v: VeiculoOferta): boolean {
  if (normalizar(desejo.marca) !== normalizar(v.marca)) return false;
  if (desejo.modelo && !modeloCompativel(desejo.modelo, v.modelo)) return false;
  if (desejo.cores.length > 0 && !desejo.cores.map(corCanonica).includes(corCanonica(v.cor))) return false;
  if (desejo.anoMin != null && v.ano < desejo.anoMin) return false;
  if (desejo.kmMax != null && v.km > desejo.kmMax) return false;
  if (desejo.cambio && normalizar(desejo.cambio) !== normalizar(v.cambio)) return false;
  return true;
}

// Ordem do melhor desejo que o carro atende (ou null se nenhum).
export function melhorDesejo(p: Participante, v: VeiculoOferta): number | null {
  let melhor: number | null = null;
  for (const d of p.desejos) {
    if (atendeDesejo(d, v) && (melhor === null || d.ordem < melhor)) melhor = d.ordem;
  }
  return melhor;
}

// Diferença que `receptor` pagaria ao receber `v` (negativa = recebe troco).
export function diferencaPara(receptor: Participante, v: VeiculoOferta): number {
  return v.valor - (receptor.veiculo?.valor ?? 0);
}

export function aceitaReceber(receptor: Participante, v: VeiculoOferta): number | null {
  const ordem = melhorDesejo(receptor, v);
  if (ordem === null) return null;
  if (diferencaPara(receptor, v) > receptor.maxPagar) return null;
  return ordem;
}

// ---------------------------------------------------------------------------
// Grafo
// ---------------------------------------------------------------------------

function montarGrafo(ps: Participante[], bloqueios: Bloqueio[]): Aresta[][] {
  const bloqueado = new Set(bloqueios.map((b) => `${b.participanteId}|${b.veiculoId}`));
  const cidades = ps.map((p) => normalizar(p.cidade));
  return ps.map((receptor, i) => {
    const arestas: Aresta[] = [];
    ps.forEach((doador, j) => {
      if (i === j || cidades[i] !== cidades[j]) return;
      if (receptor.tipo === "venda" && doador.tipo === "compra") {
        arestas.push({ para: j, ordem: 1, dinheiro: true });
        return;
      }
      if (!doador.veiculo || receptor.desejos.length === 0) return;
      if (bloqueado.has(`${receptor.id}|${doador.veiculo.id}`)) return;
      const ordem = aceitaReceber(receptor, doador.veiculo);
      if (ordem !== null) arestas.push({ para: j, ordem, dinheiro: false });
    });
    // Explora primeiro os carros mais desejados: se a enumeração for cortada
    // pela cota, os ciclos que ficam são os de melhor preferência.
    return arestas.sort((a, b) => a.ordem - b.ordem);
  });
}

// ---------------------------------------------------------------------------
// Pontuação de um ciclo
// ---------------------------------------------------------------------------
//
// Cada participante atendido vale 1000, menos 50 por posição de preferência
// abaixo da primeira (1ª opção vale mais que a 3ª). Penalidades do ciclo:
// 10·k² pelo tamanho (dois ciclos de 2 são mais seguros que um de 4 com as
// mesmas pessoas — cada elo é um ponto de desistência) e 1 ponto a cada
// R$ 10 mil de troco movimentado (menos dinheiro = mais fácil de fechar).
// Atender uma pessoa a mais sempre pesa mais que as penalidades.

export function pontuarCiclo(elos: Pick<EloCasamento, "desejoAtendido" | "diferenca">[]): number {
  const k = elos.length;
  const preferencia = elos.reduce((s, e) => s + 1000 - 50 * ((e.desejoAtendido ?? 1) - 1), 0);
  const troco = elos.reduce((s, e) => s + Math.abs(e.diferenca), 0);
  return preferencia - 10 * k * k - Math.floor(troco / 10000);
}

// ---------------------------------------------------------------------------
// Algoritmo principal
// ---------------------------------------------------------------------------

export function casar(participantes: Participante[], opcoes: OpcoesCasamento = {}): ResultadoCasamento {
  const maxTamanho = Math.max(2, opcoes.maxTamanho ?? TAMANHO_MAXIMO_CIRANDA);
  const limiteCiclos = opcoes.limiteCiclos ?? 20000;
  const limiteBusca = opcoes.limiteBusca ?? 200000;
  const ps = participantes;
  const n = ps.length;
  const grafo = montarGrafo(ps, opcoes.bloqueios ?? []);
  const totalArestas = grafo.reduce((s, a) => s + a.length, 0);

  // (2) Enumeração: cada ciclo é encontrado uma única vez, a partir do seu
  // nó de menor índice (só visita nós de índice maior que a origem). Vai por
  // tamanho crescente — todos os ciclos de 2, depois de 3… — com cota por
  // origem, para que um pool grande não gaste o limite inteiro com os
  // primeiros participantes e deixe os demais sem nenhum candidato.
  type Candidato = { nos: number[]; arestas: Aresta[]; pontuacao: number };
  const candidatos: Candidato[] = [];
  let enumeracaoCompleta = true;
  const naPilha = new Array<boolean>(n).fill(false);
  const cotaCiclos = Math.max(20, Math.ceil(limiteCiclos / Math.max(1, n * (maxTamanho - 1))));
  const cotaPassos = cotaCiclos * 200;

  const registrar = (nos: number[], arestas: Aresta[]) => {
    const elos = montarElos(ps, nos, arestas);
    candidatos.push({ nos: [...nos], arestas: [...arestas], pontuacao: pontuarCiclo(elos) });
  };

  for (let tamanho = 2; tamanho <= maxTamanho && candidatos.length < limiteCiclos; tamanho++) {
    for (let origem = 0; origem < n && candidatos.length < limiteCiclos; origem++) {
      const nos = [origem];
      const arestas: Aresta[] = [];
      let achados = 0;
      let passos = 0;
      naPilha[origem] = true;
      const dfs = (u: number, dinheiro: number) => {
        if (++passos > cotaPassos) {
          enumeracaoCompleta = false;
          return;
        }
        for (const a of grafo[u]) {
          if (achados >= cotaCiclos || passos > cotaPassos) {
            enumeracaoCompleta = false;
            return;
          }
          const d = dinheiro + (a.dinheiro ? 1 : 0);
          if (d > 1) continue;
          if (a.para === origem) {
            if (nos.length === tamanho) {
              arestas.push(a);
              registrar(nos, arestas);
              arestas.pop();
              achados++;
            }
            continue;
          }
          if (nos.length >= tamanho || a.para < origem || naPilha[a.para]) continue;
          naPilha[a.para] = true;
          nos.push(a.para);
          arestas.push(a);
          dfs(a.para, d);
          arestas.pop();
          nos.pop();
          naPilha[a.para] = false;
        }
      };
      dfs(origem, 0);
      naPilha[origem] = false;
    }
  }
  if (candidatos.length >= limiteCiclos) enumeracaoCompleta = false;

  // (3) Seleção de ciclos disjuntos.
  const ordemCandidatos = candidatos
    .map((_, i) => i)
    .sort(
      (a, b) =>
        candidatos[b].pontuacao - candidatos[a].pontuacao ||
        candidatos[a].nos.length - candidatos[b].nos.length,
    );

  // Solução inicial gulosa: melhor ciclo primeiro, se ainda couber.
  const usadoGuloso = new Array<boolean>(n).fill(false);
  let melhor: number[] = [];
  let melhorPontuacao = 0;
  for (const c of ordemCandidatos) {
    if (candidatos[c].nos.some((v) => usadoGuloso[v])) continue;
    candidatos[c].nos.forEach((v) => (usadoGuloso[v] = true));
    melhor.push(c);
    melhorPontuacao += candidatos[c].pontuacao;
  }

  // Busca exata: para o próximo nó livre, ou ele fica de fora, ou entra por
  // um dos ciclos que o contêm. Limite superior: cada nó livre contribui no
  // máximo com a maior "fatia" (pontuação/tamanho) entre os ciclos dele.
  const ciclosDoNo: number[][] = Array.from({ length: n }, () => []);
  for (const c of ordemCandidatos) for (const v of candidatos[c].nos) ciclosDoNo[v].push(c);
  const fatia = ciclosDoNo.map((cs) =>
    cs.reduce((m, c) => Math.max(m, candidatos[c].pontuacao / candidatos[c].nos.length), 0),
  );
  const nosComCiclo = ciclosDoNo.map((cs, v) => (cs.length > 0 ? v : -1)).filter((v) => v >= 0);

  const usado = new Array<boolean>(n).fill(false);
  const escolhidos: number[] = [];
  let passos = 0;
  let buscaCompleta = true;

  const buscar = (pos: number, pontuacao: number) => {
    if (++passos > limiteBusca) {
      buscaCompleta = false;
      return;
    }
    while (pos < nosComCiclo.length && usado[nosComCiclo[pos]]) pos++;
    if (pos >= nosComCiclo.length) {
      if (pontuacao > melhorPontuacao) {
        melhorPontuacao = pontuacao;
        melhor = [...escolhidos];
      }
      return;
    }
    let limite = pontuacao;
    for (let i = pos; i < nosComCiclo.length; i++) if (!usado[nosComCiclo[i]]) limite += fatia[nosComCiclo[i]];
    if (limite <= melhorPontuacao) return;

    const v = nosComCiclo[pos];
    for (const c of ciclosDoNo[v]) {
      const nos = candidatos[c].nos;
      if (nos.some((x) => usado[x])) continue;
      nos.forEach((x) => (usado[x] = true));
      escolhidos.push(c);
      buscar(pos + 1, pontuacao + candidatos[c].pontuacao);
      escolhidos.pop();
      nos.forEach((x) => (usado[x] = false));
      if (!buscaCompleta) return;
    }
    // v fica fora desta rodada.
    usado[v] = true;
    buscar(pos + 1, pontuacao);
    usado[v] = false;
  };
  if (candidatos.length > 0) buscar(0, 0);

  const atendidos = new Set<number>();
  const ciclos = melhor
    .map((c) => candidatos[c])
    .sort((a, b) => b.pontuacao - a.pontuacao)
    .map((c) => {
      c.nos.forEach((v) => atendidos.add(v));
      return { cidade: ps[c.nos[0]].cidade, elos: montarElos(ps, c.nos, c.arestas), pontuacao: c.pontuacao };
    });

  return {
    ciclos,
    naoAtendidos: ps.filter((_, i) => !atendidos.has(i)).map((p) => p.id),
    estatisticas: {
      participantes: n,
      arestas: totalArestas,
      ciclosCandidatos: candidatos.length,
      enumeracaoCompleta,
      buscaCompleta,
    },
  };
}

// nos[i] recebe o carro de nos[i+1] (e o último, do primeiro). Numa aresta de
// dinheiro, quem só vende recebe o pagamento em vez de um carro.
function montarElos(ps: Participante[], nos: number[], arestas: Aresta[]): EloCasamento[] {
  return nos.map((v, i) => {
    const p = ps[v];
    const a = arestas[i];
    const doador = ps[nos[(i + 1) % nos.length]];
    const recebido = a.dinheiro ? null : doador.veiculo;
    const valorEntregue = p.veiculo?.valor ?? 0;
    const valorRecebido = recebido?.valor ?? 0;
    return {
      participanteId: p.id,
      veiculoEntregueId: p.veiculo?.id ?? null,
      veiculoRecebidoId: recebido?.id ?? null,
      desejoAtendido: a.dinheiro ? null : a.ordem,
      valorEntregue,
      valorRecebido,
      diferenca: valorRecebido - valorEntregue,
    };
  });
}
