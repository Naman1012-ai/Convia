import React, { useState, useRef, useEffect, useId } from 'react';
import PropTypes from 'prop-types';
import { ChevronDown, Check } from 'lucide-react';
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
  disabled = false,
  placeholder = 'Select an option',
  children,
  name,
  ...props
}) {
  const generatedId = useId();
  const inputId = id || generatedId;
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef(null);
  const listboxRef = useRef(null);

  // Normalize options from props or children (<option>)
  const normalizedOptions = React.useMemo(() => {
    const list = [];
    if (Array.isArray(options) && options.length > 0) {
      options.forEach((opt) => {
        if (typeof opt === 'object' && opt !== null) {
          list.push({
            value: String(opt.value ?? ''),
            label: opt.label ?? opt.value ?? '',
            disabled: Boolean(opt.disabled),
          });
        } else {
          list.push({
            value: String(opt),
            label: String(opt),
            disabled: false,
          });
        }
      });
    } else if (children) {
      React.Children.forEach(children, (child) => {
        if (React.isValidElement(child) && child.type === 'option') {
          list.push({
            value: String(child.props.value ?? ''),
            label: child.props.children ?? child.props.value ?? '',
            disabled: Boolean(child.props.disabled),
          });
        }
      });
    }
    return list;
  }, [options, children]);

  // Current selected option
  const selectedOption = normalizedOptions.find(
    (opt) => String(opt.value) === String(value)
  );

  // Handle outside click to close dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isOpen]);

  // Handle option selection
  const handleSelect = (opt) => {
    if (opt.disabled || disabled) return;
    setIsOpen(false);
    if (onChange) {
      // Provide synthetic event compatible with native select onChange
      onChange({
        target: {
          value: opt.value,
          name: name || inputId,
          id: inputId,
        },
      });
    }
  };

  // Keyboard navigation
  const handleKeyDown = (e) => {
    if (disabled) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        setActiveIndex(0);
      } else {
        setActiveIndex((prev) => (prev < normalizedOptions.length - 1 ? prev + 1 : 0));
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        setActiveIndex(normalizedOptions.length - 1);
      } else {
        setActiveIndex((prev) => (prev > 0 ? prev - 1 : normalizedOptions.length - 1));
      }
    } else if (e.key === 'Enter' || e.key === ' ') {
      if (isOpen && activeIndex >= 0 && activeIndex < normalizedOptions.length) {
        e.preventDefault();
        handleSelect(normalizedOptions[activeIndex]);
      } else if (!isOpen) {
        e.preventDefault();
        setIsOpen(true);
      }
    } else if (e.key === 'Escape' || e.key === 'Tab') {
      setIsOpen(false);
    }
  };

  // Extract width classes from className to apply to container
  const classNames = className.split(' ').filter(Boolean);
  const widthClass = classNames.find((c) => c.startsWith('w-')) || 'w-full';
  const nonWidthClasses = classNames.filter((c) => !c.startsWith('w-')).join(' ');

  return (
    <div className={cn('relative', widthClass)} ref={containerRef}>
      {label && (
        <label
          htmlFor={inputId}
          className="block text-xs font-bold text-slate-700 mb-1 tracking-tight"
        >
          {label} {required && <span className="text-rose-500">*</span>}
        </label>
      )}

      {/* Hidden input for form submission / accessibility */}
      <input
        type="hidden"
        id={inputId}
        name={name || inputId}
        value={value ?? ''}
        required={required}
        disabled={disabled}
      />

      {/* Trigger Button */}
      <button
        type="button"
        id={`${inputId}-trigger`}
        disabled={disabled}
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        onKeyDown={handleKeyDown}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-labelledby={label ? inputId : undefined}
        className={cn(
          'w-full flex items-center justify-between gap-2 rounded-xl border bg-white px-3 py-2 text-sm text-slate-900 transition-all duration-150 text-left select-none shadow-xs',
          'focus:outline-none focus:ring-2 focus:ring-primary-500/25 focus:border-primary-500',
          disabled
            ? 'bg-slate-50 text-slate-400 border-slate-200 cursor-not-allowed shadow-none'
            : isOpen
            ? 'border-primary-500 ring-2 ring-primary-500/20'
            : error
            ? 'border-rose-500 hover:border-rose-600 focus:border-rose-500 focus:ring-rose-500/20'
            : 'border-slate-300 hover:border-slate-400 hover:bg-slate-50/50 cursor-pointer',
          nonWidthClasses
        )}
        {...props}
      >
        <span className={cn('truncate block flex-1 font-medium', !selectedOption && 'text-slate-400')}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown
          className={cn(
            'h-4 w-4 text-slate-400 shrink-0 transition-transform duration-200',
            isOpen && 'rotate-180 text-primary-600'
          )}
        />
      </button>

      {/* Custom Dropdown Menu */}
      {isOpen && (
        <div
          ref={listboxRef}
          role="listbox"
          tabIndex={-1}
          className="absolute left-0 top-full mt-1.5 w-full min-w-[160px] max-w-sm rounded-xl border border-slate-200 bg-white p-1 shadow-xl z-50 animate-in fade-in zoom-in-95 duration-100 max-h-60 overflow-y-auto focus:outline-none"
        >
          {normalizedOptions.length === 0 ? (
            <div className="py-2.5 px-3 text-xs text-slate-400 italic text-center">
              No options available
            </div>
          ) : (
            normalizedOptions.map((opt, idx) => {
              const isSelected = String(opt.value) === String(value);
              const isHighlighted = idx === activeIndex;

              return (
                <div
                  key={`${opt.value}-${idx}`}
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => handleSelect(opt)}
                  onMouseEnter={() => setActiveIndex(idx)}
                  className={cn(
                    'flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-xs font-semibold cursor-pointer transition-colors',
                    opt.disabled && 'opacity-50 cursor-not-allowed pointer-events-none',
                    isSelected
                      ? 'bg-primary-50 text-primary-700'
                      : isHighlighted
                      ? 'bg-slate-100 text-slate-900'
                      : 'text-slate-700 hover:bg-slate-50'
                  )}
                >
                  <span className="truncate flex-1">{opt.label}</span>
                  {isSelected && (
                    <Check className="h-3.5 w-3.5 text-primary-600 shrink-0" />
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {error && <p className="mt-1 text-xs text-rose-600 font-medium">{error}</p>}
    </div>
  );
}

Select.propTypes = {
  label: PropTypes.string,
  id: PropTypes.string,
  options: PropTypes.arrayOf(
    PropTypes.oneOfType([
      PropTypes.shape({
        value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
        label: PropTypes.node.isRequired,
        disabled: PropTypes.bool,
      }),
      PropTypes.string,
      PropTypes.number,
    ])
  ),
  children: PropTypes.node,
  error: PropTypes.string,
  required: PropTypes.bool,
  disabled: PropTypes.bool,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onChange: PropTypes.func,
  className: PropTypes.string,
  placeholder: PropTypes.string,
  name: PropTypes.string,
};