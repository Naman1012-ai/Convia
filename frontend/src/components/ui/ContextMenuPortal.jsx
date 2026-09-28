import React, { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import PropTypes from 'prop-types';
import { X } from 'lucide-react';

/**
 * ContextMenuPortal
 *
 * Renders an unconstrained, viewport-aware floating context menu (on desktop)
 * or a touch-friendly bottom action sheet (on mobile) via a React Portal attached to document.body.
 *
 * Coordinates are calculated strictly in viewport coordinates from the clicked button's
 * exact getBoundingClientRect(), preventing any top-left coordinate glitches or card clipping.
 */
export function ContextMenuPortal({
  isOpen = false,
  onClose = () => {},
  anchorRect = null,
  triggerRef = null,
  children,
  align = 'right', // 'right' | 'left'
  title = 'Discussion Options',
  className = '',
}) {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth < 640;
    }
    return false;
  });

  const menuRef = useRef(null);

  // Helper to resolve the live anchor rect
  const getAnchorRect = useCallback(() => {
    if (anchorRect && typeof anchorRect.top === 'number') {
      return anchorRect;
    }
    if (triggerRef?.current && typeof triggerRef.current.getBoundingClientRect === 'function') {
      return triggerRef.current.getBoundingClientRect();
    }
    return null;
  }, [anchorRect, triggerRef]);

  // Compute fixed viewport coordinates directly from anchor rect
  const computeCoordinates = useCallback(
    (rect) => {
      if (!rect || typeof window === 'undefined') {
        return { top: 0, left: 0, placement: 'bottom' };
      }

      const menuEl = menuRef.current;
      const menuWidth = menuEl?.offsetWidth || 180;
      const menuHeight = menuEl?.offsetHeight || 230;
      const padding = 8;
      const gap = 4;

      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;

      let top;
      let placement = 'bottom';

      // Flip upward if space below is too tight (< menuHeight + 12px) and space above is larger
      if (spaceBelow < menuHeight + 12 && spaceAbove > spaceBelow) {
        top = rect.top - menuHeight - gap;
        placement = 'top';
      } else {
        top = rect.bottom + gap;
        placement = 'bottom';
      }

      // Viewport vertical clamping (keep at least 8px away from viewport edges)
      top = Math.max(padding, Math.min(window.innerHeight - menuHeight - padding, top));

      // Horizontal alignment:
      // - 'right': aligns menu's right edge to trigger's right edge (expands leftward)
      // - 'left': aligns menu's left edge to trigger's left edge (expands rightward)
      let left;
      if (align === 'left') {
        left = rect.left;
      } else {
        left = rect.right - menuWidth;
      }

      // Viewport horizontal clamping
      if (left + menuWidth > window.innerWidth - padding) {
        left = window.innerWidth - menuWidth - padding;
      }
      if (left < padding) {
        left = padding;
      }

      return { top: Math.round(top), left: Math.round(left), placement };
    },
    [align]
  );

  // Initialize coords immediately with exact button position so it never renders at (0, 0)
  const [coords, setCoords] = useState(() => {
    const initialRect = getAnchorRect();
    return computeCoordinates(initialRect);
  });

  // Track viewport breakpoint (mobile vs desktop)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleResize = () => {
      setIsMobile(window.innerWidth < 640);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Update coords synchronously when isOpen becomes true or anchorRect updates
  useLayoutEffect(() => {
    if (!isOpen || isMobile) return;

    const rect = getAnchorRect();
    if (!rect) return;

    const refined = computeCoordinates(rect);
    setCoords(refined);
  }, [isOpen, isMobile, getAnchorRect, computeCoordinates]);

  // Close contextual menu immediately on scroll or window resize to prevent detached floating menus
  useEffect(() => {
    if (!isOpen) return;

    const handleScrollOrResize = () => {
      onClose();
    };

    window.addEventListener('scroll', handleScrollOrResize, { capture: true, passive: true });
    window.addEventListener('resize', handleScrollOrResize, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScrollOrResize, { capture: true });
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [isOpen, onClose]);

  // Handle outside click & keyboard accessibility (Escape, ArrowUp, ArrowDown)
  useEffect(() => {
    if (!isOpen || typeof document === 'undefined') return;

    const handleClickOutside = (e) => {
      // Don't close if clicking inside the menu
      if (menuRef.current && menuRef.current.contains(e.target)) {
        return;
      }
      // Don't close if clicking the trigger button (let button's onClick handle toggle)
      if (triggerRef?.current && triggerRef.current.contains(e.target)) {
        return;
      }
      onClose();
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        if (triggerRef?.current) {
          triggerRef.current.focus();
        }
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        if (!menuRef.current) return;
        const items = Array.from(
          menuRef.current.querySelectorAll('[role="menuitem"]:not([disabled])')
        );
        if (items.length === 0) return;

        e.preventDefault();
        const activeIdx = items.indexOf(document.activeElement);
        if (e.key === 'ArrowDown') {
          const nextIdx = activeIdx >= 0 && activeIdx < items.length - 1 ? activeIdx + 1 : 0;
          items[nextIdx]?.focus();
        } else {
          const prevIdx = activeIdx > 0 ? activeIdx - 1 : items.length - 1;
          items[prevIdx]?.focus();
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside, { passive: true });
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose, triggerRef]);

  if (!isOpen || typeof document === 'undefined' || !document.body) {
    return null;
  }

  // ========================================================
  // MOBILE RENDER: Bottom Action Sheet with Backdrop (<640px)
  // ========================================================
  if (isMobile) {
    return createPortal(
      <div
        className="fixed inset-0 z-[45] flex flex-col justify-end"
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        {/* Semi-transparent Backdrop */}
        <div
          className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
          onClick={onClose}
          aria-hidden="true"
        />

        {/* Bottom Sheet Drawer */}
        <div
          ref={menuRef}
          role="menu"
          aria-label={title}
          className="relative z-10 w-full max-h-[85vh] overflow-y-auto rounded-t-3xl bg-white p-4 shadow-2xl border-t border-slate-200 animate-in slide-in-from-bottom duration-200 space-y-2 pb-[max(1rem,env(safe-area-inset-bottom))]"
        >
          {/* Grab Handle */}
          <div className="w-10 h-1 bg-slate-300 rounded-full mx-auto mb-2" />

          {/* Header */}
          <div className="flex items-center justify-between px-1 pb-2 border-b border-slate-100">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              {title}
            </span>
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              aria-label="Close menu"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Menu Items Container */}
          <div className="space-y-1 pt-1">{children}</div>

          {/* Mobile Cancel Button */}
          <button
            type="button"
            onClick={onClose}
            className="w-full mt-2 py-3 rounded-2xl bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-xs font-bold text-slate-700 transition-colors text-center cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>,
      document.body
    );
  }

  // ========================================================
  // DESKTOP RENDER: Anchored Viewport-Aware Floating Portal
  // ========================================================
  return createPortal(
    <div
      ref={menuRef}
      role="menu"
      aria-label={title}
      style={{
        position: 'fixed',
        top: `${coords.top}px`,
        left: `${coords.left}px`,
        width: '180px',
      }}
      className={`z-[45] rounded-xl border border-slate-200/90 bg-white p-1.5 shadow-xl shadow-slate-900/10 backdrop-blur-md animate-in fade-in zoom-in-95 duration-100 ${className}`}
    >
      {children}
    </div>,
    document.body
  );
}

ContextMenuPortal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  anchorRect: PropTypes.shape({
    top: PropTypes.number,
    bottom: PropTypes.number,
    left: PropTypes.number,
    right: PropTypes.number,
    width: PropTypes.number,
    height: PropTypes.number,
  }),
  triggerRef: PropTypes.shape({ current: PropTypes.any }),
  children: PropTypes.node,
  align: PropTypes.oneOf(['left', 'right']),
  title: PropTypes.string,
  className: PropTypes.string,
};
