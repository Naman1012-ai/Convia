import React from 'react';
import PropTypes from 'prop-types';
import { useNavigate } from 'react-router-dom';
import {
  Sparkles,
  Lightbulb,
  MessageSquare,
  Users2,
  Compass,
  ArrowRight,
  Plus,
  X,
} from 'lucide-react';
import { Button } from '../../components/ui/Button';

export function CommunityWelcomeCard({
  onStartDiscussion = () => {},
  isDismissed = false,
  onDismiss = null,
  hasExistingMessages = false,
  totalDiscussions = 0,
}) {
  const navigate = useNavigate();

  if (isDismissed) return null;

  // When 3 or more discussions exist, collapse into a sleek, compact 1-line strip
  if (totalDiscussions >= 3 || (hasExistingMessages && totalDiscussions >= 3)) {
    return (
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-emerald-50 via-teal-50/70 to-primary-50/40 px-3.5 py-2.5 border border-emerald-200/80 shadow-2xs flex items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 min-w-0">
          <Sparkles className="h-4 w-4 text-emerald-600 shrink-0" />
          <p className="text-slate-700 truncate font-medium">
            <strong className="text-slate-900 font-semibold">Welcome to Convia Community</strong> · Share ideas, ask questions, and collaborate with creators.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onStartDiscussion}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-2xs transition-all cursor-pointer"
          >
            <Plus className="h-3 w-3" />
            <span>Start Discussion</span>
          </button>
          {onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 transition-colors"
              aria-label="Dismiss banner"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
    );
  }

  // Large intentional welcome state when community is completely new / empty (0-2 discussions)
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm text-center relative overflow-hidden">
      {/* Decorative gradient blur backdrop */}
      <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-96 h-96 bg-gradient-to-tr from-emerald-100 via-teal-100 to-primary-100 rounded-full blur-3xl opacity-60 -z-10 pointer-events-none" />

      <div className="max-w-xl mx-auto space-y-4">
        <div className="inline-flex p-3 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-200 shadow-xs mb-1">
          <Sparkles className="h-8 w-8" />
        </div>

        <div className="space-y-2">
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Welcome to the Convia Community 👋
          </h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            The collaborative discussion ground where initial sparks evolve into validated technical blueprints and tangible actions.
          </p>
        </div>

        {/* 4 Feature Pillars */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left pt-2 pb-2">
          <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
            <div className="p-2 rounded-lg bg-amber-100 text-amber-700 shrink-0">
              <Lightbulb className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-800">Share Ideas</p>
              <p className="text-[11px] text-slate-500">Post early concept proposals and request peer feedback.</p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
            <div className="p-2 rounded-lg bg-sky-100 text-sky-700 shrink-0">
              <MessageSquare className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-800">Ask Questions</p>
              <p className="text-[11px] text-slate-500">Seek architecture guidance or tech stack opinions.</p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
            <div className="p-2 rounded-lg bg-emerald-100 text-emerald-700 shrink-0">
              <Users2 className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-800">Find Collaborators</p>
              <p className="text-[11px] text-slate-500">Connect with developers, designers, and domain experts.</p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
            <div className="p-2 rounded-lg bg-primary-100 text-primary-700 shrink-0">
              <Compass className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-800">Explore Proposals</p>
              <p className="text-[11px] text-slate-500">Review open public proposals across the global ecosystem.</p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <Button
            variant="primary"
            size="md"
            icon={<Plus className="h-4 w-4" />}
            onClick={onStartDiscussion}
            className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 shadow-sm"
          >
            Start the First Discussion
          </Button>

          <Button
            variant="outline"
            size="md"
            icon={<Compass className="h-4 w-4 text-slate-500" />}
            onClick={() => navigate('/explore')}
            className="w-full sm:w-auto border-slate-300 text-slate-700 hover:bg-slate-50 font-semibold"
          >
            Browse Public Ideas
          </Button>
        </div>
      </div>
    </div>
  );
}

CommunityWelcomeCard.propTypes = {
  onStartDiscussion: PropTypes.func,
  isDismissed: PropTypes.bool,
  onDismiss: PropTypes.func,
  hasExistingMessages: PropTypes.bool,
  totalDiscussions: PropTypes.number,
};
