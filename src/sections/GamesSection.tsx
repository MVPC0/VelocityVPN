import React from 'react';
import SectionHeader from '@/components/SectionHeader';
import { useInView } from '@/hooks/useInView';

interface Game {
  name: string;
  platforms: string[];
  image: string;
}

const games: Game[] = [
  { name: 'League of Legends', platforms: ['PC'], image: '/games/lol.jpg' },
  { name: 'Valorant', platforms: ['PC'], image: '/games/valorant.jpg' },
  { name: 'Counter-Strike 2', platforms: ['PC'], image: '/games/cs2.jpg' },
  { name: 'Fortnite', platforms: ['PC', 'PS', 'Xbox', 'Switch'], image: '/games/fortnite.jpg' },
  { name: 'Call of Duty: Warzone', platforms: ['PC', 'PS', 'Xbox'], image: '/games/warzone.jpg' },
  { name: 'Apex Legends', platforms: ['PC', 'PS', 'Xbox', 'Switch'], image: '/games/apex.jpg' },
  { name: 'PUBG', platforms: ['PC', 'PS', 'Xbox'], image: '/games/pubg.jpg' },
  { name: 'Overwatch 2', platforms: ['PC', 'PS', 'Xbox', 'Switch'], image: '/games/overwatch2.jpg' },
  { name: 'Dota 2', platforms: ['PC'], image: '/games/dota2.jpg' },
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
              {/* Game image */}
              <div className="relative aspect-video overflow-hidden">
                <img
                  src={game.image}
                  alt={game.name}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                  loading="lazy"
                />
                {/* Dark overlay on hover */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all duration-300" />
                {/* Optimized badge */}
                <div className="absolute top-3 right-3 bg-[rgba(74,222,128,0.15)] text-[#4ADE80] text-[10px] uppercase tracking-wider px-3 py-1 rounded-full opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0 backdrop-blur-sm border border-[rgba(74,222,128,0.2)]">
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
