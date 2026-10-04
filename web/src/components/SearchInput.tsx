import React from 'react';
import { Search } from 'lucide-react';

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export const SearchInput: React.FC<SearchInputProps> = ({
  value,
  onChange,
  placeholder = 'Поиск...',
  className = '',
}) => (
  <div className={`relative ${className}`}>
    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
    <input
      type="text"
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full bg-[#0B0E14] border border-[#1E232F] text-white text-sm pl-9 pr-4 py-2 rounded-xl focus:outline-none focus:border-pink-500/50 focus:ring-1 focus:ring-pink-500/20 placeholder-slate-600 transition"
    />
  </div>
);
