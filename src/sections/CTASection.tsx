import React from 'react';
import { useInView } from '@/hooks/useInView';
import Button from '@/components/Button';
import { Shield, Clock, Users } from 'lucide-react';

const CTASection: React.FC = () => {
  const { ref, isInView } = useInView(0.2);

  const trustBadges = [
    { icon: Shield, text: 'Military-Grade Encryption' },
    { icon: Clock, text: '30-Day Money-Back' },
    { icon: Users, text: '100,000+ Gamers' },
  ];

  return (
    <section
      id="cta"
      ref={ref}
      className="w-full py-28 md:py-36"
      style={{
        background:
          'radial-gradient(ellipse at 50% 50%, rgba(232, 93, 78, 0.05) 0%, transparent 60%)',
      }}
    >
      <div className="max-w-[800px] mx-auto px-6 lg:px-12 text-center">
        <h2
          className={`font-['Archivo'] text-white transition-all duration-700 glitch-hover ${
            isInView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
          }`}
          style={{
            fontSize: 'clamp(48px, 10vw, 100px)',
            letterSpacing: '-0.06em',
            lineHeight: 0.9,
          }}
          data-text="Game Without Limits"
        >
          Game Without Limits
        </h2>

        <p
          className={`mt-6 text-[#D1D5DB] max-w-[560px] mx-auto transition-all duration-700 delay-100 ${
            isInView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
          }`}
          style={{ fontSize: 'clamp(16px, 1.8vw, 20px)', lineHeight: 1.6 }}
        >
          Join 100,000+ gamers who&apos;ve already made the switch. 30-day money-back
          guarantee.
        </p>

        <div
          className={`mt-10 transition-all duration-700 delay-200 ${
            isInView ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
          }`}
        >
          <Button
            variant="primary"
            size="lg"
            className="glow-coral-pulse"
          >
            Get VelocityVPN Now
          </Button>
        </div>

        {/* Trust Badges */}
        <div
          className={`mt-12 flex flex-wrap justify-center gap-6 md:gap-12 transition-all duration-700 delay-300 ${
            isInView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
        >
          {trustBadges.map((badge) => {
            const Icon = badge.icon;
            return (
              <div
                key={badge.text}
                className="flex items-center gap-2 text-[#6B7280]"
              >
                <Icon size={16} className="text-[#E85D4E]" />
                <span className="text-xs uppercase tracking-wider">{badge.text}</span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default CTASection;
