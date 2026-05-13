interface PaginadorProps {
  total: number;
  page: number;
  perPage: number;
  onChange: (page: number) => void;
}

export function Paginador({ total, page, perPage, onChange }: PaginadorProps) {
  const totalPages = Math.ceil(total / perPage);
  if (totalPages <= 1) return null;

  const from = (page - 1) * perPage + 1;
  const to = Math.min(page * perPage, total);

  const pages: (number | "…")[] = [];
  const start = Math.max(1, page - 1);
  const end = Math.min(totalPages, page + 1);
  if (start > 1) pages.push(1);
  if (start > 2) pages.push("…");
  for (let i = start; i <= end; i++) pages.push(i);
  if (end < totalPages - 1) pages.push("…");
  if (end < totalPages) pages.push(totalPages);

  const btn =
    "px-2.5 py-1 text-xs rounded-md transition-colors disabled:opacity-30 disabled:cursor-not-allowed";

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50/50">
      <p className="text-xs text-gray-400">
        Mostrando {from}–{to} de {total}
      </p>
      <div className="flex items-center gap-1">
        <button
          className={`${btn} text-gray-500 hover:bg-gray-100`}
          disabled={page === 1}
          onClick={() => onChange(page - 1)}
        >
          ← Anterior
        </button>
        {pages.map((p, i) =>
          p === "…" ? (
            <span key={`e${i}`} className="px-1 text-xs text-gray-300 select-none">
              …
            </span>
          ) : (
            <button
              key={p}
              onClick={() => onChange(p)}
              className={`${btn} min-w-[28px] ${
                p === page
                  ? "bg-brand-500 text-white font-semibold"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              {p}
            </button>
          )
        )}
        <button
          className={`${btn} text-gray-500 hover:bg-gray-100`}
          disabled={page === totalPages}
          onClick={() => onChange(page + 1)}
        >
          Siguiente →
        </button>
      </div>
    </div>
  );
}
