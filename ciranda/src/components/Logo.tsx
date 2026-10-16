// Três carros em roda — a marca da Ciranda.
export default function Logo({ tamanho = 32 }: { tamanho?: number }) {
  return (
    <span
      className="flex items-center justify-center rounded-lg bg-app-primary text-app-primaryfg"
      style={{ width: tamanho, height: tamanho }}
      aria-hidden
    >
      <svg viewBox="0 0 24 24" width={tamanho * 0.7} height={tamanho * 0.7} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
        <path d="M12 3a9 9 0 0 1 7.8 4.5" />
        <path d="M20.6 14.5A9 9 0 0 1 12 21" />
        <path d="M5.4 18.5A9 9 0 0 1 4.2 7.5" />
        <path d="M17.5 4.5l2.3 3-3.6.4" />
        <path d="M14.5 21.6 12 21l1.6-2.9" />
        <path d="M2.6 9.8 4.2 7.5l2.1 2.6" />
      </svg>
    </span>
  );
}
