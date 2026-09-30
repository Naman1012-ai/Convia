import React from 'react';
import PropTypes from 'prop-types';
import { cn } from '../../utils/cn';

export function Badge({ variant = 'default', children, className = '' }) {
  const variants = {
    // Semantic tokens
    default: 'bg-slate-100 text-slate-700 border-slate-200',
    info: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    success: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    warning: 'bg-amber-50 text-amber-900 border-amber-300',
    danger: 'bg-rose-50 text-rose-800 border-rose-200',

    // Direct color names mapped to high-contrast WCAG AAA tokens
    blue: 'bg-blue-50 text-blue-800 border-blue-200',
    indigo: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    purple: 'bg-purple-50 text-purple-800 border-purple-200',
    green: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    emerald: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    amber: 'bg-amber-50 text-amber-900 border-amber-300',
    red: 'bg-rose-50 text-rose-800 border-rose-200',
    rose: 'bg-rose-50 text-rose-800 border-rose-200',
    slate: 'bg-slate-100 text-slate-700 border-slate-200',
  };

  const selectedVariant = variants[variant] || variants.default;

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors',
        selectedVariant,
        className
      )}
    >
      {children}
    </span>
  );
}

Badge.propTypes = {
  variant: PropTypes.string,
  children: PropTypes.node.isRequired,
  className: PropTypes.string,
};
