import { useNavigate } from 'react-router';
import { ChevronLeft, Check, Shield, Zap, Users, Gamepad2, Wifi, ArrowRight } from 'lucide-react';

const plans = [
  {
    name: 'Free',
    price: 0,
    period: '/month',
    desc: 'Use with any free provider. No limits.',
    features: [
      'Works with free providers (ProtonVPN, Windscribe, Hide.me)',
      '18 server locations on dashboard',
      'Real-time ping testing',
      'Heat map with lobby vibes',
      '24 game trackers',
      'IP & leak testing tools',
      'Unlimited configs',
      'No ads, no tracking',
    ],
    popular: true,
  },
  {
    name: 'Premium',
    price: 4.99,
    period: '/month',
    badge: 'OR USE ANY PROVIDER',
    desc: 'Support development. Unlock extras.',
    features: [
      'Everything in Free',
      'Connection analytics & history',
      'Advanced speed test graphs',
      'Custom config templates',
      'Priority support',
      'Early access to new features',
    ],
    popular: false,
  },
];

export default function Pricing() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#050507] text-white">
      <header className="border-b border-[rgba(255,255,255,0.08)] bg-[rgba(5,5,7,0.95)] backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-[1200px] mx-auto px-6 h-14 flex items-center justify-between">
          <button onClick={() => navigate('/')} className="text-[#6B7280] hover:text-white transition-colors flex items-center gap-2 text-sm">
            <ChevronLeft size={18} /> Back
          </button>
          <span className="font-['Archivo'] font-bold text-lg">VELOCITY<span className="text-[#E85D4E]">VPN</span></span>
          <span className="text-xs text-[#6B7280] bg-[#111118] px-3 py-1.5 rounded-lg">Pricing</span>
        </div>
      </header>

      <div className="max-w-[1200px] mx-auto px-6 py-16">
        <div className="text-center mb-8">
          <span className="text-eyebrow">PRICING</span>
          <h1 className="font-['Archivo'] text-white mt-4 text-5xl tracking-tight">VelocityVPN is Free</h1>
          <p className="mt-4 text-[#9CA3AF] max-w-lg mx-auto">
            The dashboard is free forever. Bring your own VPN provider — free or paid, your choice.
          </p>
        </div>

        {/* Provider Banner */}
        <div className="bg-[rgba(74,222,128,0.05)] border border-[rgba(74,222,128,0.15)] rounded-2xl p-6 mb-12 max-w-2xl mx-auto flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-[rgba(74,222,128,0.1)] flex items-center justify-center shrink-0">
            <Wifi size={22} className="text-[#4ADE80]" />
          </div>
          <div className="text-left">
            <h3 className="text-sm font-semibold text-[#4ADE80]">Free VPN Providers Supported</h3>
            <p className="text-xs text-[#9CA3AF] mt-1">
              Use ProtonVPN, Windscribe (10GB), Hide.me (10GB), or PrivadoVPN (10GB) at zero cost. 
              Or connect any paid provider — Mullvad, IVPN, NordVPN, etc.
            </p>
          </div>
          <ArrowRight size={18} className="text-[#4ADE80] shrink-0" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-20 max-w-3xl mx-auto">
          {plans.map((plan) => (
            <div key={plan.name} className={`bg-[#0A0A0F] border rounded-2xl p-8 ${plan.popular ? 'border-[#4ADE80]' : 'border-[rgba(255,255,255,0.08)]'}`}>
              {plan.popular && (
                <span className="bg-[#4ADE80] text-[#050507] text-xs font-bold px-4 py-1 rounded-full uppercase">Recommended</span>
              )}
              {plan.badge && !plan.popular && (
                <span className="bg-[rgba(155,109,255,0.1)] text-[#9B6DFF] text-xs font-bold px-3 py-1 rounded-full border border-[rgba(155,109,255,0.2)]">{plan.badge}</span>
              )}

              <h3 className="font-['Archivo'] text-2xl mt-4">{plan.name}</h3>
              <div className="mt-3 flex items-baseline gap-1">
                <span className="text-4xl font-['Archivo']">${plan.price}</span>
                <span className="text-[#6B7280] text-sm">{plan.period}</span>
              </div>
              <p className="mt-2 text-sm text-[#6B7280]">{plan.desc}</p>

              <button
                onClick={() => navigate('/dashboard')}
                className={`mt-6 w-full py-3.5 rounded-lg font-medium text-sm uppercase tracking-wider ${
                  plan.popular ? 'bg-[#4ADE80] hover:bg-[#3ECF71] text-[#050507]' : 'bg-[#111118] border border-[rgba(255,255,255,0.15)] hover:border-[#9B6DFF] text-white'
                } transition-all cursor-pointer`}
              >
                {plan.name === 'Free' ? 'Get Started Free' : 'Go Premium'}
              </button>

              <ul className="mt-6 space-y-2">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-[#D1D5DB]">
                    <Check size={14} className="text-[#4ADE80] shrink-0 mt-0.5" /> {f}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-t border-[rgba(255,255,255,0.08)] pt-12">
          <h2 className="font-['Archivo'] text-2xl text-center mb-8">How It Works</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { icon: Users, title: 'Pick a Provider', desc: 'Free or paid VPN' },
              { icon: Zap, title: 'Add Your Config', desc: 'Paste server details' },
              { icon: Gamepad2, title: 'Generate Config', desc: 'Download .conf file' },
              { icon: Shield, title: 'Import & Connect', desc: 'WireGuard app' },
            ].map((f) => (
              <div key={f.title} className="text-center">
                <div className="w-12 h-12 rounded-full bg-[rgba(232,93,78,0.1)] flex items-center justify-center mx-auto mb-3">
                  <f.icon size={20} className="text-[#E85D4E]" />
                </div>
                <h4 className="text-sm font-medium">{f.title}</h4>
                <p className="text-xs text-[#6B7280]">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-16 border-t border-[rgba(255,255,255,0.08)] pt-12 max-w-[700px] mx-auto">
          <h2 className="font-['Archivo'] text-2xl text-center mb-8">Questions</h2>
          <div className="space-y-4">
            {[
              { q: 'Is VelocityVPN actually free?', a: 'Yes. The dashboard is 100% free. You bring your own VPN provider. Many excellent free providers are supported.' },
              { q: 'Do I need to pay for a VPN provider?', a: 'No. ProtonVPN, Windscribe, Hide.me, and PrivadoVPN all offer free tiers that work perfectly with VelocityVPN.' },
              { q: 'What does the Premium plan add?', a: 'Premium supports development and unlocks analytics, advanced graphs, custom templates, and priority support. The core dashboard is fully free.' },
              { q: 'Will this work on my device?', a: 'Yes. The dashboard works in any browser. Generated configs import into WireGuard on Windows, macOS, Linux, iOS, Android, and routers.' },
              { q: 'Do you log my activity?', a: 'No. We have no servers, no network, and no ability to log anything. Your traffic goes directly to your chosen provider.' },
            ].map(({ q, a }) => (
              <div key={q} className="bg-[#0A0A0F] border border-[rgba(255,255,255,0.08)] rounded-xl p-5">
                <h4 className="font-medium text-white text-sm mb-1">{q}</h4>
                <p className="text-sm text-[#9CA3AF]">{a}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
