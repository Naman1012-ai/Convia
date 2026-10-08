import React, { useState } from 'react';
import { ChevronDown, HelpCircle, Sparkles } from 'lucide-react';

const COMPREHENSIVE_FAQS = [
  {
    q: 'What is Convia?',
    a: 'Convia is a real-time collaborative innovation platform that helps startup founders, product teams, open-source communities, and developers move from scattered ideas to a structured MVP proposal and a 16-section AI technical blueprint in minutes.',
  },
  {
    q: 'How is Convia different from Slack or Discord?',
    a: 'Chat apps are great for messaging, but key product decisions quickly get lost in chat noise. Convia provides structured proposal channels, peer refinement, and weighted democratic voting so your team aligns on priorities instantly.',
  },
  {
    q: 'How does the AI Technical Blueprint Generator work?',
    a: 'Once your team locks the winning MVP proposal, Convia analyzes the problem statement, proposed tech stack, and solution architecture to automatically generate system architecture specs, database schemas, REST endpoints, team allocations, and Kanban task backlogs.',
  },
  {
    q: 'Can I export my blueprints and task boards?',
    a: 'Yes! All AI technical blueprints, database models, API endpoint documentation, and task boards can be exported anytime as validated JSON or styled PDF documents.',
  },
  {
    q: 'Is Convia free to use?',
    a: 'Yes, Convia offers free workspaces for product teams, open-source contributors, student projects, and developer communities with full real-time collaboration features.',
  },
  {
    q: 'Can my entire team collaborate simultaneously?',
    a: 'Yes! Convia utilizes real-time cloud synchronization to deliver instant state updates across all workspace members for proposals, upvotes, comments, and live sprint task boards.',
  },
];

export function ComprehensiveFaqSection() {
  const [openIdx, setOpenIdx] = useState(0);

  const toggleFaq = (idx) => {
    setOpenIdx(openIdx === idx ? null : idx);
  };

  return (
    <section id="faq" className="py-24 bg-slate-950/95 border-b border-slate-800/80 relative">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        <div className="text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-primary-500/30 text-primary-300 text-xs font-mono font-bold">
            <HelpCircle className="h-3.5 w-3.5" />
            <span>Frequently Asked Questions</span>
          </div>

          <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
            Everything You Need To Know
          </h2>

          <p className="text-base text-slate-400 font-medium">
            Clear answers to help your team get started quickly.
          </p>
        </div>

        <div className="space-y-4">
          {COMPREHENSIVE_FAQS.map((faq, idx) => {
            const isOpen = openIdx === idx;
            return (
              <div
                key={faq.q}
                className="rounded-2xl bg-slate-900/80 border border-slate-800/80 overflow-hidden transition-all duration-200"
              >
                <button
                  onClick={() => toggleFaq(idx)}
                  className="w-full p-6 text-left flex items-center justify-between gap-4 focus:outline-none focus:bg-slate-800/50"
                  aria-expanded={isOpen}
                >
                  <h3 className="text-base sm:text-lg font-bold text-white leading-snug">
                    {faq.q}
                  </h3>
                  <div
                    className={`p-1.5 rounded-lg bg-slate-800 text-slate-300 transition-transform duration-200 shrink-0 ${
                      isOpen ? 'rotate-180 bg-primary-600/20 text-primary-300' : ''
                    }`}
                  >
                    <ChevronDown className="h-4 w-4" />
                  </div>
                </button>

                {isOpen && (
                  <div className="px-6 pb-6 pt-1 text-sm text-slate-300 leading-relaxed font-medium border-t border-slate-800/50 animate-in fade-in duration-200">
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
