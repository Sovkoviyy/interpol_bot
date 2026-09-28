import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, Search, X } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
  sublabel?: string;
  icon?: React.ReactNode;
  badge?: string;
  badgeColor?: string;
}

interface CustomSelectProps {
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchable?: boolean;
  className?: string;
}

export const CustomSelect: React.FC<CustomSelectProps> = ({
  options,
  value,
  onChange,
  placeholder = 'Выберите значение...',
  searchable = true,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
    if (!isOpen) setSearch('');
  }, [isOpen]);

  const filtered = options.filter(
    (opt) =>
      opt.label.toLowerCase().includes(search.toLowerCase()) ||
      (opt.sublabel && opt.sublabel.toLowerCase().includes(search.toLowerCase())) ||
      opt.value.toLowerCase().includes(search.toLowerCase())
  );

  const selectedOption = options.find((opt) => opt.value === value);

  return (
    <div className={`relative w-full ${className}`} ref={containerRef}>
      {/* Trigger Box */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full min-h-[42px] bg-dark-900 border rounded-xl px-3.5 py-2 flex items-center justify-between gap-2 cursor-pointer transition-all duration-200 ${
          isOpen
            ? 'border-pink-500/60 ring-2 ring-pink-500/15 bg-dark-850'
            : 'border-dark-700 hover:border-dark-600 hover:bg-dark-850'
        }`}
        title={
          selectedOption
            ? `${selectedOption.label}${selectedOption.sublabel ? ` (${selectedOption.sublabel})` : ''}`
            : undefined
        }
      >
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          {selectedOption ? (
            <>
              {selectedOption.icon && <span className="shrink-0">{selectedOption.icon}</span>}
              <span className="text-[13px] font-medium text-slate-100 truncate">
                {selectedOption.label}
              </span>
              {selectedOption.sublabel && (
                <span className="text-[11px] text-slate-500 shrink-0 max-w-[40%] truncate hidden sm:inline">
                  • {selectedOption.sublabel}
                </span>
              )}
            </>
          ) : (
            <span className="text-[13px] text-slate-500 select-none truncate">
              {placeholder}
            </span>
          )}
        </div>

        <ChevronDown
          className={`w-4 h-4 text-slate-500 shrink-0 transition-transform duration-200 ${
            isOpen ? 'rotate-180 text-pink-400' : ''
          }`}
        />
      </div>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute z-50 left-0 right-0 mt-2 bg-dark-850 border border-dark-700/80 rounded-2xl shadow-dropdown overflow-hidden animate-slide-down">
          {searchable && options.length > 5 && (
            <div className="p-2.5 border-b border-dark-700/60">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Поиск..."
                  className="w-full bg-dark-900 border border-dark-700 rounded-xl pl-9 pr-8 py-2 text-[13px] text-white placeholder-slate-500 focus:outline-none focus:border-pink-500/50 focus:ring-1 focus:ring-pink-500/15 transition-all"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white p-0.5 rounded-md hover:bg-dark-700 transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="max-h-64 overflow-y-auto p-1.5 space-y-0.5">
            {filtered.length === 0 ? (
              <div className="py-8 text-center text-[13px] text-slate-500">
                Ничего не найдено
              </div>
            ) : (
              filtered.map((opt) => {
                const isSelected = opt.value === value;
                return (
                  <div
                    key={opt.value}
                    title={`${opt.label}${opt.sublabel ? ` (${opt.sublabel})` : ''}`}
                    onClick={() => {
                      onChange(opt.value);
                      setIsOpen(false);
                    }}
                    className={`flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer text-[13px] transition-all duration-150 ${
                      isSelected
                        ? 'bg-pink-500/10 text-white font-medium ring-1 ring-pink-500/20'
                        : 'hover:bg-dark-800 text-slate-300 hover:text-slate-100'
                    }`}
                  >
                    <div className="flex items-start gap-2.5 min-w-0 flex-1">
                      {opt.icon && <span className="shrink-0 mt-0.5">{opt.icon}</span>}
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium leading-snug">{opt.label}</div>
                        {opt.sublabel && (
                          <div className="text-[11px] text-slate-500 truncate leading-tight mt-0.5">
                            {opt.sublabel}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      {opt.badge && (
                        <span
                          className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono font-medium ${
                            opt.badgeColor || 'bg-dark-800 text-slate-400'
                          }`}
                        >
                          {opt.badge}
                        </span>
                      )}
                      {isSelected && (
                        <div className="w-5 h-5 rounded-md bg-pink-500/20 flex items-center justify-center">
                          <Check className="w-3 h-3 text-pink-400" />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomSelect;
