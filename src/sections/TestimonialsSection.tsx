import React, { useState, useEffect, useCallback } from 'react';
import SectionHeader from '@/components/SectionHeader';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface Testimonial {
  quote: string;
  name: string;
  role: string;
  game: string;
  initials: string;
  bgColor: string;
}

const testimonials: Testimonial[] = [
  {
    quote: "VelocityVPN is a dashboard. It does not operate a VPN network, assign you an IP, or carry packets.",
    name: "Product fact",
    role: "What this is",
    game: "Not a carrier",
    initials: "PF",
    bgColor: "bg-[#1a3a5c]",
  },
  {
    quote: "Ping numbers on the landing page time a public website in that city. They are not ICMP pings to a Velocity node or a game server.",
    name: "Product fact",
    role: "Latency checks",
    game: "Browser timing",
    initials: "LT",
    bgColor: "bg-[#3a1a3a]",
  },
  {
    quote: "Heat-map vibes (Bot Lobby through Sweaty) are a model from estimated load. They are not live matchmaking data.",
    name: "Product fact",
    role: "Heat map",
    game: "Modeled, not live",
    initials: "HM",
    bgColor: "bg-[#1a3a1a]",
  },
  {
    quote: "Steam counts come from Steam's public API when it responds. If it fails, the panel shows an estimate and should say so.",
    name: "Product fact",
    role: "Game trackers",
    game: "Steam + estimates",
    initials: "GT",
    bgColor: "bg-[#3a2a1a]",
  },
  {
    quote: "Kill switch, split tunnel, and DDoS protection - if you have them - come from your provider and the WireGuard app.",
    name: "Product fact",
    role: "Your provider",
    game: "Not this site",
    initials: "WG",
    bgColor: "bg-[#1a1a3a]",
  },
  {
    quote: "There is no 24/7 support desk and no paid network. Guest mode unlocks the dashboard. Premium checkout is not live.",
    name: "Product fact",
    role: "Pricing & support",
    game: "Free tool",
    initials: "FR",
    bgColor: "bg-[#2a1a3a]",
  },
];

const TestimonialsSection: React.FC = () => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [direction, setDirection] = useState<'left' | 'right'>('right');
  const [isPaused, setIsPaused] = useState(false);

  const goTo = useCallback(
    (index: number, dir: 'left' | 'right') => {
      if (isAnimating || index === activeIndex) return;
      setDirection(dir);
      setIsAnimating(true);
      setTimeout(() => {
        setActiveIndex(index);
        setTimeout(() => setIsAnimating(false), 50);
      }, 300);
    },
    [isAnimating, activeIndex]
  );

  const goNext = useCallback(() => {
    const next = (activeIndex + 1) % testimonials.length;
    goTo(next, 'right');
  }, [activeIndex, goTo]);

  const goPrev = useCallback(() => {
    const prev = (activeIndex - 1 + testimonials.length) % testimonials.length;
    goTo(prev, 'left');
  }, [activeIndex, goTo]);

  // Auto-advance
  useEffect(() => {
    if (isPaused) return;
    const timer = setInterval(goNext, 6000);
    return () => clearInterval(timer);
  }, [isPaused, goNext]);

  const current = testimonials[activeIndex];

  return (
    <section
      id="testimonials"
      className="w-full py-20 md:py-28 bg-[#0A0A0F] border-t border-[rgba(255,255,255,0.08)]"
    >
      <div className="max-w-[1000px] mx-auto px-6 lg:px-12">
        <SectionHeader
          eyebrow="STRAIGHT TALK"
          title="No fake reviews"
          centered
        />

        {/* Carousel */}
        <div
          className="mt-16 relative"
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
        >
          {/* Quote */}
          <div className="relative overflow-hidden min-h-[300px]">
            <div
              className={`transition-all duration-400 ${
                isAnimating
                  ? direction === 'right'
                    ? 'opacity-0 -translate-x-12'
                    : 'opacity-0 translate-x-12'
                  : 'opacity-100 translate-x-0'
              }`}
            >
              <div className="text-center">
                {/* Large quote mark */}
                <span className="text-[#E85D4E] text-8xl font-['Archivo'] leading-none select-none">
                  &ldquo;
                </span>

                <p
                  className="font-['Archivo'] text-white italic -mt-6"
                  style={{
                    fontSize: 'clamp(22px, 3vw, 36px)',
                    lineHeight: 1.3,
                    letterSpacing: '-0.02em',
                  }}
                >
                  {current.quote}
                </p>

                {/* Avatar */}
                <div className="mt-10 flex flex-col items-center">
                  <div
                    className={`w-16 h-16 rounded-full ${current.bgColor} border-2 border-[rgba(255,255,255,0.08)] flex items-center justify-center`}
                  >
                    <span className="font-['Archivo'] text-white text-xl">{current.initials}</span>
                  </div>
                  <p className="mt-4 text-white font-medium text-lg">{current.name}</p>
                  <p className="text-[#E85D4E] text-sm">{current.role}</p>
                  <p className="text-[#6B7280] text-xs uppercase tracking-wider mt-1">
                    {current.game}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Navigation Arrows */}
          <button
            onClick={goPrev}
            disabled={isAnimating}
            className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 md:-translate-x-12 w-12 h-12 rounded-full border border-[rgba(255,255,255,0.08)] flex items-center justify-center text-white hover:bg-[#E85D4E] hover:border-[#E85D4E] transition-all duration-200 disabled:opacity-30"
          >
            <ChevronLeft size={20} />
          </button>
          <button
            onClick={goNext}
            disabled={isAnimating}
            className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 md:translate-x-12 w-12 h-12 rounded-full border border-[rgba(255,255,255,0.08)] flex items-center justify-center text-white hover:bg-[#E85D4E] hover:border-[#E85D4E] transition-all duration-200 disabled:opacity-30"
          >
            <ChevronRight size={20} />
          </button>

          {/* Dot Indicators */}
          <div className="flex justify-center gap-2 mt-10">
            {testimonials.map((_, i) => (
              <button
                key={i}
                onClick={() => goTo(i, i > activeIndex ? 'right' : 'left')}
                className={`w-2 h-2 rounded-full transition-all duration-300 ${
                  i === activeIndex
                    ? 'bg-[#E85D4E] scale-125'
                    : 'bg-[rgba(255,255,255,0.08)] hover:bg-[rgba(255,255,255,0.2)]'
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default TestimonialsSection;
