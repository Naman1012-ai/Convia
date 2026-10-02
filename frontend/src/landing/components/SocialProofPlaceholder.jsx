import React from 'react';
import { Award, GraduationCap, Users, Shield, Sparkles } from 'lucide-react';

export function SocialProofPlaceholder() {
  return (
    <div className="rounded-2xl border border-slate-800/80 bg-slate-950/60 p-6 backdrop-blur-md">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3 text-left">
          <div className="p-2.5 rounded-xl bg-primary-500/10 text-primary-400 border border-primary-500/20 shrink-0">
            <Award className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-white">Partner & Hackathon Network</span>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                Coming Soon
              </span>
            </div>
            <p className="text-xs text-slate-400 font-medium mt-0.5">
              Integrating with major hackathons, university incubator networks, and open-source programs.
            </p>
          </div>
        </div>

        {/* Categories Badges */}
        <div className="flex items-center gap-2 flex-wrap text-[11px] font-mono text-slate-400">
          <span className="px-3 py-1 rounded-lg bg-slate-900 border border-slate-800 flex items-center gap-1.5">
            <GraduationCap className="h-3.5 w-3.5 text-primary-400" /> Universities
          </span>
          <span className="px-3 py-1 rounded-lg bg-slate-900 border border-slate-800 flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5 text-primary-300" /> Hackathons
          </span>
          <span className="px-3 py-1 rounded-lg bg-slate-900 border border-slate-800 flex items-center gap-1.5">
            <Shield className="h-3.5 w-3.5 text-emerald-400" /> Partners
          </span>
        </div>
      </div>
    </div>
  );
}
