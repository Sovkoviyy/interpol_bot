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
    if (!isOpen) setSearch('');
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
        className={`w-full min-h-[42px] bg-dark-900 border rounded-xl px-3.5 py-1.5 flex items-center justify-between gap-2 cursor-pointer transition-all duration-200 ${
          isOpen
            ? 'border-pink-500/60 ring-2 ring-pink-500/15 bg-dark-850'
            : 'border-dark-700 hover:border-dark-600 hover:bg-dark-850'
        }`}
      >
        <div className="flex flex-wrap items-center gap-1.5 flex-1 min-w-0 py-0.5">
          {selectedIds.length === 0 ? (
            <span className="text-[13px] text-slate-500 flex items-center gap-1.5 select-none">
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
                  title={`@${name} • ID: ${id}`}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[12px] font-medium border transition-all shadow-sm select-none hover:brightness-110"
                  style={{
                    backgroundColor: `${hex}15`,
                    borderColor: `${hex}35`,
                    color: hex !== '#94a3b8' ? hex : '#e2e8f0',
                  }}
                >
                  <span
                    className="w-2 h-2 rounded-full shrink-0 shadow-sm ring-1 ring-white/10"
                    style={{ backgroundColor: hex }}
                  />
                  <span className="truncate max-w-[200px]">@{name}</span>
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
              className="text-[10px] text-slate-500 hover:text-rose-400 font-medium px-1.5 py-0.5 rounded-md hover:bg-rose-500/10 transition-all"
              title="Сбросить все выбранные роли"
            >
              Сброс
            </button>
          )}
          {isMulti && selectedIds.length > 1 && (
            <span className="px-1.5 py-0.5 text-[10px] font-mono bg-pink-500/15 text-pink-300 rounded-md font-semibold">
              {selectedIds.length}
            </span>
          )}
          <ChevronDown
            className={`w-4 h-4 text-slate-500 transition-transform duration-200 ${
              isOpen ? 'rotate-180 text-pink-400' : ''
            }`}
          />
        </div>
      </div>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute z-50 left-0 right-0 mt-2 bg-dark-850 border border-dark-700/80 rounded-2xl shadow-dropdown overflow-hidden animate-slide-down">
          {/* Search Header */}
          <div className="p-2.5 border-b border-dark-700/60 space-y-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                ref={searchInputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Поиск роли по названию или ID..."
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
            <div className="flex items-center justify-between text-[11px] text-slate-500 px-1">
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
          <div className="max-h-64 overflow-y-auto p-1.5 space-y-0.5">
            {filteredRoles.length === 0 ? (
              <div className="py-8 text-center text-[13px] text-slate-500">
                Роли не найдены по запросу «{search}»
              </div>
            ) : (
              filteredRoles.map((role) => {
                const isSelected = selectedIds.includes(role.id);
                const hex = roleColorToHex(role.color);

                return (
                  <div
                    key={role.id}
                    title={`@${role.name} • ID: ${role.id}`}
                    onClick={() => handleToggleRole(role.id)}
                    className={`flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer text-[13px] transition-all duration-150 ${
                      isSelected
                        ? 'bg-pink-500/10 text-white font-medium ring-1 ring-pink-500/20'
                        : 'hover:bg-dark-800 text-slate-300 hover:text-slate-100'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      {/* Checkbox badge for multi-select */}
                      {isMulti && (
                        <div
                          className={`w-4 h-4 rounded-md flex items-center justify-center shrink-0 border transition-all duration-150 ${
                            isSelected
                              ? 'bg-pink-500 border-pink-500 text-white shadow-sm shadow-pink-500/30'
                              : 'border-dark-600 bg-dark-900'
                          }`}
                        >
                          {isSelected && <Check className="w-3 h-3" />}
                        </div>
                      )}

                      {/* Color Dot */}
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm ring-1 ring-white/10"
                        style={{ backgroundColor: hex }}
                      />

                      <span
                        className="font-medium truncate min-w-0 flex-1"
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

                    {!isMulti && isSelected && (
                      <div className="w-5 h-5 rounded-md bg-pink-500/20 flex items-center justify-center ml-2">
                        <Check className="w-3 h-3 text-pink-400" />
                      </div>
                    )}
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
