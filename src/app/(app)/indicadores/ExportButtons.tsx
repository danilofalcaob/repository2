"use client";
import { useState } from "react";

export default function ExportButtons({ searchParams }: { searchParams: Record<string, string> }) {
  const [anon, setAnon] = useState(false);

  function url(formato: string) {
    const params = new URLSearchParams(searchParams);
    params.set("formato", formato);
    if (anon) params.set("anonimizar", "1");
    return `/api/export?${params.toString()}`;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="flex items-center gap-1.5 text-xs text-clinic-muted">
        <input type="checkbox" checked={anon} onChange={(e) => setAnon(e.target.checked)} />
        Anonimizar
      </label>
      <a href={url("csv")} className="btn-secondary !py-1.5 text-xs">⬇ CSV</a>
      <a href={url("xlsx")} className="btn-secondary !py-1.5 text-xs">⬇ Excel</a>
      <a href={url("json")} className="btn-secondary !py-1.5 text-xs">⬇ JSON</a>
    </div>
  );
}
