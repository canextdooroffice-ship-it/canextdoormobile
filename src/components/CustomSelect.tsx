import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface CustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: string[] | { value: string; label: string }[];
  placeholder?: string;
  className?: string;
}

interface PopoverStyle {
  position: 'fixed';
  top?: number;
  bottom?: number;
  left: number;
  width: number;
  maxHeight: number;
}

export const CustomSelect: React.FC<CustomSelectProps> = ({
  value,
  onChange,
  options,
  placeholder,
  className = 'styled-select'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [popoverStyle, setPopoverStyle] = useState<PopoverStyle | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const getLabel = () => {
    const found = options.find(opt =>
      typeof opt === 'string' ? opt === value : opt.value === value
    );
    if (found) {
      return typeof found === 'string' ? found : found.label;
    }
    return placeholder || value || '';
  };

  useEffect(() => {
    if (isOpen && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const POPOVER_MAX_H = 240;
      const GAP = 6;

      const spaceBelow = viewportHeight - rect.bottom - GAP;
      const spaceAbove = rect.top - GAP;

      let style: PopoverStyle;

      if (spaceBelow >= spaceAbove) {
        // Open downward
        style = {
          position: 'fixed',
          top: rect.bottom + GAP,
          left: rect.left,
          width: rect.width,
          maxHeight: Math.max(60, Math.min(POPOVER_MAX_H, spaceBelow)),
        };
      } else {
        // Open upward
        style = {
          position: 'fixed',
          bottom: viewportHeight - rect.top + GAP,
          left: rect.left,
          width: rect.width,
          maxHeight: Math.max(60, Math.min(POPOVER_MAX_H, spaceAbove)),
        };
      }

      setPopoverStyle(style);
    } else {
      setPopoverStyle(null);
    }
  }, [isOpen]);

  // Close on scroll ONLY when the scroll event comes from OUTSIDE the popover
  useEffect(() => {
    if (!isOpen) return;
    const handleScroll = (e: Event) => {
      // If the scroll target is the popover itself (or inside it), let it scroll normally
      if (popoverRef.current && popoverRef.current.contains(e.target as Node)) {
        return;
      }
      setIsOpen(false);
    };
    window.addEventListener('scroll', handleScroll, true);
    return () => window.removeEventListener('scroll', handleScroll, true);
  }, [isOpen]);

  return (
    <div className="custom-select-wrapper" ref={containerRef}>
      <button
        type="button"
        className={className}
        onClick={() => setIsOpen(prev => !prev)}
        style={{ textAlign: 'left', width: '100%' }}
      >
        {getLabel()}
      </button>

      {isOpen && popoverStyle && createPortal(
        <>
          {/* Full-screen overlay to catch outside clicks */}
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 9998,
            }}
            onClick={() => setIsOpen(false)}
          />
          {/* Popover rendered at viewport level — never clipped by scrollable ancestors */}
          <div
            ref={popoverRef}
            className="custom-select-popover"
            style={{
              ...popoverStyle,
              zIndex: 9999,
            }}
          >
            {options.length === 0 ? (
              <div className="custom-select-option disabled" style={{ opacity: 0.6, cursor: 'default' }}>
                No Options Available
              </div>
            ) : (
              options.map((opt, idx) => {
                const optVal = typeof opt === 'string' ? opt : opt.value;
                const optLabel = typeof opt === 'string' ? opt : opt.label;
                return (
                  <div
                    key={idx}
                    className={`custom-select-option ${value === optVal ? 'selected' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onChange(optVal);
                      setIsOpen(false);
                    }}
                  >
                    {optLabel}
                  </div>
                );
              })
            )}
          </div>
        </>,
        document.body
      )}
    </div>
  );
};
