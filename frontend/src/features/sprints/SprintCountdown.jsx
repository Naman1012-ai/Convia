import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { Clock, AlertTriangle } from 'lucide-react';
import { cn } from '../../utils/cn';

/**
 * Convia Live Sprint Real-Time Countdown Component.
 * Computes live remaining duration until targetEndDate and updates in real-time.
 */
export function SprintCountdown({ targetEndDate, className }) {
  const [timeLeft, setTimeLeft] = useState(null);

  useEffect(() => {
    if (!targetEndDate) return;

    const calculateTimeLeft = () => {
      // Normalize end date to 23:59:59 of that day if string format YYYY-MM-DD
      const targetTime =
        typeof targetEndDate === 'string' && targetEndDate.length === 10
          ? new Date(`${targetEndDate}T23:59:59`).getTime()
          : new Date(targetEndDate).getTime();

      const diff = targetTime - Date.now();

      if (isNaN(diff)) {
        return null;
      }

      if (diff <= 0) {
        return { isExpired: true, days: 0, hours: 0, minutes: 0, seconds: 0 };
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
      const minutes = Math.floor((diff / 1000 / 60) % 60);
      const seconds = Math.floor((diff / 1000) % 60);

      return { isExpired: false, days, hours, minutes, seconds, diff };
    };

    setTimeLeft(calculateTimeLeft());

    // Update every second when under 24 hours, or every 30 seconds otherwise
    const interval = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000);

    return () => clearInterval(interval);
  }, [targetEndDate]);

  if (!timeLeft) return null;

  if (timeLeft.isExpired) {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200/90 shadow-2xs',
          className
        )}
      >
        <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
        <span>Target Date Reached</span>
      </span>
    );
  }

  // Format countdown string
  let displayString = '';
  if (timeLeft.days > 0) {
    displayString = `${timeLeft.days}d ${timeLeft.hours}h remaining`;
  } else if (timeLeft.hours > 0) {
    displayString = `${timeLeft.hours}h ${timeLeft.minutes}m ${timeLeft.seconds}s remaining`;
  } else {
    displayString = `${timeLeft.minutes}m ${timeLeft.seconds}s remaining`;
  }

  const isUrgent = timeLeft.days === 0 && timeLeft.hours < 12;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold transition-colors shadow-2xs',
        isUrgent
          ? 'bg-rose-50 text-rose-700 border border-rose-200'
          : 'bg-slate-50 text-slate-700 border border-slate-200/80',
        className
      )}
      title={`Sprint deadline: ${new Date(targetEndDate).toLocaleDateString()}`}
    >
      <Clock
        className={cn(
          'w-3.5 h-3.5',
          isUrgent ? 'text-rose-600 animate-pulse' : 'text-slate-500'
        )}
      />
      <span className="font-mono tracking-tight">{displayString}</span>
    </span>
  );
}

SprintCountdown.propTypes = {
  targetEndDate: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  className: PropTypes.string,
};

export default SprintCountdown;
