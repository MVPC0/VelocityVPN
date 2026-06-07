import React, { useRef, useEffect } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import SectionHeader from '@/components/SectionHeader';
import { Shield, Zap, Globe, GitBranch, Power, Headphones } from 'lucide-react';

gsap.registerPlugin(ScrollTrigger);

interface Feature {
  icon: React.ElementType;
  title: string;
  description: string;
  speed: number;
  column: number;
  floatDelay: number;
}

const features: Feature[] = [
  {
    icon: Shield,
    title: 'DDoS Protection',
    description: 'Your real IP stays hidden. DDoS attacks hit our servers, not your connection. Play tournaments with confidence.',
    speed: 0.5,
    column: 1,
    floatDelay: 0,
  },
  {
    icon: Zap,
    title: 'Zero Lag',
    description: 'Gaming-optimized protocols cut latency to the bone. Sub-30ms ping on major titles with zero packet loss.',
    speed: 1.0,
    column: 2,
    floatDelay: -1,
  },
  {
    icon: Globe,
    title: 'Global Servers',
    description: '90+ server cities across 6 continents. Smart routing automatically finds the fastest path to your game server.',
    speed: 0.7,
    column: 3,
    floatDelay: -2,
  },
  {
    icon: GitBranch,
    title: 'Split Tunneling',
    description: 'Route only your game traffic through the VPN. Keep Discord, streaming, and browsing on your regular connection.',
    speed: 1.2,
    column: 1,
    floatDelay: -3,
  },
  {
    icon: Power,
    title: 'Kill Switch',
    description: 'If your VPN drops, your internet cuts instantly. No accidental IP exposure. No mid-match disconnections.',
    speed: 0.8,
    column: 2,
    floatDelay: -0.5,
  },
  {
    icon: Headphones,
    title: '24/7 Support',
    description: "Gaming doesn't stop, and neither do we. Our team of gamers is online around the clock to help you.",
    speed: 1.5,
    column: 3,
    floatDelay: -4,
  },
];

const FeaturesRacingSection: React.FC = () => {
  const sectionRef = useRef<HTMLDivElement>(null);
  const cardsRef = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const triggers: ScrollTrigger[] = [];

    cardsRef.current.forEach((card, i) => {
      if (!card) return;
      const feature = features[i];
      const yOffset = feature.speed * 300;

      const tl = gsap.to(card, {
        y: -yOffset,
        ease: 'none',
        scrollTrigger: {
          trigger: section,
          start: 'top top',
          end: 'bottom bottom',
          scrub: true,
        },
      });

      if (tl.scrollTrigger) {
        triggers.push(tl.scrollTrigger);
      }
    });

    return () => {
      triggers.forEach((st) => st.kill());
    };
  }, []);

  const getColumnClass = (col: number) => {
    switch (col) {
      case 1: return 'lg:col-start-1';
      case 2: return 'lg:col-start-2';
      case 3: return 'lg:col-start-3';
      default: return '';
    }
  };

  return (
    <section
      id="features"
      ref={sectionRef}
      className="relative w-full"
      style={{
        height: '300vh',
        background: 'radial-gradient(ellipse at center, rgba(155, 109, 255, 0.03) 0%, transparent 70%)',
      }}
    >
      <div className="sticky top-0 w-full h-[100dvh] overflow-hidden">
        {/* Header */}
        <div className="pt-20 pb-8 text-center relative z-10">
          <SectionHeader
            eyebrow="FEATURES"
            title="Built for Competitive Play"
            subtitle="Every feature designed to give you the edge."
          />
        </div>

        {/* Cards Grid */}
        <div className="absolute top-[200px] left-0 right-0 px-6 lg:px-12">
          <div className="max-w-[1200px] mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, i) => {
              const Icon = feature.icon;
              return (
                <div
                  key={feature.title}
                  ref={(el) => { cardsRef.current[i] = el; }}
                  className={`${getColumnClass(feature.column)} animate-float`}
                  style={{ animationDelay: `${feature.floatDelay}s` }}
                >
                  <div className="bg-[#0A0A0F] border border-[rgba(255,255,255,0.08)] rounded-xl p-8 hover:border-[rgba(255,255,255,0.15)] transition-all duration-300 hover:-translate-y-1">
                    {/* Icon */}
                    <div className="w-20 h-20 rounded-full bg-[rgba(232,93,78,0.1)] flex items-center justify-center mx-auto">
                      <Icon size={40} className="text-[#E85D4E]" strokeWidth={1.5} />
                    </div>

                    <h3 className="font-['Archivo'] text-white text-2xl text-center mt-6 tracking-tight">
                      {feature.title}
                    </h3>

                    <p className="text-[#D1D5DB] text-center mt-3 text-sm leading-relaxed">
                      {feature.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
};

export default FeaturesRacingSection;
