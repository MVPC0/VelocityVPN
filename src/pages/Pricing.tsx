import { useNavigate } from 'react-router';
import { ChevronLeft, Check, Shield, Clock, Users, Zap } from 'lucide-react';

const plans = [
  {
    name: 'Monthly',
    price: 12.99,
    period: '/month',
    desc: 'Flexible. Cancel anytime.',
    features: ['All 34 servers', 'WireGuard', 'DDoS protection', 'Kill switch', '5 devices'],
    popular: false,
  },
  {
    name: '1 Year',
    price: 5.99,
    period: '/month',
    badge: 'SAVE 54%',
    desc: '$71.88 billed annually.',
    features: ['All 34 servers', 'All protocols', 'DDoS protection', 'Kill switch', '10 devices', 'Port forwarding'],
    popular: true,
  },
  {
    name: '2 Years',
    price: 3.99,
    period: '/month',
    badge: 'SAVE 69%',
    desc: '$95.76 billed every 2 years.',
    features: ['All 34 servers', 'All protocols', 'DDoS protection', 'Kill switch', 'Unlimited devices', 'Port forwarding', 'Dedicated IP'],
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
          <span className="font-['Archivo'] font-bold text-lg">VELOCIT<span className="text-[#E85D4E]">VPN</span></span>
          <span className="text-xs text-[#6B7280] bg-[#111118] px-3 py-1.5 rounded-lg">Pricing</span>
        </div>
      </header>

      <div className="max-w-[1200px] mx-auto px-6 py-16">
        <div className="text-center mb-12">
          <span className="text-eyebrow">PRICING</span>
          <h1 className="font-['Archivo'] text-white mt-4 text-5xl tracking-tight">Choose Your Plan</h1>
          <p className="mt-4 text-[#9CA3AF]">All plans include every feature. No hidden fees.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-20">
          {plans.map((plan) => (
            <div key={plan.name} className={`bg-[#0A0A0F] border rounded-2xl p-8 ${plan.popular ? 'border-[#E85D4E]' : 'border-[rgba(255,255,255,0.08)]'}`}>
              {plan.popular && (
                <span className="bg-[#E85D4E] text-white text-xs font-bold px-4 py-1 rounded-full uppercase">Most Popular</span>
              )}
              {plan.badge && !plan.popular && (
                <span className="bg-[rgba(74,222,128,0.1)] text-[#4ADE80] text-xs font-bold px-3 py-1 rounded-full border border-[rgba(74,222,128,0.2)]">{plan.badge}</span>
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
                  plan.popular ? 'bg-[#E85D4E] hover:bg-[#D44A3C] text-white' : 'bg-[#111118] border border-[rgba(255,255,255,0.15)] hover:border-[#E85D4E] text-white'
                } transition-all`}
              >
                Select {plan.name}
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
          <h2 className="font-['Archivo'] text-2xl text-center mb-8">Every Plan Includes</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { icon: Zap, title: 'Gaming-Optimized', desc: 'WireGuard protocol' },
              { icon: Shield, title: 'DDoS Protection', desc: 'Your IP stays hidden' },
              { icon: Users, title: '34 Locations', desc: 'Play worldwide' },
              { icon: Clock, title: '30-Day Guarantee', desc: 'Full refund' },
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
              { q: 'Can I switch plans later?', a: 'Yes. Upgrade, downgrade, or cancel anytime from your dashboard.' },
              { q: 'Is there a money-back guarantee?', a: 'Absolutely. Full refund within 30 days if you are not satisfied.' },
              { q: 'What payment methods are accepted?', a: 'Credit cards, PayPal, and cryptocurrency.' },
              { q: 'Will this work on my device?', a: 'Yes. Windows, macOS, Linux, iOS, Android, and routers.' },
              { q: 'Do you log my activity?', a: 'No. Strict no-logs policy. We do not track or store anything.' },
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
