// PinWith 로고: 핀 두 개가 겹친 모양(함께 꽂는 지도)
export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <path d="M12 29c-1-2.6-8-9-8-15a8 8 0 1 1 16 0c0 6-7 12.4-8 15z" fill="#0b5d6b" />
      <path d="M20 27c-1-2.6-8-9-8-15a8 8 0 1 1 16 0c0 6-7 12.4-8 15z" fill="#e0146e" stroke="#fff" strokeWidth="1.6" />
      <circle cx="20" cy="12" r="3" fill="#fff" />
    </svg>
  );
}

export function Logo({ size = 28 }: { size?: number }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <LogoMark size={size} />
      <span className="font-display font-semibold text-pin" style={{ fontSize: size * 0.62 }}>PinWith</span>
    </span>
  );
}
