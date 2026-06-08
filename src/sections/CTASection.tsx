import { Shield, Clock, Users } from 'lucide-react';

export default function CTASection() {
  const goToPricing = () => {
    window.location.hash = '/pricing';
  };

  return (
    <section
      id="cta"
      className="w-full py-28 md:py-36"
      style={{
        background: 'radial-gradient(ellipse at 50% 50%, rgba(232, 93, 78, 0.05) 0%, transparent 60%)',
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
          Start your 3-day free trial today. No credit card required. 30-day money-back guarantee.
        </p>

        <div className="mt-10">
          <button
            type="button"
            onClick={goToPricing}
            className="inline-flex items-center justify-center px-12 py-5 bg-[#E85D4E] text-white rounded-lg text-sm font-medium uppercase tracking-[0.04em] hover:bg-[#D44A3C] transition-all glow-coral-pulse cursor-pointer border-0"
          >
            Get VelocityVPN Now
          </button>
        </div>

        <div className="mt-12 flex flex-wrap justify-center gap-6 md:gap-12">
          {[
            { icon: Shield, text: 'Military-Grade Encryption' },
            { icon: Clock, text: '30-Day Money-Back' },
            { icon: Users, text: 'Free 3-Day Trial' },
          ].map((badge) => (
            <div key={badge.text} className="flex items-center gap-2 text-[#6B7280]">
              <badge.icon size={16} className="text-[#E85D4E]" />
              <span className="text-xs uppercase tracking-wider">{badge.text}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
