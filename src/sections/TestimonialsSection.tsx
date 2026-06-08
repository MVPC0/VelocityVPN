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
    quote: "My ping dropped from 85ms to 22ms on Valorant. I climbed from Gold to Diamond in two weeks. This is literally a competitive advantage.",
    name: "Marcus Chen",
    role: "Competitive FPS Player",
    game: "Valorant / CS2",
    initials: "MC",
    bgColor: "bg-[#1a3a5c]",
  },
  {
    quote: "I stream tournaments and VelocityVPN's DDoS protection has saved my broadcast three times. No more getting knocked offline mid-match.",
    name: "Sarah Williams",
    role: "Twitch Streamer",
    game: "League of Legends",
    initials: "SW",
    bgColor: "bg-[#3a1a3a]",
  },
  {
    quote: "Playing on EU servers from the US used to be a nightmare. Now I get 45ms ping to Frankfurt. My squad doesn't even know I'm not local.",
    name: "Alex Rivera",
    role: "Battle Royale Player",
    game: "Warzone / Apex",
    initials: "AR",
    bgColor: "bg-[#1a3a1a]",
  },
  {
    quote: "The auto-optimization is magic. I don't touch any settings — it just works. Every game I play gets the best route automatically.",
    name: "Jordan Park",
    role: "Casual Gamer",
    game: "Fortnite / Overwatch",
    initials: "JP",
    bgColor: "bg-[#3a2a1a]",
  },
  {
    quote: "As a pro player, every millisecond counts. VelocityVPN gives me the stable, low-latency connection I need for tournament practice.",
    name: "Kim Nakamura",
    role: "Esports Professional",
    game: "Dota 2",
    initials: "KN",
    bgColor: "bg-[#1a1a3a]",
  },
  {
    quote: "Split tunneling is the feature I didn't know I needed. Game traffic goes through VPN, Discord stays local. Best of both worlds.",
    name: "David Okafor",
    role: "Content Creator",
    game: "PUBG / Escape from Tarkov",
    initials: "DO",
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
          eyebrow="REVIEWS"
          title="What Gamers Say"
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
