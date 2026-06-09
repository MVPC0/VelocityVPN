import React, { useState, lazy, Suspense } from "react";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import CTASection from "@/sections/CTASection";

const HeroSection = lazy(() => import("@/sections/HeroSection"));
const SpeedStepsSection = lazy(() => import("@/sections/SpeedStepsSection"));
const GlobalMapSection = lazy(() => import("@/sections/GlobalMapSection"));
const PingTestSection = lazy(() => import("@/sections/PingTestSection"));
const GamesSection = lazy(() => import("@/sections/GamesSection"));
const FeaturesRacingSection = lazy(() => import("@/sections/FeaturesRacingSection"));
const TestimonialsSection = lazy(() => import("@/sections/TestimonialsSection"));

const PageLoader: React.FC<{ onComplete: () => void }> = ({ onComplete }) => {
  const [progress, setProgress] = useState(0);
  React.useEffect(() => {
    const duration = 1500;
    const start = Date.now();
    const update = () => {
      const elapsed = Date.now() - start;
      const p = Math.min(100, Math.floor((elapsed / duration) * 100));
      setProgress(p);
      if (p >= 100) setTimeout(onComplete, 300);
      else requestAnimationFrame(update);
    };
    requestAnimationFrame(update);
  }, [onComplete]);

  return (
    <div className={`fixed inset-0 z-[1000] bg-[#050507] flex flex-col items-center justify-center ${progress >= 100 ? "opacity-0 translate-y-[-100%]" : "opacity-100"}`}>
      <div className="font-['Archivo'] text-white text-3xl md:text-5xl tracking-tight">VELOCIT<span className="relative">Y<span className="absolute -right-3 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-[#E85D4E]" /></span></div>
      <div className="mt-8 font-['JetBrains_Mono'] text-[#6B7280] text-lg">{progress}%</div>
    </div>
  );
};

const SectionFallback = () => (
  <div className="w-full py-24 bg-[#0A0A0F] flex items-center justify-center">
    <div className="w-8 h-8 border-2 border-[#E85D4E] border-t-transparent rounded-full animate-spin" />
  </div>
);

const LandingPage: React.FC = () => {
  const [loading, setLoading] = useState(true);

  return (
    <>
      {loading && <PageLoader onComplete={() => setLoading(false)} />}
      <div className={`transition-opacity duration-500 ${loading ? "opacity-0" : "opacity-100"}`}>
        <Navigation />
        <main>
          <Suspense fallback={<SectionFallback />}><HeroSection /></Suspense>
          <Suspense fallback={<SectionFallback />}><SpeedStepsSection /></Suspense>
          <Suspense fallback={<SectionFallback />}><GlobalMapSection /></Suspense>
          <Suspense fallback={<SectionFallback />}><PingTestSection /></Suspense>
          <Suspense fallback={<SectionFallback />}><GamesSection /></Suspense>
          <Suspense fallback={<SectionFallback />}><FeaturesRacingSection /></Suspense>
          <Suspense fallback={<SectionFallback />}><TestimonialsSection /></Suspense>
        </main>
        <CTASection />
        <Footer />
      </div>
    </>
  );
};

export default LandingPage;
