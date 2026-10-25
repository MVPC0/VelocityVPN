import { REFERENCE_DC_NOTE } from '@/data/ping-targets';

/** Small "Estimate" pill: the number is a reference-datacenter estimate, not the user's VPN server. */
export default function EstimateTag({ className = '' }: { className?: string }) {
  return (
    <span
      title={`Estimate. ${REFERENCE_DC_NOTE}`}
      className={`inline-block rounded border border-[rgba(163,184,212,0.35)] px-1.5 py-px text-[9px] font-medium uppercase tracking-wider text-[#A3B8D4] align-middle ${className}`}
    >
      Estimate
    </span>
  );
}
