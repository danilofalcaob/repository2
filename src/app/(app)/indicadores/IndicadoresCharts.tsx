"use client";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from "recharts";

export default function IndicadoresCharts({
  passagensPorDia,
  passagensPorSetor,
  contingencias,
}: {
  passagensPorDia: { dia: string; qtd: number }[];
  passagensPorSetor: { setor: string; qtd: number }[];
  contingencias: { ativas: number; reconhecidas: number; disparadas: number; resolvidas: number };
}) {
  const dadosContingencia = [
    { nome: "Ativas", valor: contingencias.ativas, cor: "#0d9488" },
    { nome: "Reconhecidas", valor: contingencias.reconhecidas, cor: "#16a34a" },
    { nome: "Disparadas", valor: contingencias.disparadas, cor: "#dc2626" },
    { nome: "Resolvidas", valor: contingencias.resolvidas, cor: "#94a3b8" },
  ].filter((d) => d.valor > 0);

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <div className="card p-4">
        <h2 className="mb-3 font-semibold">Passagens por dia</h2>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={passagensPorDia}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
            <XAxis dataKey="dia" fontSize={11} />
            <YAxis allowDecimals={false} fontSize={11} />
            <Tooltip />
            <Line type="monotone" dataKey="qtd" stroke="#0d9488" strokeWidth={2} name="Passagens" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="card p-4">
        <h2 className="mb-3 font-semibold">Passagens por setor</h2>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={passagensPorSetor}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
            <XAxis dataKey="setor" fontSize={11} />
            <YAxis allowDecimals={false} fontSize={11} />
            <Tooltip />
            <Bar dataKey="qtd" fill="#0d9488" name="Passagens" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {dadosContingencia.length > 0 && (
        <div className="card p-4">
          <h2 className="mb-3 font-semibold">Contingências por status</h2>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={dadosContingencia} dataKey="valor" nameKey="nome" outerRadius={90} label>
                {dadosContingencia.map((d, i) => (
                  <Cell key={i} fill={d.cor} />
                ))}
              </Pie>
              <Legend />
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
