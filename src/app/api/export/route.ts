import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/db";
import { getUsuarioAtual, podeVerGestao } from "@/lib/auth";
import { registrarAuditoria } from "@/lib/audit";

// Exporta o histórico de passagens (uma linha por paciente por passagem) em
// CSV, XLSX ou JSON, com opção de anonimização. Registra o acesso na auditoria.
export async function GET(req: Request) {
  const u = await getUsuarioAtual();
  if (!u) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
  if (!podeVerGestao(u.perfil)) {
    return NextResponse.json({ erro: "Sem permissão para exportar." }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const formato = searchParams.get("formato") ?? "csv";
  const anonimizar = searchParams.get("anonimizar") === "1";
  const setor = searchParams.get("setor");
  const medico = searchParams.get("medico");
  const de = searchParams.get("de");
  const ate = searchParams.get("ate");

  const where: any = {
    status: "concluida",
    setorId: setor && u.setoresIds.includes(setor) ? setor : { in: u.setoresIds },
  };
  if (medico) where.OR = [{ medicoPassaId: medico }, { medicoRecebeId: medico }];
  if (de || ate) {
    where.concluidaEm = {};
    if (de) where.concluidaEm.gte = new Date(de);
    if (ate) where.concluidaEm.lte = new Date(ate + "T23:59:59");
  }

  const passagens = await prisma.passagemEvento.findMany({
    where,
    include: {
      setor: true,
      medicoPassa: true,
      medicoRecebe: true,
      snapshots: { include: { paciente: true } },
    },
    orderBy: { concluidaEm: "desc" },
  });

  // Achata em linhas (uma por snapshot de paciente).
  const linhas = passagens.flatMap((p) =>
    p.snapshots.map((s, idx) => ({
      passagem_id: p.id,
      concluida_em: p.concluidaEm?.toISOString() ?? "",
      inicio_em: p.inicioEm.toISOString(),
      duracao_seg: p.duracaoSeg ?? "",
      setor: p.setor.nome,
      medico_passa: p.medicoPassa.nome,
      medico_recebe: p.medicoRecebe?.nome ?? "",
      paciente: anonimizar ? `PACIENTE_${idx + 1}` : s.paciente.identificador,
      leito: anonimizar ? "" : s.paciente.leito ?? "",
      idade: s.paciente.idade ?? "",
      sexo: s.paciente.sexo ?? "",
      gravidade: s.gravidade,
      nivel_preocupacao: s.nivelPreocupacao,
      o_que_me_preocupa: anonimizar ? "" : s.oQueMePreocupa ?? "",
      resumo_paciente: anonimizar ? "" : s.resumoPaciente,
      resumo_mudancas: anonimizar ? "" : s.resumoMudancas ?? "",
      sintese_receptor: anonimizar ? "" : s.sinteseReceptor ?? "",
      reconhecido: s.reconhecido ? "sim" : "nao",
      versao: s.versao,
    })),
  );

  await registrarAuditoria({
    usuarioId: u.id,
    acao: "historico.exportar",
    detalhe: `formato=${formato} anonimizar=${anonimizar} linhas=${linhas.length}`,
  });

  const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  const nomeBase = `passagens-${ts}${anonimizar ? "-anon" : ""}`;

  if (formato === "json") {
    return new NextResponse(JSON.stringify(linhas, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${nomeBase}.json"`,
      },
    });
  }

  if (formato === "xlsx") {
    const ws = XLSX.utils.json_to_sheet(linhas);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Passagens");
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    return new NextResponse(buf, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${nomeBase}.xlsx"`,
      },
    });
  }

  // CSV (padrão) — com BOM para acentuação correta no Excel.
  const cabecalho = linhas.length ? Object.keys(linhas[0]) : [];
  const escapar = (v: unknown) => {
    const s = String(v ?? "");
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [
    cabecalho.join(";"),
    ...linhas.map((l) => cabecalho.map((c) => escapar((l as any)[c])).join(";")),
  ].join("\n");

  return new NextResponse("﻿" + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${nomeBase}.csv"`,
    },
  });
}
