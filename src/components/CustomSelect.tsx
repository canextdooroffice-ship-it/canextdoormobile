import React, { useState, useRef, useEffect } from 'react';

interface CustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: string[] | { value: string; label: string }[];
  placeholder?: string;
  className?: string;
}

export const CustomSelect: React.FC<CustomSelectProps> = ({
  value,
  onChange,
  options,
  placeholder,
  className = 'styled-select'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [openUpward, setOpenUpward] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

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
      const spaceBelow = viewportHeight - rect.bottom;
      const spaceAbove = rect.top;
      
      // Open upward only if space below is tight (< 200px) AND there is more space above than below
      if (spaceBelow < 200 && spaceAbove > spaceBelow) {
        setOpenUpward(true);
      } else {
        setOpenUpward(false);
      }
    }
  }, [isOpen]);

  return (
    <div className="custom-select-wrapper" ref={containerRef}>
      <button
        type="button"
        className={className}
        onClick={() => setIsOpen(!isOpen)}
        style={{ textAlign: 'left', width: '100%' }}
      >
        {getLabel()}
      </button>
      {isOpen && (
        <>
          <div className="dropdown-overlay" onClick={() => setIsOpen(false)} />
          <div className={`custom-select-popover ${openUpward ? 'open-upward' : ''}`}>
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
                    onClick={() => {
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
        </>
      )}
    </div>
  );
};
