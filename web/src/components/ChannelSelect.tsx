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
        className={`w-full min-h-[40px] bg-[#0B0E14] border rounded-xl px-3 py-2 flex items-center justify-between gap-2 cursor-pointer transition-all shadow-sm ${
          isOpen
            ? 'border-pink-500 ring-1 ring-pink-500/30'
            : 'border-[#1E232F] hover:border-pink-500/40'
        }`}
        title={
          selectedChannel
            ? `${selectedChannel.name}${parentCategory ? ` (в категории «${parentCategory.name}»)` : ''} • ID: ${selectedChannel.id}`
            : undefined
        }
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {selectedChannel ? (
            <>
              {renderIcon(selectedChannel.type)}
              <span className="text-xs font-medium text-white truncate">
                {selectedChannel.name}
              </span>
              {parentCategory && (
                <span className="text-[10px] text-slate-400 shrink-0 max-w-[45%] truncate hidden sm:inline">
                  • в {parentCategory.name}
                </span>
              )}
            </>
          ) : (
            <span className="text-xs text-slate-500 select-none flex items-center gap-1.5 truncate">
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
              className="p-1 rounded hover:bg-slate-800 text-slate-500 hover:text-rose-400 transition"
              title="Сбросить канал"
            >
              <X className="w-3 h-3" />
            </button>
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
                placeholder="Поиск по названию или ID..."
                className="w-full bg-[#0B0E14] border border-[#1E232F] rounded-lg pl-9 pr-7 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-pink-500 transition-colors"
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
              <span>Доступно: {filteredChannels.length}</span>
              {selectedChannel && (
                <span className="text-pink-400 truncate max-w-[160px]">
                  #{selectedChannel.name}
                </span>
              )}
            </div>
          </div>

          {/* Channels List */}
          <div className="max-h-64 overflow-y-auto p-1.5 space-y-1 custom-scrollbar">
            {allowClear && (
              <div
                onClick={() => {
                  onChange('');
                  setIsOpen(false);
                }}
                className={`flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer text-xs transition-all ${
                  !value
                    ? 'bg-pink-500/10 text-pink-400 font-semibold'
                    : 'hover:bg-[#1E232F] text-slate-400'
                }`}
              >
                <span className="italic">Не выбран (очистить)</span>
                {!value && <Check className="w-3.5 h-3.5 text-pink-400 shrink-0" />}
              </div>
            )}

            {filteredChannels.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-500">
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
                    className={`flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer text-xs transition-all ${
                      isSelected
                        ? 'bg-pink-500/15 border border-pink-500/30 text-white font-medium'
                        : 'hover:bg-[#1E232F] border border-transparent text-slate-300'
                    }`}
                  >
                    <div className="flex items-start gap-2.5 min-w-0 flex-1">
                      <div className="mt-0.5 shrink-0">{renderIcon(ch.type)}</div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-xs font-medium leading-snug">
                          {ch.name}
                        </div>
                        {parent && (
                          <div className="text-[10px] text-slate-400/80 truncate leading-tight mt-0.5">
                            в {parent.name}
                          </div>
                        )}
                      </div>
                    </div>

                    {isSelected && (
                      <Check className="w-4 h-4 text-pink-400 shrink-0 ml-2" />
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
