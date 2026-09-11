"use client";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from "recharts";
import {
  CATEGORIA_BARREIRA_LABEL,
  COR_ETAPA,
  ETAPA_LABEL,
  type CategoriaBarreira,
  type EtapaJornada,
} from "@/lib/constants";

export default function PainelCharts({
  casosPorEtapa,
  barreirasPorCategoria,
  tempoMedioPorEtapa,
  altasPorDia,
}: {
  casosPorEtapa: { etapa: string; qtd: number }[];
  barreirasPorCategoria: {
    categoria: string;
    abertas: number;
    resolvidas: number;
    tempoMedioH: number;
    clinica: boolean;
  }[];
  tempoMedioPorEtapa: { etapa: string; horas: number }[];
  altasPorDia: { dia: string; qtd: number }[];
}) {
  const funil = casosPorEtapa.map((e) => ({
    ...e,
    nome: ETAPA_LABEL[e.etapa as EtapaJornada] ?? e.etapa,
    cor: COR_ETAPA[e.etapa as EtapaJornada] ?? "#64748b",
  }));

  const barreiras = barreirasPorCategoria
    .filter((b) => b.abertas + b.resolvidas > 0)
    .slice(0, 8)
    .map((b) => ({
      ...b,
      nome: CATEGORIA_BARREIRA_LABEL[b.categoria as CategoriaBarreira] ?? b.categoria,
    }));

  const etapas = tempoMedioPorEtapa
    .filter((e) => e.horas > 0)
    .map((e) => ({
      nome: ETAPA_LABEL[e.etapa as EtapaJornada] ?? e.etapa,
      dias: Number((e.horas / 24).toFixed(1)),
      cor: COR_ETAPA[e.etapa as EtapaJornada] ?? "#64748b",
    }));

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <div className="card p-4">
        <h2 className="mb-1 font-semibold">Casos por etapa do funil</h2>
        <p className="mb-3 text-xs text-clinic-muted">
          Acúmulo em uma etapa indica onde o fluxo está emperrando.
        </p>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={funil} layout="vertical" margin={{ left: 24 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
            <XAxis type="number" allowDecimals={false} fontSize={11} />
            <YAxis type="category" dataKey="nome" width={120} fontSize={11} />
            <Tooltip />
            <Bar dataKey="qtd" name="Casos" radius={[0, 4, 4, 0]}>
              {funil.map((e) => (
                <Cell key={e.etapa} fill={e.cor} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="card p-4">
        <h2 className="mb-1 font-semibold">Barreiras por categoria</h2>
        <p className="mb-3 text-xs text-clinic-muted">
          O que mais segura pacientes prontos — e quanto já foi resolvido.
        </p>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={barreiras} layout="vertical" margin={{ left: 24 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
            <XAxis type="number" allowDecimals={false} fontSize={11} />
            <YAxis type="category" dataKey="nome" width={140} fontSize={11} />
            <Tooltip />
            <Legend />
            <Bar dataKey="abertas" name="Abertas" fill="#d97706" radius={[0, 4, 4, 0]} />
            <Bar dataKey="resolvidas" name="Resolvidas" fill="#16a34a" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="card p-4">
        <h2 className="mb-1 font-semibold">Tempo médio em cada etapa (dias)</h2>
        <p className="mb-3 text-xs text-clinic-muted">
          Gargalos do processo: etapas longas viram dias de internação.
        </p>
        {etapas.length === 0 ? (
          <p className="py-10 text-center text-sm text-clinic-muted">
            Ainda sem movimentações suficientes para calcular.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={etapas}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
              <XAxis dataKey="nome" fontSize={10} interval={0} angle={-15} textAnchor="end" height={60} />
              <YAxis fontSize={11} />
              <Tooltip formatter={(v: number) => `${v} dia(s)`} />
              <Bar dataKey="dias" name="Dias" radius={[4, 4, 0, 0]}>
                {etapas.map((e) => (
                  <Cell key={e.nome} fill={e.cor} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="card p-4">
        <h2 className="mb-1 font-semibold">Altas efetivadas por dia</h2>
        <p className="mb-3 text-xs text-clinic-muted">
          Distribuição das saídas no período selecionado.
        </p>
        {altasPorDia.length === 0 ? (
          <p className="py-10 text-center text-sm text-clinic-muted">
            Nenhuma alta registrada no período.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={altasPorDia}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
              <XAxis dataKey="dia" fontSize={11} />
              <YAxis allowDecimals={false} fontSize={11} />
              <Tooltip />
              <Line type="monotone" dataKey="qtd" stroke="#0d9488" strokeWidth={2} name="Altas" />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
