import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '../../utils/cn';

export function Input({
  label,
  action = null,
  id,
  type = 'text',
  placeholder = '',
  error = null,
  required = false,
  maxLength = undefined,
  value,
  onChange,
  className = '',
  allowPasswordToggle = true,
  ...props
}) {
  const [showPassword, setShowPassword] = useState(false);
  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  const isPasswordField = type === 'password';
  const shouldShowToggle = isPasswordField && allowPasswordToggle;
  const currentInputType = isPasswordField && showPassword ? 'text' : type;

  const togglePasswordVisibility = () => {
    setShowPassword((prev) => !prev);
  };

  return (
    <div className="w-full">
      {(label || action) && (
        <div className="flex items-center justify-between mb-1 gap-2">
          {label ? (
            <label htmlFor={inputId} className="block text-sm font-medium text-slate-700">
              {label} {required && <span className="text-rose-500">*</span>}
            </label>
          ) : <div />}
          {action}
        </div>
      )}
      <div className="relative w-full">
        <input
          id={inputId}
          type={currentInputType}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          maxLength={maxLength}
          required={required}
          className={cn(
            'w-full rounded-lg border bg-white px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-offset-0 disabled:bg-slate-50/80 disabled:text-slate-700 disabled:border-slate-200 disabled:cursor-default',
            shouldShowToggle && 'pr-10',
            error
              ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/20'
              : 'border-slate-300 focus:border-indigo-500 focus:ring-indigo-500/20',
            className
          )}
          {...props}
        />
        {shouldShowToggle && (
          <button
            type="button"
            onClick={togglePasswordVisibility}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 focus:text-indigo-600 focus:outline-none rounded transition-colors duration-150"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            title={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? (
              <EyeOff className="h-4 w-4 shrink-0" aria-hidden="true" />
            ) : (
              <Eye className="h-4 w-4 shrink-0" aria-hidden="true" />
            )}
          </button>
        )}
      </div>
      {error && <p className="mt-1 text-xs text-rose-600">{error}</p>}
    </div>
  );
}

Input.propTypes = {
  label: PropTypes.string,
  action: PropTypes.node,
  id: PropTypes.string,
  type: PropTypes.string,
  placeholder: PropTypes.string,
  error: PropTypes.string,
  required: PropTypes.bool,
  maxLength: PropTypes.number,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onChange: PropTypes.func,
  className: PropTypes.string,
  allowPasswordToggle: PropTypes.bool,
};

