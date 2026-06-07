import React, { useState, useEffect } from 'react';
import { Link } from 'react-router';
import { Menu, X, LayoutDashboard } from 'lucide-react';
import Button from './Button';
import { useAuth } from '@/hooks/useAuth';

const navLinks = [
  { label: 'How It Works', href: '#speed-steps' },
  { label: 'Servers', href: '#global-map' },
  { label: 'Ping Test', href: '#ping-test' },
  { label: 'Games', href: '#games' },
  { label: 'Features', href: '#features' },
  { label: 'Reviews', href: '#testimonials' },
];

const Navigation: React.FC = () => {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 100);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (menuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [menuOpen]);

  const scrollTo = (href: string) => {
    setMenuOpen(false);
    const el = document.querySelector(href);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <>
      <nav
        className={`fixed top-0 left-0 w-full z-50 transition-all duration-400 ${
          scrolled
            ? 'bg-[rgba(5,5,7,0.9)] backdrop-blur-xl'
            : 'bg-transparent'
        }`}
        style={{ height: '72px' }}
      >
        <div className="max-w-[1200px] mx-auto h-full flex items-center justify-between px-6 lg:px-12">
          {/* Logo */}
          <a
            href="#"
            className="font-['Archivo'] font-bold text-white text-xl tracking-tight flex items-center gap-0"
            onClick={(e) => {
              e.preventDefault();
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          >
            VELOCIT<span className="relative">
              Y
              <span
                className="absolute -right-2 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-[#E85D4E]"
              />
            </span>
          </a>

          {/* Desktop Nav Links */}
          <div className="hidden lg:flex items-center gap-8">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={(e) => {
                  e.preventDefault();
                  scrollTo(link.href);
                }}
                className="text-sm text-[#9CA3AF] hover:text-white transition-colors duration-200"
              >
                {link.label}
              </a>
            ))}
          </div>

          {/* CTA + Hamburger */}
          <div className="flex items-center gap-4">
            {isAuthenticated ? (
              <Link
                to="/dashboard"
                className="hidden sm:flex items-center gap-2 px-4 py-2 text-sm text-[#E85D4E] hover:text-white transition-colors"
              >
                <LayoutDashboard size={16} />
                Dashboard
              </Link>
            ) : (
              <div className="hidden sm:block">
                <Button variant="primary" size="sm" href="#cta">
                  Get Velocity
                </Button>
              </div>
            )}
            <button
              className="lg:hidden text-white p-2"
              onClick={() => setMenuOpen(true)}
              aria-label="Open menu"
            >
              <Menu size={24} />
            </button>
          </div>
        </div>
      </nav>

      {/* Full-Screen Menu */}
      <div
        className={`fixed inset-0 z-[100] bg-[#050507] transition-all duration-500 ${
          menuOpen
            ? 'opacity-100 pointer-events-auto'
            : 'opacity-0 pointer-events-none'
        }`}
      >
        <div className="h-full flex flex-col justify-center px-8 md:px-16 lg:px-24">
          {/* Close button */}
          <button
            className="absolute top-6 right-6 text-white p-2 flex items-center gap-2"
            onClick={() => setMenuOpen(false)}
          >
            <span className="text-sm text-[#9CA3AF]">Close</span>
            <X size={24} />
          </button>

          {/* Menu Items */}
          <div className="space-y-4">
            {navLinks.map((link, i) => (
              <a
                key={link.href}
                href={link.href}
                onClick={(e) => {
                  e.preventDefault();
                  scrollTo(link.href);
                }}
                className={`block font-['Archivo'] text-white transition-all duration-500 hover:text-[#E85D4E] ${
                  menuOpen
                    ? 'opacity-100 translate-x-0'
                    : 'opacity-0 -translate-x-8'
                }`}
                style={{
                  fontSize: 'clamp(32px, 6vw, 64px)',
                  letterSpacing: '-0.04em',
                  lineHeight: 1.1,
                  transitionDelay: menuOpen ? `${i * 60}ms` : '0ms',
                }}
              >
                {link.label}
              </a>
            ))}
          </div>

          {/* Dashboard link in menu */}
          {isAuthenticated && (
            <Link
              to="/dashboard"
              onClick={() => setMenuOpen(false)}
              className="mt-6 inline-flex items-center gap-2 text-[#E85D4E] hover:text-white transition-colors font-['Archivo'] text-xl"
            >
              <LayoutDashboard size={20} />
              Dashboard
            </Link>
          )}

          {/* Social Links */}
          <div className="absolute bottom-8 left-8 md:left-16 lg:left-24 flex gap-6">
            {['Discord', 'Twitter/X', 'Reddit'].map((social) => (
              <span
                key={social}
                className="text-xs text-[#6B7280] hover:text-white transition-colors cursor-pointer uppercase tracking-wider"
              >
                {social}
              </span>
            ))}
          </div>
        </div>
      </div>
    </>
  );
};

export default Navigation;
