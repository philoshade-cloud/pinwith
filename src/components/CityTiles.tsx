import Link from "next/link";

// 도시 고르기: 눌러서 들어가는 타일
export function CityTiles({ items }: { items: { href: string; name: string; sub: string; hrefLang?: string }[] }) {
  return (
    <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
      {items.map((c) => (
        <Link
          key={c.href}
          href={c.href}
          hrefLang={c.hrefLang}
          className="group flex items-center justify-between gap-2 rounded-2xl border border-rule bg-white px-4 py-3.5 shadow-sm transition hover:-translate-y-0.5 hover:border-teal hover:shadow-md"
        >
          <span className="min-w-0">
            <span className="block truncate text-[16px] font-semibold text-ink group-hover:text-teal">📍 {c.name}</span>
            <span className="mt-0.5 block text-[12px] text-muted">{c.sub}</span>
          </span>
          <span aria-hidden className="text-[18px] text-teal rtl:rotate-180">›</span>
        </Link>
      ))}
    </div>
  );
}
