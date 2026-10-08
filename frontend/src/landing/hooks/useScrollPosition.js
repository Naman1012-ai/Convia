import { useState, useEffect } from 'react';

export function useScrollPosition(threshold = 30) {
  const [isScrolled, setIsScrolled] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.scrollY > threshold;
    }
    return false;
  });

  useEffect(() => {
    let ticking = false;

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const pastThreshold = window.scrollY > threshold;
          setIsScrolled((prev) => (prev !== pastThreshold ? pastThreshold : prev));
          ticking = false;
        });
        ticking = true;
      }
    };

    // Sync initial state
    handleScroll();

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [threshold]);

  return { isScrolled };
}
