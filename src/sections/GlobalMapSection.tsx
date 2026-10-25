import React from 'react';
import SectionHeader from '@/components/SectionHeader';
import CountUp from 'react-countup';
import WorldDotMap from '@/components/WorldDotMap';
import { MAP_CITIES, MAP_CITY_COUNT, MAP_CONTINENT_COUNT } from '@/lib/world-map';

const GlobalMapSection: React.FC = () => {
  const stats = [
    { value: MAP_CITY_COUNT, suffix: '', label: 'City labels', color: 'text-[#9B6DFF]' },
    { value: MAP_CONTINENT_COUNT, suffix: '', label: 'Continents', color: 'text-[#A3B8D4]' },
    { value: 25, suffix: '', label: 'Game Titles', color: 'text-[#E85D4E]' },
    { value: 7, suffix: '', label: 'VPN Providers', color: 'text-[#4ADE80]' },
  ];

  return (
    <section
      id="global-map"
      // Positioned above the fixed hero globe canvas (z-index 1) so it can't bleed through.
      className="relative z-[2] w-full py-24 md:py-36 bg-[var(--black)]"
      style={{
        boxShadow: 'inset 0 0 200px rgba(155, 109, 255, 0.05)',
      }}
    >
      <div className="max-w-[1200px] mx-auto px-6 lg:px-12">
        <SectionHeader
          eyebrow="REFERENCE REGIONS"
          title={`${MAP_CITY_COUNT} cities on the map`}
          subtitle="City labels for latency checks. VelocityVPN does not operate these as VPN nodes - your tunnel uses your provider's servers."
        />

        <div className="mt-16 max-w-[1200px] mx-auto">
          <WorldDotMap cities={MAP_CITIES} arcs />
          <p className="mt-3 text-center text-[11px] text-[#6B7280] sm:hidden">
            Tap a dot to see the city name.
          </p>
        </div>

        <div className="mt-12 flex flex-wrap justify-center gap-8 md:gap-16">
          {stats.map((stat) => (
            <div key={stat.label} className="text-center">
              <div className={`font-['JetBrains_Mono'] text-3xl md:text-4xl ${stat.color}`}>
                <CountUp end={stat.value} duration={2} suffix={stat.suffix} />
              </div>
              <div className="text-eyebrow mt-2 text-[10px] text-[#6B7280]">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default GlobalMapSection;
