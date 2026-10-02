import React from 'react';
import { ShieldCheck, Lock, Key, EyeOff, Database, Server } from 'lucide-react';

const SECURITY_ITEMS = [
  { title: 'Realtime Firebase Sync', icon: Database, desc: 'Sub-second data synchronization backed by Google Cloud Firebase infrastructure.' },
  { title: 'Secure Authentication', icon: Lock, desc: 'Firebase Auth credentials with Google OAuth popup & password reauthentication protection.' },
  { title: 'Role-Based Permissions', icon: Key, desc: 'Granular permissions for Workspace Owners, Members, and Platform Administrators.' },
  { title: 'Workspace Privacy', icon: EyeOff, desc: 'Private workspaces restricted to validated members with unique 6-character Join Codes.' },
  { title: 'Data Protection', icon: ShieldCheck, desc: 'Client sanitization, input validation, and atomic RTDB security rules.' },
  { title: 'Enterprise Ready', icon: Server, desc: 'Built-in platform audit logging, rate limiting, and automated feature flag controls.' },
];

export function SecurityReliabilitySection() {
  return (
    <section className="py-24 bg-slate-950/90 border-b border-slate-800/80 relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
        <div className="text-center space-y-4 max-w-3xl mx-auto">
          <span className="px-3 py-1 rounded-full bg-slate-900 border border-primary-500/30 text-primary-300 text-xs font-mono font-bold">
            Infrastructure & Security
          </span>

          <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
            Security & Reliability First
          </h2>

          <p className="text-base text-slate-400 font-medium">
            Built on enterprise-grade infrastructure to protect your intellectual property and project data.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {SECURITY_ITEMS.map((item) => {
            const IconComp = item.icon;
            return (
              <div
                key={item.title}
                className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800/80 hover:border-primary-500/40 shadow-xl space-y-3 hover:-translate-y-1 transition-all duration-300 group"
              >
                <div className="p-3 rounded-xl bg-primary-500/10 text-primary-400 border border-primary-500/20 w-fit group-hover:scale-110 transition-transform">
                  <IconComp className="h-5 w-5" />
                </div>
                <h3 className="text-base font-extrabold text-white">{item.title}</h3>
                <p className="text-xs text-slate-300 leading-relaxed font-medium">
                  {item.desc}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
