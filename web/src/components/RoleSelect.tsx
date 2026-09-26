import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, X, Search, AtSign } from 'lucide-react';

export interface DiscordRoleItem {
  id: string;
  name: string;
  color?: number;
}

interface RoleSelectProps {
  roles: DiscordRoleItem[];
  value: string | string[];
  onChange: (value: any) => void;
  isMulti?: boolean;
  placeholder?: string;
}

export function roleColorToHex(colorNum?: number): string {
  if (!colorNum || colorNum === 0) return '#94a3b8'; // default slate-400
  return '#' + colorNum.toString(16).padStart(6, '0');
}

export const RoleSelect: React.FC<RoleSelectProps> = ({
  roles,
  value,
  onChange,
  isMulti = true,
  placeholder = 'Выберите роли из списка...',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Normalize selected IDs
  const selectedIds: string[] = Array.isArray(value)
    ? value
    : value
    ? [value]
    : [];

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus search input when opened
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  const filteredRoles = roles.filter(
    (r) =>
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      r.id.includes(search)
  );

  const handleToggleRole = (roleId: string) => {
    if (isMulti) {
      if (selectedIds.includes(roleId)) {
        onChange(selectedIds.filter((id) => id !== roleId));
      } else {
        onChange([...selectedIds, roleId]);
      }
    } else {
      if (selectedIds.includes(roleId)) {
        onChange('');
      } else {
        onChange(roleId);
      }
      setIsOpen(false);
    }
  };

  const handleRemoveSingle = (e: React.MouseEvent, roleId: string) => {
    e.stopPropagation();
    if (isMulti) {
      onChange(selectedIds.filter((id) => id !== roleId));
    } else {
      onChange('');
    }
  };

  const handleClearAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(isMulti ? [] : '');
  };

  return (
    <div className="relative w-full" ref={containerRef}>
      {/* Trigger Box */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full min-h-[42px] bg-[#0B0E14] border rounded-xl px-3 py-1.5 flex items-center justify-between gap-2 cursor-pointer transition-all shadow-sm ${
          isOpen
            ? 'border-pink-500 ring-1 ring-pink-500/30'
            : 'border-[#1E232F] hover:border-pink-500/40'
        }`}
      >
        <div className="flex flex-wrap items-center gap-1.5 flex-1 min-w-0 py-0.5">
          {selectedIds.length === 0 ? (
            <span className="text-xs text-slate-500 flex items-center gap-1.5 select-none">
              <AtSign className="w-3.5 h-3.5 text-slate-600" />
              {placeholder}
            </span>
          ) : (
            selectedIds.map((id) => {
              const r = roles.find((role) => role.id === id);
              const hex = roleColorToHex(r?.color);
              const name = r ? r.name : `Роль (${id})`;

              return (
                <span
                  key={id}
                  className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-xs font-medium border transition-colors shadow-sm select-none"
                  style={{
                    backgroundColor: `${hex}18`,
                    borderColor: `${hex}40`,
                    color: hex !== '#94a3b8' ? hex : '#e2e8f0',
                  }}
                >
                  <span
                    className="w-2 h-2 rounded-full shrink-0 shadow-sm"
                    style={{ backgroundColor: hex }}
                  />
                  <span className="truncate max-w-[150px]">@{name}</span>
                  <button
                    type="button"
                    onClick={(e) => handleRemoveSingle(e, id)}
                    className="hover:opacity-80 p-0.5 rounded hover:bg-black/20 text-slate-400 hover:text-white transition"
                    title="Удалить роль"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              );
            })
          )}
        </div>

        {/* Right side indicators */}
        <div className="flex items-center gap-1.5 shrink-0 ml-1">
          {selectedIds.length > 0 && (
            <button
              type="button"
              onClick={handleClearAll}
              className="text-[10px] text-slate-500 hover:text-rose-400 font-medium px-1.5 py-0.5 rounded transition"
              title="Сбросить все выбранные роли"
            >
              Сброс
            </button>
          )}
          {isMulti && selectedIds.length > 1 && (
            <span className="px-1.5 py-0.5 text-[10px] font-mono bg-pink-500/20 text-pink-300 rounded font-semibold">
              {selectedIds.length}
            </span>
          )}
          <ChevronDown
            className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
              isOpen ? 'rotate-180 text-pink-400' : ''
            }`}
          />
        </div>
      </div>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute z-50 left-0 right-0 mt-1.5 bg-[#151921] border border-[#1E232F] rounded-xl shadow-2xl shadow-black/80 overflow-hidden backdrop-blur-md animate-in fade-in zoom-in-95 duration-150">
          {/* Search Header */}
          <div className="p-2 border-b border-[#1E232F] bg-[#11141B] space-y-1.5">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                ref={searchInputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Поиск роли по названию или ID..."
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
            <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
              <span>
                {filteredRoles.length} ролей {isMulti ? '(мульти-выбор)' : ''}
              </span>
              {selectedIds.length > 0 && (
                <span className="text-pink-400 font-medium">
                  Выбрано: {selectedIds.length}
                </span>
              )}
            </div>
          </div>

          {/* Roles List */}
          <div className="max-h-56 overflow-y-auto p-1.5 space-y-1 custom-scrollbar">
            {filteredRoles.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-500">
                Роли не найдены по запросу «{search}»
              </div>
            ) : (
              filteredRoles.map((role) => {
                const isSelected = selectedIds.includes(role.id);
                const hex = roleColorToHex(role.color);

                return (
                  <div
                    key={role.id}
                    onClick={() => handleToggleRole(role.id)}
                    className={`flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer text-xs transition-all ${
                      isSelected
                        ? 'bg-pink-500/15 border border-pink-500/30 text-white'
                        : 'hover:bg-[#1E232F] border border-transparent text-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {/* Checkbox badge */}
                      <div
                        className={`w-4 h-4 rounded flex items-center justify-center shrink-0 border transition-colors ${
                          isSelected
                            ? 'bg-pink-500 border-pink-500 text-white'
                            : 'border-slate-700 bg-[#0B0E14]'
                        }`}
                      >
                        {isSelected && <Check className="w-3 h-3" />}
                      </div>

                      {/* Color Dot */}
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm"
                        style={{ backgroundColor: hex }}
                      />

                      <span
                        className="font-medium truncate"
                        style={{
                          color: isSelected
                            ? '#ffffff'
                            : hex !== '#94a3b8'
                            ? hex
                            : '#e2e8f0',
                        }}
                      >
                        @{role.name}
                      </span>
                    </div>

                    <span className="text-[10px] text-slate-500 font-mono shrink-0 ml-2">
                      ID: {role.id}
                    </span>
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

export default RoleSelect;
