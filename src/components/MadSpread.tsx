import { useId } from 'react';
import { Info } from 'lucide-react';
import { MAD_EXPLANATION, formatSpread } from '@/lib/latency';

/** Spread text (`± 3.2 ms` / `< 1 ms`) with a hover/focus tooltip explaining MAD. */
export default function MadSpread({ mad, prefix = '', align = 'right', className = '' }: {
  mad: number;
  prefix?: string;
  align?: 'right' | 'center';
  className?: string;
}) {
  const id = useId();
  const text = formatSpread(mad);
  return (
    <span
      tabIndex={0}
      aria-describedby={id}
      className={`relative group inline-flex items-center gap-1 cursor-help outline-none focus-visible:ring-1 focus-visible:ring-[#E85D4E] rounded ${className}`}
    >
      <span>{prefix}{text}</span>
      <Info size={11} aria-hidden="true" className="opacity-60" />
      <span
        id={id}
        role="tooltip"
        className={`pointer-events-none absolute bottom-full mb-2 w-60 rounded-md border border-[rgba(255,255,255,0.12)] bg-[#1A1A24] px-2.5 py-1.5 text-left font-sans text-[11px] font-normal normal-case leading-snug tracking-normal text-[#E5E7EB] shadow-lg opacity-0 transition-opacity group-hover:opacity-100 group-focus:opacity-100 z-50 ${align === 'center' ? 'left-1/2 -translate-x-1/2' : 'right-0'}`}
      >
        {MAD_EXPLANATION}
      </span>
    </span>
  );
}
