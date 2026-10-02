import React, { useState, useEffect } from 'react';
import { LegalLayout } from '../../landing/layouts/LegalLayout';
import {
  Mail,
  Copy,
  Check,
  Bug,
  Lightbulb,
  ShieldAlert,
  Zap,
  Server,
  UserCheck,
  HelpCircle,
  CheckCircle2,
  Clock,
} from 'lucide-react';

const CONTACT_CATEGORIES = [
  { title: 'Bug Report', icon: Bug, desc: 'Found an unexpected issue, console error, or broken component flow.', color: 'border-rose-500/30 text-rose-400 bg-rose-500/10' },
  { title: 'Feature Request', icon: Lightbulb, desc: 'Have an idea to improve hackathon consensus, upvoting, or AI blueprints.', color: 'border-amber-500/30 text-amber-400 bg-amber-500/10' },
  { title: 'Security Issue', icon: ShieldAlert, desc: 'Found a vulnerability, auth leak, or permission bypass.', color: 'border-primary-500/40 text-primary-300 bg-primary-500/20' },
  { title: 'Performance Problem', icon: Zap, desc: 'Encountered latency, slow RTDB sync, or UI lag during sprints.', color: 'border-sky-500/30 text-sky-400 bg-sky-500/10' },
  { title: 'Deployment Issue', icon: Server, desc: 'Questions regarding environment build, hosting, or API endpoints.', color: 'border-primary-500/30 text-primary-400 bg-primary-500/10' },
  { title: 'Account Issue', icon: UserCheck, desc: 'Need help with reauthentication, password reset, or workspace transfer.', color: 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10' },
  { title: 'General Question', icon: HelpCircle, desc: 'General engineering inquiries or university hackathon partnerships.', color: 'border-slate-700 text-slate-300 bg-slate-800/50' },
];

export default function ContactEngineeringPage() {
  const [copied, setCopied] = useState(false);
  const supportEmail = 'demo.projects1012@gmail.com';

  useEffect(() => {
    document.title = 'Contact Engineering — Convia';
  }, []);

  const handleCopyEmail = () => {
    navigator.clipboard.writeText(supportEmail);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <LegalLayout
      title="Contact Engineering"
      subtitle="Need technical help, found a bug, or have an engineering question? We'd love to hear from you."
      lastUpdated="July 24, 2026"
    >
      <div className="space-y-12 text-slate-300 text-sm leading-relaxed font-medium">
        {/* Engineering Support Overview */}
        <section className="p-7 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-3">
          <h2 className="text-xl font-extrabold text-white">Engineering Support</h2>
          <p>
            Our core engineering team directly reviews reports related to platform stability, software bugs, feature suggestions, performance bottlenecks, accessibility compliance, and security disclosures.
          </p>
        </section>

        {/* Support Email Card */}
        <section className="p-8 rounded-3xl bg-gradient-to-r from-primary-950/90 via-slate-900 to-primary-950/90 border border-primary-500/50 shadow-2xl space-y-6">
          <div className="space-y-2">
            <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-primary-500/20 text-primary-300 border border-primary-500/40">
              Primary Support Channel
            </span>
            <h3 className="text-2xl font-extrabold text-white">Send Us An Email</h3>
            <p className="text-xs text-slate-300">
              Copy our official support address or open your native mail client directly.
            </p>
          </div>

          <div className="p-4 sm:p-5 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3 text-sm sm:text-base font-mono text-primary-300 font-extrabold truncate w-full sm:w-auto">
              <Mail className="h-5 w-5 text-primary-400 shrink-0" />
              <span className="truncate">{supportEmail}</span>
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto shrink-0">
              <button
                onClick={handleCopyEmail}
                className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-bold text-slate-200 transition-all focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                <span>{copied ? 'Copied!' : 'Copy Email'}</span>
              </button>

              <a
                href={`mailto:${supportEmail}`}
                className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-500 text-white font-extrabold text-xs shadow-lg shadow-primary-600/30 transition-all focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <span>Open Mail Client</span>
              </a>
            </div>
          </div>
        </section>

        {/* Support Categories Grid */}
        <section className="space-y-6">
          <div className="space-y-1">
            <h3 className="text-xl font-extrabold text-white">Contact Categories</h3>
            <p className="text-xs text-slate-400">Specify the category in your email subject line for faster routing.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {CONTACT_CATEGORIES.map((cat) => {
              const IconComp = cat.icon;
              return (
                <div
                  key={cat.title}
                  className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-primary-500/40 space-y-2.5 transition-all"
                >
                  <div className={`p-2.5 rounded-xl border ${cat.color} w-fit`}>
                    <IconComp className="h-5 w-5" />
                  </div>
                  <h4 className="text-base font-extrabold text-white">{cat.title}</h4>
                  <p className="text-xs text-slate-300 leading-relaxed font-medium">
                    {cat.desc}
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        {/* Expected Response Time */}
        <section className="p-7 rounded-3xl bg-slate-900/80 border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="text-base font-extrabold text-white flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary-400" />
              Expected Response Time
            </h3>
            <p className="text-xs text-slate-300 font-medium">
              Typical response time: <strong className="text-primary-300 font-bold">1–3 business days</strong>. Critical security disclosures are prioritized immediately.
            </p>
          </div>

          <span className="px-3 py-1.5 rounded-xl bg-primary-500/20 text-primary-300 border border-primary-500/30 text-xs font-mono font-bold shrink-0">
            Priority SLA Enabled
          </span>
        </section>

        {/* Before Contacting Us Checklist */}
        <section className="p-7 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-4">
          <h3 className="text-xl font-extrabold text-white">Before Contacting Us Checklist</h3>
          <p className="text-xs text-slate-400">Including these details in your message helps us debug and resolve issues much faster:</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
            {[
              'Screenshots or screen recording of the issue',
              'Browser name and version (e.g. Chrome v126)',
              'Device type and operating system',
              'Step-by-step instructions to reproduce',
              'Workspace ID or Organization Join Code (if applicable)',
              'Console error message trace or traceback text',
            ].map((item) => (
              <div key={item} className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 flex items-center gap-2 text-slate-200">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </LegalLayout>
  );
}
