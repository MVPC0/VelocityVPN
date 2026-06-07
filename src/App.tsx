import React, { useEffect, useState } from 'react';
import Navigation from '@/components/Navigation';
import Footer from '@/components/Footer';
import HeroSection from '@/sections/HeroSection';
import SpeedStepsSection from '@/sections/SpeedStepsSection';
import GlobalMapSection from '@/sections/GlobalMapSection';
import PingTestSection from '@/sections/PingTestSection';
import GamesSection from '@/sections/GamesSection';
import FeaturesRacingSection from '@/sections/FeaturesRacingSection';
import TestimonialsSection from '@/sections/TestimonialsSection';
import CTASection from '@/sections/CTASection';

const PageLoader: React.FC<{ onComplete: () => void }> = ({ onComplete }) => {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const duration = 1500;
    const start = Date.now();

    const update = () => {
      const elapsed = Date.now() - start;
      const p = Math.min(100, Math.floor((elapsed / duration) * 100));
      setProgress(p);

      if (p >= 100) {
        setTimeout(onComplete, 300);
      } else {
        requestAnimationFrame(update);
      }
    };

    requestAnimationFrame(update);
  }, [onComplete]);

  return (
    <div
      className={`fixed inset-0 z-[1000] bg-[#050507] flex flex-col items-center justify-center transition-all duration-800 ${
        progress >= 100 ? 'opacity-0 translate-y-[-100%]' : 'opacity-100'
      }`}
    >
      <div className="font-['Archivo'] text-white text-3xl md:text-5xl tracking-tight">
        VELOCIT
        <span className="relative">
          Y
          <span className="absolute -right-3 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-[#E85D4E]" />
        </span>
      </div>
      <div className="mt-8 font-['JetBrains_Mono'] text-[#6B7280] text-lg">
        {progress}%
      </div>
      {/* Scan line */}
      <div
        className="absolute left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#E85D4E] to-transparent opacity-30"
        style={{
          animation: 'scanLine 2s ease-in-out infinite',
          top: `${progress}%`,
        }}
      />
      <style>{`
        @keyframes scanLine {
          0%, 100% { opacity: 0; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
};

const App: React.FC = () => {
  const [loading, setLoading] = useState(true);

  return (
    <>
      {loading && <PageLoader onComplete={() => setLoading(false)} />}

      <div className={`transition-opacity duration-500 ${loading ? 'opacity-0' : 'opacity-100'}`}>
        <Navigation />

        <main>
          <HeroSection />
          <SpeedStepsSection />
          <GlobalMapSection />
          <PingTestSection />
          <GamesSection />
          <FeaturesRacingSection />
          <TestimonialsSection />
          <CTASection />
        </main>

        <Footer />
      </div>
    </>
  );
};

export default App;
