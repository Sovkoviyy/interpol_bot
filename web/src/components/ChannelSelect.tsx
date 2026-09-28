import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Hash, Volume2, FolderTree, Search, X, Check } from 'lucide-react';

export interface DiscordChannelItem {
  id: string;
  name: string;
  type: number | string;
  parentId?: string | null;
}

interface ChannelSelectProps {
  channels: DiscordChannelItem[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  channelType?: 'text' | 'voice' | 'category' | 'all';
  allowClear?: boolean;
}

export const ChannelSelect: React.FC<ChannelSelectProps> = ({
  channels,
  value,
  onChange,
  placeholder = 'Выберите канал...',
  channelType = 'all',
  allowClear = true,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Close on outside click
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

  // Filter by requested type
  const filteredByType = channels.filter((c) => {
    if (channelType === 'text') return c.type === 0 || c.type === 'GUILD_TEXT';
    if (channelType === 'voice') return c.type === 2 || c.type === 'GUILD_VOICE';
    if (channelType === 'category') return c.type === 4 || c.type === 'GUILD_CATEGORY';
    return true;
  });

  // Filter by search keyword
  const filteredChannels = filteredByType.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.id.includes(search)
  );

  const selectedChannel = channels.find((c) => c.id === value);
  const parentCategory = selectedChannel?.parentId
    ? channels.find((c) => c.id === selectedChannel.parentId)
    : null;

  const renderIcon = (type: number | string) => {
    if (type === 4 || type === 'GUILD_CATEGORY') {
      return <FolderTree className="w-3.5 h-3.5 text-pink-400 shrink-0" />;
    }
    if (type === 2 || type === 'GUILD_VOICE') {
      return <Volume2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />;
    }
    return <Hash className="w-3.5 h-3.5 text-slate-400 shrink-0" />;
  };

  return (
    <div className="relative w-full" ref={containerRef}>
      {/* Trigger Box */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full min-h-[42px] bg-dark-900 border rounded-xl px-3.5 py-2 flex items-center justify-between gap-2 cursor-pointer transition-all duration-200 ${
          isOpen
            ? 'border-pink-500/60 ring-2 ring-pink-500/15 bg-dark-850'
            : 'border-dark-700 hover:border-dark-600 hover:bg-dark-850'
        }`}
        title={
          selectedChannel
            ? `${selectedChannel.name}${parentCategory ? ` (в категории «${parentCategory.name}»)` : ''} • ID: ${selectedChannel.id}`
            : undefined
        }
      >
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          {selectedChannel ? (
            <>
              {renderIcon(selectedChannel.type)}
              <span className="text-[13px] font-medium text-slate-100 truncate">
                {selectedChannel.name}
              </span>
              {parentCategory && (
                <span className="text-[11px] text-slate-500 shrink-0 max-w-[45%] truncate hidden sm:inline">
                  • в {parentCategory.name}
                </span>
              )}
            </>
          ) : (
            <span className="text-[13px] text-slate-500 select-none flex items-center gap-1.5 truncate">
              <Hash className="w-3.5 h-3.5 text-slate-600 shrink-0" />
              <span className="truncate">{placeholder}</span>
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0 ml-1">
          {allowClear && value && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onChange('');
              }}
              className="p-1 rounded-md hover:bg-dark-700 text-slate-500 hover:text-rose-400 transition-all"
              title="Сбросить канал"
            >
              <X className="w-3 h-3" />
            </button>
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
                placeholder="Поиск по названию или ID..."
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
              <span>Доступно: {filteredChannels.length}</span>
              {selectedChannel && (
                <span className="text-pink-400 truncate max-w-[160px] font-medium">
                  #{selectedChannel.name}
                </span>
              )}
            </div>
          </div>

          {/* Channels List */}
          <div className="max-h-64 overflow-y-auto p-1.5 space-y-0.5">
            {allowClear && (
              <div
                onClick={() => {
                  onChange('');
                  setIsOpen(false);
                }}
                className={`flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer text-[13px] transition-all duration-150 ${
                  !value
                    ? 'bg-pink-500/10 text-pink-400 font-medium ring-1 ring-pink-500/20'
                    : 'hover:bg-dark-800 text-slate-400'
                }`}
              >
                <span className="italic">Не выбран (очистить)</span>
                {!value && (
                  <div className="w-5 h-5 rounded-md bg-pink-500/20 flex items-center justify-center">
                    <Check className="w-3 h-3 text-pink-400" />
                  </div>
                )}
              </div>
            )}

            {filteredChannels.length === 0 ? (
              <div className="py-8 text-center text-[13px] text-slate-500">
                Каналы не найдены
              </div>
            ) : (
              filteredChannels.map((ch) => {
                const isSelected = ch.id === value;
                const parent = ch.parentId
                  ? channels.find((p) => p.id === ch.parentId)
                  : null;

                return (
                  <div
                    key={ch.id}
                    title={`${ch.name}${parent ? ` (в категории «${parent.name}»)` : ''} • ID: ${ch.id}`}
                    onClick={() => {
                      onChange(ch.id);
                      setIsOpen(false);
                    }}
                    className={`flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer text-[13px] transition-all duration-150 ${
                      isSelected
                        ? 'bg-pink-500/10 text-white font-medium ring-1 ring-pink-500/20'
                        : 'hover:bg-dark-800 text-slate-300 hover:text-slate-100'
                    }`}
                  >
                    <div className="flex items-start gap-2.5 min-w-0 flex-1">
                      <div className="mt-0.5 shrink-0">{renderIcon(ch.type)}</div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium leading-snug">
                          {ch.name}
                        </div>
                        {parent && (
                          <div className="text-[11px] text-slate-500 truncate leading-tight mt-0.5">
                            в {parent.name}
                          </div>
                        )}
                      </div>
                    </div>

                    {isSelected && (
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

export default ChannelSelect;
