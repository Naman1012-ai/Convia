import React from 'react';
import { ArrowRight } from 'lucide-react';
import { safeText, safeArray } from '../../utils/safeRender';

/**
 * Reusable Canonical Summary Card for Blueprint 2.0.
 * Automatically displays short content completely and provides a readable 2-3 line preview
 * with an accessible "See details →" button for longer content.
 */
export function BlueprintSummaryCard({
  tag,
  tagColor = 'text-primary-400',
  title,
  content,
  footer,
  entityId,
  entityType = 'Project Direction',
  onInspectEntity,
  raw = null,
  maxPreviewChars = 115,
  previewLines = 3,
}) {
  let rawText = '';
  let isArray = false;
  let itemsList = [];

  if (Array.isArray(content)) {
    isArray = true;
    itemsList = safeArray(content);
    rawText = itemsList.map((item) => safeText(item)).join('; ');
  } else {
    rawText = safeText(content);
  }

  // Determine if content exceeds compact preview limit
  const isLong = rawText.length > maxPreviewChars || (isArray && itemsList.length > 2);

  const handleOpenDetails = (e) => {
    e.stopPropagation();
    if (onInspectEntity) {
      onInspectEntity({
        id: entityId || tag,
        type: entityType,
        title: title || tag,
        description: isArray ? itemsList.map((item) => `• ${safeText(item)}`).join('\n') : rawText,
        raw: raw || {
          tag,
          title: title || tag,
          text: rawText,
          items: isArray ? itemsList : null,
          footer,
        },
      });
    }
  };

  const lineClampClass =
    previewLines === 2
      ? 'line-clamp-2'
      : previewLines === 4
      ? 'line-clamp-4'
      : 'line-clamp-3';

  return (
    <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2 flex flex-col justify-between hover:border-slate-700 transition-colors shadow-sm">
      <div className="space-y-1.5">
        <span className={`text-[10px] font-mono font-bold uppercase tracking-wider ${tagColor}`}>
          {safeText(tag)}
        </span>

        <p className={`text-xs text-slate-200 leading-relaxed font-medium ${isLong ? lineClampClass : ''}`}>
          {rawText || 'Specification details defined in technical architecture.'}
        </p>

        {isLong && onInspectEntity && (
          <button
            type="button"
            onClick={handleOpenDetails}
            className="text-[11px] font-mono font-bold text-primary-400 hover:text-primary-300 flex items-center gap-1 mt-1 cursor-pointer transition-colors group focus:outline-none focus:ring-1 focus:ring-primary-500 rounded py-0.5"
            aria-label={`See details for ${title || tag}`}
          >
            <span>See details</span>
            <ArrowRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
          </button>
        )}
      </div>

      {footer && (
        <div className="pt-2 text-[10px] font-mono text-slate-400 border-t border-slate-900/80 flex items-center justify-between">
          <span>{safeText(footer)}</span>
        </div>
      )}
    </div>
  );
}
