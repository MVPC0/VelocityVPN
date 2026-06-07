import React from 'react';
import { useInView } from '@/hooks/useInView';

interface SectionHeaderProps {
  eyebrow: string;
  title: string;
  subtitle?: string;
  centered?: boolean;
  className?: string;
}

const SectionHeader: React.FC<SectionHeaderProps> = ({
  eyebrow,
  title,
  subtitle,
  centered = true,
  className = '',
}) => {
  const { ref, isInView } = useInView(0.2);

  return (
    <div
      ref={ref}
      className={`${centered ? 'text-center' : ''} ${className}`}
    >
      <span
        className={`text-eyebrow inline-block transition-all duration-700 ${
          isInView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
        }`}
      >
        {eyebrow}
      </span>
      <h2
        className={`font-['Archivo'] text-white mt-4 transition-all duration-700 delay-100 ${
          isInView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
        }`}
        style={{
          fontSize: 'clamp(40px, 5vw, 64px)',
          letterSpacing: '-0.03em',
          lineHeight: 1.0,
        }}
      >
        {title}
      </h2>
      {subtitle && (
        <p
          className={`mt-4 text-[#9CA3AF] transition-all duration-700 delay-200 ${
            centered ? 'mx-auto' : ''
          } ${isInView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}
          style={{
            fontSize: 'clamp(16px, 1.5vw, 18px)',
            maxWidth: centered ? '640px' : 'none',
            lineHeight: 1.6,
          }}
        >
          {subtitle}
        </p>
      )}
    </div>
  );
};

export default SectionHeader;
