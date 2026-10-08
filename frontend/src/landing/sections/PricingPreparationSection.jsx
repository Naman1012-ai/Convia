import React from 'react';
import { Link } from 'react-router-dom';
import { Check, Sparkles, Zap, ShieldCheck, ArrowRight } from 'lucide-react';

const PRICING_PLANS = [
  {
    name: 'Free Developer Plan',
    price: '$0',
    period: 'Always Free',
    badge: 'Popular',
    desc: 'Everything you need to turn raw ideas into actionable technical MVPs.',
    features: [
      'Team Workspaces',
      'Real-Time Ideation & Upvoting',
      'AI Technical PRD & Schema Engine',
      'Auto-Populated Kanban Sprint Tasks',
      'Public Innovation Feed & Imports',
    ],
    ctaText: 'Create Free Workspace',
    ctaLink: '/signup',
    isFree: true,
  },
  {
    name: 'Pro / Builder Team',
    price: 'Coming Soon',
    period: 'Future Growth',
    badge: 'In Progress',
    desc: 'Advanced GitHub integration, two-way issue sync, and custom webhooks.',
    features: [
      'Everything in Free Plan',
      'GitHub & GitLab Two-Way Sync',
      'Discord & Slack Bot Notifications',
      'Priority AI Blueprint Processing',
      'Export Pitch Deck Presentations',
    ],
    ctaText: 'Join Waiting List',
    isComingSoon: true,
  },
  {
    name: 'Enterprise / Incubators',
    price: 'Coming Soon',
    period: 'Custom SLAs',
    badge: 'Enterprise',
    desc: 'Dedicated cloud instances, SSO/SAML authentication, and custom SLAs.',
    features: [
      'Dedicated Private Cloud Instance',
      'SSO & SAML Enterprise Auth',
      'Custom SLA & Support Engineering',
      'Immutable Audit & Compliance Logs',
      'Custom AI Model Training',
    ],
    ctaText: 'Contact Enterprise',
    isComingSoon: true,
  },
];

export function PricingPreparationSection() {
  return (
    <section id="legacy-pricing" className="py-24 bg-slate-950 border-b border-slate-800/80 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
        <div className="text-center space-y-4 max-w-3xl mx-auto">
          <span className="px-3 py-1 rounded-full bg-slate-900 border border-primary-500/30 text-primary-300 text-xs font-mono font-bold">
            Transparent Pricing Structure
          </span>

          <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
            Free For Builders. Built For Scale.
          </h2>

          <p className="text-base text-slate-400 font-medium">
            Convia is 100% free for developers and agile teams. Advanced enterprise plans are coming soon.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {PRICING_PLANS.map((plan) => (
            <div
              key={plan.name}
              className={`p-8 rounded-3xl border shadow-2xl flex flex-col justify-between space-y-6 relative ${
                plan.isFree
                  ? 'bg-gradient-to-b from-primary-950/80 via-slate-900 to-primary-900/60 border-primary-500/60 shadow-primary-950/50 scale-105'
                  : 'bg-slate-900/60 border-slate-800/80 opacity-90'
              }`}
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-extrabold text-white">{plan.name}</h3>
                  <span
                    className={`px-2.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                      plan.isFree
                        ? 'bg-primary-500/20 text-primary-300 border border-primary-500/40'
                        : 'bg-slate-950 text-slate-400 border border-slate-800'
                    }`}
                  >
                    {plan.badge}
                  </span>
                </div>

                <div>
                  <span className="text-3xl font-extrabold text-white">{plan.price}</span>
                  <span className="text-xs text-slate-400 font-mono ml-2">/ {plan.period}</span>
                </div>

                <p className="text-xs text-slate-300 font-medium leading-relaxed">
                  {plan.desc}
                </p>

                <div className="space-y-2.5 pt-4 border-t border-slate-800/80 text-xs font-semibold text-slate-200">
                  {plan.features.map((f) => (
                    <div key={f} className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-emerald-400 shrink-0" />
                      <span>{f}</span>
                    </div>
                  ))}
                </div>
              </div>

              {plan.isFree ? (
                <Link
                  to={plan.ctaLink}
                  className="w-full inline-flex items-center justify-center gap-2 py-3.5 rounded-xl bg-gradient-to-r from-primary-600 to-primary-500 hover:from-primary-500 hover:to-primary-400 text-white font-extrabold text-xs shadow-lg transition-all"
                >
                  <span>{plan.ctaText}</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
              ) : (
                <button
                  onClick={() => alert(`${plan.name} is coming soon! Convia is currently 100% free.`)}
                  className="w-full py-3.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-400 font-bold text-xs hover:text-white transition-colors"
                >
                  {plan.ctaText} (Coming Soon)
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
