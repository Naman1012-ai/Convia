import React from 'react';
import PropTypes from 'prop-types';
import { Loader2 } from 'lucide-react';
import { cn } from '../../utils/cn';

export function Button({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  disabled = false,
  fullWidth = false,
  icon = null,
  children,
  className = '',
  type = 'button',
  onClick,
  ...props
}) {
  const baseStyles =
    'inline-flex items-center justify-center font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-75 disabled:pointer-events-none active:scale-[0.98] transition-transform duration-75';

  const variants = {
    primary:
      'bg-primary-600 text-white hover:bg-primary-700 active:bg-primary-800 shadow-sm disabled:bg-slate-200 disabled:text-slate-500 disabled:border-transparent disabled:shadow-none',
    secondary:
      'bg-white text-slate-700 border border-slate-300 hover:bg-primary-50 hover:text-primary-900 hover:border-primary-200 active:bg-primary-100 shadow-sm disabled:bg-slate-100 disabled:text-slate-400 disabled:border-slate-200 disabled:shadow-none',
    outline:
      'border border-slate-300 text-slate-700 bg-transparent hover:bg-slate-50 hover:text-slate-900 active:bg-slate-100 disabled:border-slate-200 disabled:text-slate-400 disabled:bg-transparent disabled:shadow-none',
    ghost:
      'text-slate-600 hover:bg-primary-50 hover:text-primary-900 active:bg-primary-100 disabled:text-slate-400 disabled:bg-transparent disabled:shadow-none',
    danger:
      'bg-rose-600 text-white hover:bg-rose-700 active:bg-rose-800 shadow-sm disabled:bg-rose-100 disabled:text-rose-400 disabled:border-rose-200 disabled:shadow-none',
    warning:
      'bg-amber-500 text-amber-950 hover:bg-amber-600 hover:text-amber-950 active:bg-amber-700 shadow-sm border border-amber-600/30 disabled:bg-amber-100 disabled:text-amber-600/70 disabled:border-amber-200 disabled:shadow-none',
    purple:
      'bg-purple-600 text-white hover:bg-purple-700 active:bg-purple-800 shadow-sm disabled:bg-purple-100 disabled:text-purple-400 disabled:border-purple-200 disabled:shadow-none',
  };

  const sizes = {
    sm: 'h-8 px-3 text-xs rounded-md gap-1.5',
    md: 'h-10 px-4 text-sm rounded-lg gap-2',
    lg: 'h-11 px-5 text-base rounded-lg gap-2.5',
  };

  const renderIcon = () => {
    if (!icon) return null;
    if (React.isValidElement(icon)) return icon;
    if (typeof icon === 'function' || (typeof icon === 'object' && icon.$$typeof)) {
      const IconComponent = icon;
      return <IconComponent className="h-4 w-4 shrink-0" />;
    }
    return null;
  };

  const renderedIcon = renderIcon();

  return (
    <button
      type={type}
      disabled={disabled || isLoading}
      onClick={onClick}
      className={cn(
        baseStyles,
        variants[variant] || variants.primary,
        sizes[size],
        fullWidth && 'w-full',
        className
      )}
      {...props}
    >
      {isLoading ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin text-current" />
          <span>{children}</span>
        </>
      ) : (
        <>
          {renderedIcon && <span className="shrink-0">{renderedIcon}</span>}
          <span>{children}</span>
        </>
      )}
    </button>
  );
}

Button.propTypes = {
  variant: PropTypes.oneOf(['primary', 'secondary', 'outline', 'ghost', 'danger', 'warning', 'purple']),
  size: PropTypes.oneOf(['sm', 'md', 'lg']),
  isLoading: PropTypes.bool,
  disabled: PropTypes.bool,
  fullWidth: PropTypes.bool,
  icon: PropTypes.oneOfType([PropTypes.node, PropTypes.elementType, PropTypes.object, PropTypes.func]),
  children: PropTypes.node.isRequired,
  className: PropTypes.string,
  type: PropTypes.string,
  onClick: PropTypes.func,
};
