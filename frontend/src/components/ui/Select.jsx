import React from 'react';
import PropTypes from 'prop-types';
import { cn } from '../../utils/cn';

export function Select({
  label,
  id,
  options = [],
  error = null,
  required = false,
  value,
  onChange,
  className = '',
  children,
  ...props
}) {
  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  return (
    <div className="w-full">
      {label && (
        <label htmlFor={inputId} className="block text-sm font-medium text-slate-700 mb-1">
          {label} {required && <span className="text-rose-500">*</span>}
        </label>
      )}
      <select
        id={inputId}
        value={value}
        onChange={onChange}
        required={required}
        className={cn(
          'w-full rounded-lg border bg-white px-3.5 py-2 text-sm text-slate-900 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-offset-0 cursor-pointer disabled:bg-slate-50/80 disabled:text-slate-700 disabled:border-slate-200 disabled:cursor-default',
          error
            ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/20'
            : 'border-slate-300 focus:border-primary-500 focus:ring-primary-500/20',
          className
        )}
        {...props}
      >
        {options?.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
        {children}
      </select>
      {error && <p className="mt-1 text-xs text-rose-600">{error}</p>}
    </div>
  );
}

Select.propTypes = {
  label: PropTypes.string,
  id: PropTypes.string,
  options: PropTypes.arrayOf(
    PropTypes.shape({
      value: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
    })
  ),
  children: PropTypes.node,
  error: PropTypes.string,
  required: PropTypes.bool,
  value: PropTypes.string,
  onChange: PropTypes.func,
  className: PropTypes.string,
};
