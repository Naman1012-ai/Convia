import React from 'react';
import PropTypes from 'prop-types';
import { cn } from '../../utils/cn';

export function Card({
  hover = false,
  padding = 'md',
  children,
  className = '',
  onClick,
  ...props
}) {
  const paddings = {
    none: 'p-0',
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8',
  };

  return (
    <div
      onClick={onClick}
      className={cn(
        'rounded-xl border border-slate-200 bg-white shadow-sm transition-all duration-200',
        paddings[padding],
        hover && 'hover:border-primary-300 hover:shadow-md cursor-pointer',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

Card.propTypes = {
  hover: PropTypes.bool,
  padding: PropTypes.oneOf(['none', 'sm', 'md', 'lg']),
  children: PropTypes.node.isRequired,
  className: PropTypes.string,
  onClick: PropTypes.func,
};
