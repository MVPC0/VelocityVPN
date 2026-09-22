import { Shield, Wifi, Users } from 'lucide-react';
import { Link } from 'react-router';

export default function CTASection() {
  return (
    <section
      id="cta"
      className="w-full py-28 md:py-36"
      style={{
        background: 'radial-gradient(ellipse at 50% 50%, rgba(74, 222, 128, 0.05) 0%, transparent 60%)',
      }}
    >
      <div className="max-w-[800px] mx-auto px-6 lg:px-12 text-center">
        <h2
          className="font-['Archivo'] text-white"
          style={{
            fontSize: 'clamp(48px, 10vw, 100px)',
            letterSpacing: '-0.06em',
            lineHeight: 0.9,
          }}
        >
          Game Without Limits
        </h2>

        <p className="mt-6 text-[#D1D5DB] max-w-[560px] mx-auto text-lg">
          The dashboard is free. Bring your own WireGuard provider. This site does not lower ping by itself.
        </p>

        <div className="mt-10">
          <Link
            to="/dashboard"
            className="inline-flex items-center justify-center px-12 py-5 bg-[#4ADE80] text-[#050507] rounded-lg text-sm font-bold uppercase tracking-[0.04em] hover:bg-[#3ECF71] transition-all cursor-pointer border-0 no-underline"
          >
            Get Started Free
          </Link>
        </div>

        <div className="mt-12 flex flex-wrap justify-center gap-6 md:gap-12">
          {[
            { icon: Shield, text: 'We do not route traffic' },
            { icon: Wifi, text: 'Works with your provider' },
            { icon: Users, text: 'Guest mode, no paywall' },
          ].map((badge) => (
            <div key={badge.text} className="flex items-center gap-2 text-[#6B7280]">
              <badge.icon size={16} className="text-[#4ADE80]" />
              <span className="text-xs uppercase tracking-wider">{badge.text}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
