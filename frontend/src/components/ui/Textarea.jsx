import React from 'react';
import PropTypes from 'prop-types';
import { cn } from '../../utils/cn';

export function Textarea({
  label,
  id,
  placeholder = '',
  error = null,
  required = false,
  maxLength = undefined,
  showCount = true,
  rows = 4,
  value = '',
  onChange,
  className = '',
  disabled = false,
  ...props
}) {
  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);
  const currentLength = (value || '').length;
  const isNearLimit = maxLength && currentLength >= maxLength * 0.9;
  const isCountVisible = Boolean(maxLength && showCount && !disabled && !props.readOnly);

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-1">
        {label && (
          <label htmlFor={inputId} className="block text-sm font-medium text-slate-700">
            {label} {required && <span className="text-rose-500">*</span>}
          </label>
        )}
        {isCountVisible && (
          <span
            className={cn(
              'text-xs transition-colors',
              isNearLimit ? 'text-rose-500 font-medium' : 'text-slate-400'
            )}
          >
            {currentLength}/{maxLength}
          </span>
        )}
      </div>
      <textarea
        id={inputId}
        rows={rows}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        maxLength={maxLength}
        required={required}
        disabled={disabled}
        className={cn(
          'w-full resize-none rounded-lg border bg-white px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-offset-0 disabled:bg-slate-50/80 disabled:text-slate-700 disabled:border-slate-200 disabled:cursor-default',
          error
            ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/20'
            : 'border-slate-300 focus:border-indigo-500 focus:ring-indigo-500/20',
          className
        )}
        {...props}
      />
      {error && <p className="mt-1 text-xs text-rose-600">{error}</p>}
    </div>
  );
}

Textarea.propTypes = {
  label: PropTypes.string,
  id: PropTypes.string,
  placeholder: PropTypes.string,
  error: PropTypes.string,
  required: PropTypes.bool,
  maxLength: PropTypes.number,
  showCount: PropTypes.bool,
  rows: PropTypes.number,
  value: PropTypes.string,
  onChange: PropTypes.func,
  className: PropTypes.string,
  disabled: PropTypes.bool,
};
