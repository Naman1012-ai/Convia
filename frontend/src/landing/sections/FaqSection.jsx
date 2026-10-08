import React, { useState } from 'react';
import { ChevronDown, HelpCircle } from 'lucide-react';

const FAQS = [
  {
    q: 'Is Convia free to use for developer teams?',
    a: 'Yes! Convia is 100% free for developers, engineering teams, and open-source contributors. You can create workspaces and proposals with zero friction.',
  },
  {
    q: 'How does the AI Technical Blueprint Generator work?',
    a: 'Once your workspace lead selects the winning MVP proposal, Convia analyzes the problem statement, proposed solution, and tech stack to automatically generate system architecture specs, database schemas, REST/GraphQL endpoints, and populates your sprint Kanban board.',
  },
  {
    q: 'Can I invite external teammates to my workspace?',
    a: 'Absolutely. You can share your workspace Join Code or invite teammates directly via email. Workspace owners have full administrative controls over member roles and permissions.',
  },
  {
    q: 'What happens to our project data when a sprint ends?',
    a: 'All project data, ideas, blueprints, tasks, and telemetry remain permanently saved in your workspace. You can export your data anytime or convert your MVP into an ongoing open-source repository or product project.',
  },
  {
    q: 'Can I explore public ideas from other builders?',
    a: 'Yes! Convia includes a global Explore Ideas surface where innovators publish open concepts. You can upvote, comment, or import public proposals directly into your workspace.',
  },
];

export function FaqSection() {
  const [openIdx, setOpenIdx] = useState(0);

  const toggleFaq = (idx) => {
    setOpenIdx(openIdx === idx ? null : idx);
  };

  return (
    <section id="legacy-faq" className="py-24 bg-slate-950/90 border-t border-slate-800/80 relative">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        <div className="text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-primary-500/30 text-primary-300 text-xs font-mono font-bold">
            <HelpCircle className="h-3.5 w-3.5" />
            <span>Got Questions?</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
            Frequently Asked Questions
          </h2>
          <p className="text-base text-slate-400 font-medium">
            Everything you need to know about Convia.
          </p>
        </div>

        <div className="space-y-4">
          {FAQS.map((faq, idx) => {
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
                  <div className={`p-1.5 rounded-lg bg-slate-800 text-slate-300 transition-transform duration-200 shrink-0 ${isOpen ? 'rotate-180 bg-primary-600/20 text-primary-300' : ''}`}>
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
