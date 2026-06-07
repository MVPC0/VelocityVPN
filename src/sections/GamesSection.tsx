import React from 'react';
import SectionHeader from '@/components/SectionHeader';
import { useInView } from '@/hooks/useInView';

interface Game {
  name: string;
  platforms: string[];
  gradient: string;
}

const games: Game[] = [
  { name: 'League of Legends', platforms: ['PC'], gradient: 'from-[#091428] to-[#0A1428]' },
  { name: 'Valorant', platforms: ['PC'], gradient: 'from-[#1a1a2e] to-[#16213e]' },
  { name: 'Counter-Strike 2', platforms: ['PC'], gradient: 'from-[#1a1a1a] to-[#2d2d2d]' },
  { name: 'Fortnite', platforms: ['PC', 'PS', 'Xbox', 'Switch'], gradient: 'from-[#1a0a2e] to-[#162944]' },
  { name: 'Call of Duty: Warzone', platforms: ['PC', 'PS', 'Xbox'], gradient: 'from-[#0f2a1d] to-[#1a3a2d]' },
  { name: 'Apex Legends', platforms: ['PC', 'PS', 'Xbox', 'Switch'], gradient: 'from-[#2a1a0a] to-[#3d2a1a]' },
  { name: 'PUBG', platforms: ['PC', 'PS', 'Xbox'], gradient: 'from-[#1a1a0a] to-[#2d2d1a]' },
  { name: 'Overwatch 2', platforms: ['PC', 'PS', 'Xbox', 'Switch'], gradient: 'from-[#0a1a2e] to-[#1a2a3e]' },
  { name: 'Dota 2', platforms: ['PC'], gradient: 'from-[#2a0a0a] to-[#3d1a1a]' },
];

const platformIcons: Record<string, string> = {
  PC: '💻',
  PS: '🎮',
  Xbox: '🎯',
  Switch: '🕹️',
};

const GamesSection: React.FC = () => {
  const { ref: gridRef, isInView } = useInView(0.1);

  return (
    <section id="games" className="w-full py-16 md:py-24 bg-[#050507]">
      <div className="max-w-[1200px] mx-auto px-6 lg:px-12">
        <SectionHeader
          eyebrow="SUPPORTED GAMES"
          title="Play Every Game, Everywhere"
          subtitle="Optimized routing for the games you love. Join players in any region."
        />

        <div
          ref={gridRef}
          className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {games.map((game, i) => (
            <div
              key={game.name}
              className={`group bg-[#0A0A0F] rounded-2xl border border-[rgba(255,255,255,0.08)] overflow-hidden transition-all duration-300 hover:border-[rgba(232,93,78,0.3)] hover:-translate-y-1 hover:shadow-[0_8px_32px_rgba(0,0,0,0.4)] ${
                isInView
                  ? 'opacity-100 translate-y-0'
                  : 'opacity-0 translate-y-10'
              }`}
              style={{ transitionDelay: isInView ? `${i * 80}ms` : '0ms' }}
            >
              {/* Game image area */}
              <div className={`relative aspect-video bg-gradient-to-br ${game.gradient} overflow-hidden`}>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-5xl opacity-30 group-hover:opacity-50 group-hover:scale-110 transition-all duration-400">
                    🎮
                  </span>
                </div>
                {/* Optimized badge */}
                <div className="absolute top-3 right-3 bg-[rgba(74,222,128,0.15)] text-[#4ADE80] text-[10px] uppercase tracking-wider px-3 py-1 rounded-full opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0">
                  Optimized
                </div>
              </div>

              {/* Content */}
              <div className="p-6">
                <h3 className="font-['Archivo'] text-white text-xl tracking-tight">
                  {game.name}
                </h3>
                <div className="flex gap-2 mt-3">
                  {game.platforms.map((p) => (
                    <span key={p} className="text-[#9CA3AF] text-lg" title={p}>
                      {platformIcons[p]}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default GamesSection;
