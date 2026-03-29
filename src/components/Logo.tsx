interface LogoProps {
  size?: number;
  className?: string;
  showText?: boolean;
}

export function Logo({ size = 40, className = '', showText = true }: LogoProps) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0"
      >
        <rect width="48" height="48" rx="14" fill="#5447BC" />
        {/* Stylized "L" mark */}
        <path
          d="M16 12V36H32"
          stroke="#BEEE62"
          strokeWidth="4.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Spark / light dot above */}
        <circle cx="32" cy="14" r="3" fill="#BEEE62" />
        <line x1="32" y1="8" x2="32" y2="10" stroke="#BEEE62" strokeWidth="2" strokeLinecap="round" />
        <line x1="36" y1="14" x2="34.5" y2="14" stroke="#BEEE62" strokeWidth="2" strokeLinecap="round" />
        <line x1="34.8" y1="10.5" x2="33.8" y2="11.5" stroke="#BEEE62" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      {showText && (
        <span
          className="font-bold text-xl tracking-tight"
          style={{ color: '#5447BC' }}
        >
          Lumnia
        </span>
      )}
    </div>
  );
}

/** Inline SVG as data URI for favicon/PWA icons */
export const LOGO_SVG_DATA_URI = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect width="48" height="48" rx="14" fill="#5447BC"/><path d="M16 12V36H32" stroke="#BEEE62" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="32" cy="14" r="3" fill="#BEEE62"/><line x1="32" y1="8" x2="32" y2="10" stroke="#BEEE62" stroke-width="2" stroke-linecap="round"/><line x1="36" y1="14" x2="34.5" y2="14" stroke="#BEEE62" stroke-width="2" stroke-linecap="round"/><line x1="34.8" y1="10.5" x2="33.8" y2="11.5" stroke="#BEEE62" stroke-width="1.5" stroke-linecap="round"/></svg>'
)}`;
