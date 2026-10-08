import React from 'react';
import PropTypes from 'prop-types';
import { getInitials } from '../../utils/formatting';
import { cn } from '../../utils/cn';

export function Avatar({ src = null, name = '', size = 'md', className = '' }) {
  const [imgError, setImgError] = React.useState(false);
  const safeName = typeof name === 'string' ? name : String(name || '');
  const initials = getInitials(safeName);

  const sizes = {
    sm: 'h-6 w-6 text-xs',
    md: 'h-8 w-8 text-xs',
    lg: 'h-10 w-10 text-sm',
  };

  // Consistent color palette derived from string hash
  const colors = [
    'bg-indigo-100 text-indigo-700 border-indigo-200',
    'bg-emerald-100 text-emerald-700 border-emerald-200',
    'bg-amber-100 text-amber-700 border-amber-200',
    'bg-rose-100 text-rose-700 border-rose-200',
    'bg-cyan-100 text-cyan-700 border-cyan-200',
    'bg-violet-100 text-violet-700 border-violet-200',
  ];

  let hash = 0;
  for (let i = 0; i < safeName.length; i++) {
    hash = safeName.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colorIndex = Math.abs(hash) % colors.length;

  if (src && !imgError) {
    return (
      <img
        src={src}
        alt={safeName}
        onError={() => setImgError(true)}
        className={cn(
          'inline-flex shrink-0 rounded-full object-cover border border-slate-200 select-none',
          sizes[size],
          className
        )}
      />
    );
  }

  return (
    <div
      title={safeName}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full border font-semibold select-none',
        sizes[size],
        colors[colorIndex],
        className
      )}
    >
      {initials}
    </div>
  );
}

Avatar.propTypes = {
  src: PropTypes.string,
  name: PropTypes.string,
  size: PropTypes.oneOf(['sm', 'md', 'lg']),
  className: PropTypes.string,
};
