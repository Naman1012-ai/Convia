import React from 'react';
import PropTypes from 'prop-types';
import { MessageSquare, Sparkles, Users, Globe } from 'lucide-react';

export function ChatEmptyState({
  channelName = 'general',
  isPublic = false,
}) {
  return (
    <div className="flex flex-col items-center justify-center h-full p-8 text-center space-y-4 my-auto">
      <div className={`flex h-16 w-16 items-center justify-center rounded-2xl shadow-sm ${
        isPublic
          ? 'bg-emerald-50 border border-emerald-200 text-emerald-600'
          : 'bg-primary-50 border border-primary-200 text-primary-600'
      }`}>
        {isPublic ? <Globe className="h-8 w-8" /> : <MessageSquare className="h-8 w-8" />}
      </div>

      <div className="space-y-1 max-w-sm">
        <h3 className="text-base font-extrabold text-slate-900 flex items-center justify-center gap-1.5">
          <span>Welcome to #{channelName}</span>
          <Sparkles className="h-4 w-4 text-amber-500 fill-current" />
        </h3>
        <p className="text-xs text-slate-500 font-medium leading-relaxed">
          {isPublic
            ? 'This is an open public community channel for Convia creators and visitors. Start the discussion!'
            : `Start collaborating with your team in real time. Discuss ideas, share updates, or coordinate tasks in #${channelName}.`}
        </p>
      </div>

      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 border border-slate-200 text-[11px] font-mono text-slate-600">
        {isPublic ? (
          <>
            <Globe className="h-3.5 w-3.5 text-emerald-500" />
            <span>Open to all Convia users</span>
          </>
        ) : (
          <>
            <Users className="h-3.5 w-3.5 text-primary-500" />
            <span>Workspace members only</span>
          </>
        )}
      </div>
    </div>
  );
}

ChatEmptyState.propTypes = {
  channelName: PropTypes.string,
  isPublic: PropTypes.bool,
};
