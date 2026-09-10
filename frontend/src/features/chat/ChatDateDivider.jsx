import React from 'react';
import PropTypes from 'prop-types';
import { Calendar } from 'lucide-react';

/**
 * Chronological date separator with centered date pill.
 */
export function ChatDateDivider({ label }) {
  if (!label) return null;

  return (
    <div className="relative flex items-center justify-center my-4 px-4" role="separator" aria-label={`Date: ${label}`}>
      <div className="absolute inset-0 flex items-center" aria-hidden="true">
        <div className="w-full border-t border-slate-200" />
      </div>
      <div className="relative inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-slate-200 text-[11px] font-semibold text-slate-500 shadow-2xs">
        <Calendar className="h-3 w-3 text-slate-400 shrink-0" aria-hidden="true" />
        <span>{label}</span>
      </div>
    </div>
  );
}

ChatDateDivider.propTypes = {
  label: PropTypes.string.isRequired,
};
