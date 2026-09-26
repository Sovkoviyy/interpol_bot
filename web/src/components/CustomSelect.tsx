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
        className={`w-full min-h-[40px] bg-[#0B0E14] border rounded-xl px-3 py-2 flex items-center justify-between gap-2 cursor-pointer transition-all shadow-sm ${
          isOpen
            ? 'border-pink-500 ring-1 ring-pink-500/30'
            : 'border-[#1E232F] hover:border-pink-500/40'
        }`}
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {selectedOption ? (
            <>
              {selectedOption.icon && <span className="shrink-0">{selectedOption.icon}</span>}
              <span className="text-xs font-medium text-white truncate">
                {selectedOption.label}
              </span>
              {selectedOption.sublabel && (
                <span className="text-[10px] text-slate-500 truncate hidden sm:inline">
                  {selectedOption.sublabel}
                </span>
              )}
            </>
          ) : (
            <span className="text-xs text-slate-500 select-none">
              {placeholder}
            </span>
          )}
        </div>

        <ChevronDown
          className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-200 ${
            isOpen ? 'rotate-180 text-pink-400' : ''
          }`}
        />
      </div>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute z-50 left-0 right-0 mt-1.5 bg-[#151921] border border-[#1E232F] rounded-xl shadow-2xl shadow-black/80 overflow-hidden backdrop-blur-md animate-in fade-in zoom-in-95 duration-150">
          {searchable && options.length > 5 && (
            <div className="p-2 border-b border-[#1E232F] bg-[#11141B]">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Поиск..."
                  className="w-full bg-[#0B0E14] border border-[#1E232F] rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-pink-500 transition-colors"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="max-h-56 overflow-y-auto p-1.5 space-y-1 custom-scrollbar">
            {filtered.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-500">
                Ничего не найдено
              </div>
            ) : (
              filtered.map((opt) => {
                const isSelected = opt.value === value;
                return (
                  <div
                    key={opt.value}
                    onClick={() => {
                      onChange(opt.value);
                      setIsOpen(false);
                    }}
                    className={`flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer text-xs transition-all ${
                      isSelected
                        ? 'bg-pink-500/15 border border-pink-500/30 text-white font-medium'
                        : 'hover:bg-[#1E232F] border border-transparent text-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {opt.icon && <span className="shrink-0">{opt.icon}</span>}
                      <span className="truncate">{opt.label}</span>
                      {opt.sublabel && (
                        <span className="text-[10px] text-slate-500 truncate">
                          {opt.sublabel}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      {opt.badge && (
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${
                            opt.badgeColor || 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {opt.badge}
                        </span>
                      )}
                      {isSelected && <Check className="w-3.5 h-3.5 text-pink-400" />}
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
