import React, { useEffect, useState, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { 
  MessageSquare, 
  Send, 
  Save, 
  Sparkles, 
  Gamepad2, 
  Info,
  CheckCircle2, 
  RefreshCw, 
  RotateCcw,
  Search,
  Eye,
  Sliders,
  ChevronDown,
  ChevronUp,
  Tag,
  Copy,
  Check,
  Hash,
  Bell,
  Palette,
  Layers
} from 'lucide-react';
import api from '../api/client';
import { useModal } from '../context/ModalContext';
import { DiscordMarkdown } from '../components/DiscordMarkdown';

interface PlaceholderDef {
  tag: string;
  description: string;
  sample: string;
}

interface MessageDef {
  key: string;
  category: string;
  name: string;
  description: string;
  defaultTitle: string;
  defaultDescription: string;
  defaultColor: string;
  defaultFooter: string;
  defaultContent?: string;
  placeholders: PlaceholderDef[];
}

interface CustomSettings {
  enabled?: boolean;
  title?: string;
  description?: string;
  color?: string;
  footer?: string;
  content?: string;
}

interface DiscordChannel {
  id: string;
  name: string;
  type: number;
}

const PRESET_COLORS = [
  { name: 'Hot Pink (Фирменный)', hex: '#EC4899' },
  { name: 'Rose Red (Внимание)', hex: '#F43F5E' },
  { name: 'Emerald (Одобрено)', hex: '#10B981' },
  { name: 'Crimson (Отказ / ЧС)', hex: '#BE185D' },
  { name: 'Amber (Ожидание)', hex: '#F59E0B' },
  { name: 'Indigo (Отпуска)', hex: '#6366F1' },
  { name: 'Sky Blue (Войс)', hex: '#3B82F6' },
  { name: 'Deep Dark (Строгий)', hex: '#1E232F' },
];

export const BotMessages: React.FC = () => {
  const modal = useModal();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingKey, setTestingKey] = useState<string | null>(null);

  const [catalog, setCatalog] = useState<MessageDef[]>([]);
  const [customMessages, setCustomMessages] = useState<Record<string, CustomSettings>>({});
  const [channels, setChannels] = useState<DiscordChannel[]>([]);
  const [testChannelId, setTestChannelId] = useState('');

  // Bot Presence state
  const [botStatusText, setBotStatusText] = useState('Majestic RP • /event');
  const [botStatusActivity, setBotStatusActivity] = useState('PLAYING');

  // Filter & Search
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [expandedKeys, setExpandedKeys] = useState<Record<string, boolean>>({});
  const [activeInputKey, setActiveInputKey] = useState<{ key: string; field: 'title' | 'description' | 'footer' | 'content' } | null>(null);
  const [copiedTag, setCopiedTag] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [messagesRes, channelsRes] = await Promise.all([
        api.get('/bot-messages'),
        api.get('/guild/channels'),
      ]);

      const cat: MessageDef[] = messagesRes.data.catalog || [];
      setCatalog(cat);
      setCustomMessages(messagesRes.data.customMessages || {});

      if (messagesRes.data.config) {
        setBotStatusText(messagesRes.data.config.botStatusText || 'Majestic RP • /event');
        setBotStatusActivity(messagesRes.data.config.botStatusActivity || 'PLAYING');
      }

      const textChannels = (channelsRes.data.channels || []).filter(
        (c: DiscordChannel) => c.type === 0 || c.type === 5
      );
      setChannels(textChannels);
      if (textChannels.length > 0 && !testChannelId) {
        setTestChannelId(textChannels[0].id);
      }

      // Default expand first 2 items
      const initialExpanded: Record<string, boolean> = {};
      cat.slice(0, 3).forEach((item) => {
        initialExpanded[item.key] = true;
      });
      setExpandedKeys(initialExpanded);
    } catch (err: any) {
      modal.error(err.response?.data?.error || 'Ошибка при загрузке сообщений бота');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const categories = useMemo(() => {
    const set = new Set<string>();
    catalog.forEach((item) => set.add(item.category));
    return ['ALL', ...Array.from(set)];
  }, [catalog]);

  const toggleExpand = (key: string) => {
    setExpandedKeys((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleCustomChange = (key: string, field: keyof CustomSettings, value: any) => {
    setCustomMessages((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        [field]: value,
      },
    }));
  };

  // Insert placeholder into the active field of the active message
  const insertPlaceholder = (itemKey: string, field: 'title' | 'description' | 'footer' | 'content', tag: string) => {
    const currentVal = customMessages[itemKey]?.[field] ?? (catalog.find(c => c.key === itemKey) as any)?.[`default${field.charAt(0).toUpperCase() + field.slice(1)}`] ?? '';
    const updated = `${currentVal} ${tag}`;
    handleCustomChange(itemKey, field, updated);

    setCopiedTag(tag);
    setTimeout(() => setCopiedTag(null), 1200);
  };

  // Reset a message to default
  const handleResetMessage = async (key: string) => {
    try {
      await api.post(`/bot-messages/reset/${key}`);
      setCustomMessages((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      modal.success('Шаблон сообщения сброшен к стандартному!');
    } catch (err: any) {
      modal.error(err.response?.data?.error || 'Ошибка сброса шаблона');
    }
  };

  // Save all messages
  const handleSaveAll = async () => {
    try {
      setSaving(true);
      await api.post('/bot-messages', {
        customMessages,
        botStatusText,
        botStatusActivity,
      });
      modal.success('Абсолютно все настройки сообщений и плейсхолдеров успешно сохранены!');
    } catch (err: any) {
      modal.error(err.response?.data?.error || 'Ошибка сохранения сообщений');
    } finally {
      setSaving(false);
    }
  };

  // Live test in Discord
  const handleTestMessage = async (key: string) => {
    if (!testChannelId) {
      modal.warning('Выберите текстовый канал для отправки тестового сообщения!');
      return;
    }

    try {
      setTestingKey(key);
      const res = await api.post('/bot-messages/test-template', {
        key,
        channelId: testChannelId,
        previewSettings: customMessages[key],
      });
      modal.success(res.data.message || 'Тестовое сообщение отправлено в Discord!');
    } catch (err: any) {
      modal.error(err.response?.data?.error || 'Ошибка при отправке теста в Discord');
    } finally {
      setTestingKey(null);
    }
  };

  // Filtered catalog
  const filteredCatalog = useMemo(() => {
    return catalog.filter((item) => {
      if (selectedCategory !== 'ALL' && item.category !== selectedCategory) {
        return false;
      }
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchName = item.name.toLowerCase().includes(q);
        const matchKey = item.key.toLowerCase().includes(q);
        const matchDesc = item.description.toLowerCase().includes(q);
        const matchCat = item.category.toLowerCase().includes(q);
        if (!matchName && !matchKey && !matchDesc && !matchCat) {
          return false;
        }
      }
      return true;
    });
  }, [catalog, selectedCategory, search]);

  // Helper to render live preview string with substituted placeholder samples
  const renderPreview = (item: MessageDef, text: string) => {
    if (!text) return '';
    let result = text;
    item.placeholders.forEach((p) => {
      const regex = new RegExp(p.tag.replace(/[{}]/g, '\\$&'), 'g');
      result = result.replace(regex, p.sample);
    });
    return result;
  };

  return (
    <div className="space-y-6 w-full pb-24">
      {/* Page Title & Save Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
            <MessageSquare className="w-7 h-7 text-pink-500" />
            Управление сообщениями бота
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Настройте абсолютно все сообщения, тексты, цвета и плейсхолдеры для каждого события и действия бота в Discord
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#151921] hover:bg-[#1E232F] text-slate-200 border border-[#1E232F] text-xs font-semibold transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-pink-500' : ''}`} />
            Обновить
          </button>

          <button
            onClick={handleSaveAll}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-pink-600 via-rose-500 to-fuchsia-600 hover:from-pink-500 hover:to-rose-400 text-white text-xs font-bold shadow-lg shadow-pink-600/30 transition-all disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Сохранение...' : 'Сохранить все сообщения'}
          </button>
        </div>
      </div>

      {/* Global Bot Presence Card */}
      <div className="bg-[#151921] border border-[#1E232F] rounded-2xl p-4 shadow-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-pink-500/10 border border-pink-500/25 flex items-center justify-center text-pink-400">
            <Gamepad2 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Статус и активность бота в Discord</h3>
            <p className="text-[11px] text-slate-400">Текст, отображаемый под ником бота в профиле Discord</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
          <select
            value={botStatusActivity}
            onChange={(e) => setBotStatusActivity(e.target.value)}
            className="w-full sm:w-36 bg-[#0B0E14] border border-[#1E232F] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-pink-500"
          >
            <option value="PLAYING">Играет в</option>
            <option value="WATCHING">Смотрит</option>
            <option value="LISTENING">Слушает</option>
            <option value="COMPETING">Соревнуется</option>
          </select>

          <input
            type="text"
            placeholder="Majestic RP • /event"
            value={botStatusText}
            onChange={(e) => setBotStatusText(e.target.value)}
            className="w-full sm:w-64 bg-[#0B0E14] border border-[#1E232F] rounded-xl px-3 py-2 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-pink-500"
          />
        </div>
      </div>

      {/* Testing Channel Picker & Search Toolbar */}
      <div className="bg-[#151921] border border-[#1E232F] rounded-2xl p-4 space-y-3 shadow-lg">
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
          {/* Search box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Поиск по названию сообщения (приветствие, отпуск, тир, капт, статик)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-[#0B0E14] border border-[#1E232F] rounded-xl pl-9 pr-3 py-2.5 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-pink-500 transition-colors"
            />
          </div>

          {/* Test Channel Selector */}
          <div className="w-full md:w-80 flex items-center gap-2 bg-[#0B0E14] border border-[#1E232F] rounded-xl px-3 py-1.5">
            <Send className="w-4 h-4 text-pink-400 flex-shrink-0" />
            <div className="flex-1">
              <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                Канал для тестов в Discord:
              </div>
              <select
                value={testChannelId}
                onChange={(e) => setTestChannelId(e.target.value)}
                className="w-full bg-transparent text-xs text-white focus:outline-none cursor-pointer"
              >
                {channels.map((c) => (
                  <option key={c.id} value={c.id} className="bg-[#151921]">
                    #{c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Category Pills */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#1E232F]/60">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 text-[11px] font-semibold rounded-xl transition-all ${
                selectedCategory === cat
                  ? 'bg-gradient-to-r from-pink-600 to-rose-500 text-white shadow-md shadow-pink-600/25'
                  : 'bg-[#0B0E14] text-slate-400 hover:text-slate-200 border border-[#1E232F]'
              }`}
            >
              {cat === 'ALL' ? 'Все категории' : cat}
            </button>
          ))}
          <div className="ml-auto text-xs text-slate-400 font-medium">
            Шаблонов: <strong className="text-pink-400">{filteredCatalog.length}</strong>
          </div>
        </div>
      </div>

      {/* Message Templates List */}
      <div className="space-y-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center p-16 text-slate-400 space-y-3 bg-[#151921] border border-[#1E232F] rounded-2xl">
            <div className="w-10 h-10 border-2 border-pink-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-xs">Загрузка каталога сообщений бота...</p>
          </div>
        ) : filteredCatalog.length === 0 ? (
          <div className="p-16 text-center text-slate-500 text-xs bg-[#151921] border border-[#1E232F] rounded-2xl">
            Сообщения по вашему запросу не найдены
          </div>
        ) : (
          filteredCatalog.map((item) => {
            const isExpanded = Boolean(expandedKeys[item.key]);
            const custom = customMessages[item.key] || {};
            const isEnabled = custom.enabled !== undefined ? custom.enabled : true;

            const currentTitle = custom.title !== undefined ? custom.title : item.defaultTitle;
            const currentDesc = custom.description !== undefined ? custom.description : item.defaultDescription;
            const currentColor = custom.color || item.defaultColor;
            const currentFooter = custom.footer !== undefined ? custom.footer : item.defaultFooter;
            const currentContent = custom.content !== undefined ? custom.content : (item.defaultContent || '');

            const previewTitle = renderPreview(item, currentTitle);
            const previewDesc = renderPreview(item, currentDesc);
            const previewFooter = renderPreview(item, currentFooter);
            const previewContent = renderPreview(item, currentContent);

            return (
              <div
                key={item.key}
                className="bg-[#151921] border border-[#1E232F] rounded-2xl overflow-hidden shadow-xl transition-all"
              >
                {/* Header / Collapse Bar */}
                <div
                  onClick={() => toggleExpand(item.key)}
                  className="p-4 flex items-center justify-between cursor-pointer hover:bg-[#1A1F2B]/60 transition-colors border-b border-[#1E232F]/50"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="w-3.5 h-3.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: currentColor }}
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-white text-sm">{item.name}</h3>
                        <span className="px-2 py-0.5 rounded-md bg-[#0B0E14] border border-[#1E232F] text-[10px] text-pink-400 font-mono">
                          {item.key}
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-[#1E232F] text-[10px] text-slate-400">
                          {item.category}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">{item.description}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                    {/* Enable / Disable Switch */}
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <span className="text-[11px] text-slate-400">
                        {isEnabled ? 'Активно' : 'Отключено'}
                      </span>
                      <div className="relative inline-flex items-center">
                        <input
                          type="checkbox"
                          checked={isEnabled}
                          onChange={(e) => handleCustomChange(item.key, 'enabled', e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-[#0B0E14] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-pink-600"></div>
                      </div>
                    </label>

                    {/* Expand / Collapse Icon */}
                    <button
                      onClick={() => toggleExpand(item.key)}
                      className="p-1 rounded-lg hover:bg-[#1E232F] text-slate-400 hover:text-white transition-colors"
                    >
                      {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                {/* Expanded Editor Body */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                      className="overflow-hidden"
                    >
                      <div className="p-5 space-y-5 bg-[#0D1017]">
                    {/* Available Placeholders Badges */}
                    <div className="bg-[#151921] border border-[#1E232F] rounded-xl p-3.5 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-white flex items-center gap-2">
                          <Tag className="w-3.5 h-3.5 text-pink-400" />
                          Доступные плейсхолдеры (нажмите на бейдж для быстрой вставки):
                        </span>
                        {copiedTag && (
                          <span className="text-[10px] text-emerald-400 flex items-center gap-1 font-semibold animate-in fade-in">
                            <Check className="w-3 h-3" /> Вставлено: {copiedTag}
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {item.placeholders.map((p) => (
                          <button
                            key={p.tag}
                            type="button"
                            onClick={() => {
                              const targetField = activeInputKey?.key === item.key ? activeInputKey.field : 'description';
                              insertPlaceholder(item.key, targetField, p.tag);
                            }}
                            className="px-2.5 py-1 rounded-lg bg-[#0B0E14] hover:bg-pink-600/20 text-slate-300 hover:text-pink-300 border border-[#1E232F] hover:border-pink-500/40 text-xs font-mono transition-all flex items-center gap-1.5 group"
                            title={`${p.description} (пример: ${p.sample})`}
                          >
                            <span className="text-pink-500 font-bold group-hover:scale-110 transition-transform">+</span>
                            <span>{p.tag}</span>
                            <span className="text-[10px] text-slate-500 font-sans group-hover:text-slate-300">
                              • {p.description}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Grid: Editor Inputs on Left, Live Discord Preview on Right */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                      {/* Left: Inputs */}
                      <div className="space-y-3.5">
                        {/* Title Input */}
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                            Заголовок эмбеда (Title)
                          </label>
                          <input
                            type="text"
                            value={currentTitle}
                            onFocus={() => setActiveInputKey({ key: item.key, field: 'title' })}
                            onChange={(e) => handleCustomChange(item.key, 'title', e.target.value)}
                            className="w-full bg-[#151921] border border-[#1E232F] rounded-xl px-3 py-2 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-pink-500"
                          />
                        </div>

                        {/* Content text above embed (mentions, etc.) */}
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-300 mb-1 flex items-center justify-between">
                            <span>Текст над сообщением (Content / Пинги)</span>
                            <span className="text-[10px] text-slate-500">Необязательно (например: {`{user}`} или @everyone)</span>
                          </label>
                          <input
                            type="text"
                            value={currentContent}
                            onFocus={() => setActiveInputKey({ key: item.key, field: 'content' })}
                            onChange={(e) => handleCustomChange(item.key, 'content', e.target.value)}
                            placeholder="{user}"
                            className="w-full bg-[#151921] border border-[#1E232F] rounded-xl px-3 py-2 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-pink-500 font-mono"
                          />
                        </div>

                        {/* Description Textarea */}
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-300 mb-1 flex items-center justify-between">
                            <span>Основной текст описания (Description)</span>
                            <span className="text-[10px] text-slate-500">Поддерживает Discord Markdown (жирный, курсив, списки)</span>
                          </label>
                          <textarea
                            rows={6}
                            value={currentDesc}
                            onFocus={() => setActiveInputKey({ key: item.key, field: 'description' })}
                            onChange={(e) => handleCustomChange(item.key, 'description', e.target.value)}
                            className="w-full bg-[#151921] border border-[#1E232F] rounded-xl p-3 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-pink-500 resize-y font-mono leading-relaxed"
                          />
                        </div>

                        {/* Color Selector */}
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                            <Palette className="w-3 h-3 text-pink-400" />
                            Цвет боковой полосы эмбеда (Hex)
                          </label>
                          <div className="flex flex-wrap items-center gap-2">
                            {PRESET_COLORS.map((col) => (
                              <button
                                key={col.hex}
                                type="button"
                                onClick={() => handleCustomChange(item.key, 'color', col.hex)}
                                className={`w-6 h-6 rounded-lg border transition-transform hover:scale-110 ${
                                  currentColor.toUpperCase() === col.hex.toUpperCase()
                                    ? 'ring-2 ring-white ring-offset-2 ring-offset-[#0B0E14]'
                                    : 'border-white/10'
                                }`}
                                style={{ backgroundColor: col.hex }}
                                title={col.name}
                              />
                            ))}
                            <input
                              type="text"
                              value={currentColor}
                              onChange={(e) => handleCustomChange(item.key, 'color', e.target.value)}
                              className="w-24 bg-[#151921] border border-[#1E232F] rounded-lg px-2 py-1 text-xs text-white font-mono uppercase focus:outline-none focus:border-pink-500 ml-2"
                            />
                          </div>
                        </div>

                        {/* Footer Input */}
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                            Подвал сообщения (Footer)
                          </label>
                          <input
                            type="text"
                            value={currentFooter}
                            onFocus={() => setActiveInputKey({ key: item.key, field: 'footer' })}
                            onChange={(e) => handleCustomChange(item.key, 'footer', e.target.value)}
                            className="w-full bg-[#151921] border border-[#1E232F] rounded-xl px-3 py-2 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-pink-500"
                          />
                        </div>
                      </div>

                      {/* Right: Live Discord Preview */}
                      <div className="space-y-2 flex flex-col justify-start">
                        <label className="text-[11px] font-semibold text-slate-400 flex items-center gap-1.5">
                          <Eye className="w-3.5 h-3.5 text-pink-400" />
                          Живой предпросмотр (как увидит игрок в Discord):
                        </label>

                        <div className="bg-[#2B2D31] rounded-xl p-4 shadow-xl border border-white/5 space-y-2 flex-1">
                          {/* Text content above embed */}
                          {previewContent && (
                            <div className="text-xs text-[#DBDEE1] font-sans pb-1 break-words">
                              <DiscordMarkdown content={previewContent} />
                            </div>
                          )}

                          {/* Embed card */}
                          <div
                            className="bg-[#1E1F22] rounded-lg p-3.5 border-l-4 space-y-2 text-left"
                            style={{ borderColor: currentColor }}
                          >
                            {/* Title */}
                            {previewTitle && (
                              <h4 className="font-bold text-[#F2F3F5] text-sm leading-snug">
                                <DiscordMarkdown content={previewTitle} />
                              </h4>
                            )}

                            {/* Description with full Discord formatting */}
                            {previewDesc && (
                              <div className="text-xs text-[#DBDEE1] leading-relaxed font-sans">
                                <DiscordMarkdown content={previewDesc} />
                              </div>
                            )}

                            {/* Footer */}
                            {previewFooter && (
                              <div className="text-[10px] text-[#949BA4] pt-2 border-t border-white/5 flex items-center gap-2">
                                <DiscordMarkdown content={previewFooter} />
                                <span>•</span>
                                <span>Сегодня в 21:00</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Action buttons inside card */}
                        <div className="flex items-center justify-between pt-2">
                          <button
                            type="button"
                            onClick={() => handleResetMessage(item.key)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#151921] hover:bg-[#1E232F] text-slate-400 hover:text-rose-400 border border-[#1E232F] text-xs font-semibold transition-colors"
                          >
                            <RotateCcw className="w-3 h-3" />
                            Сбросить к стандарту
                          </button>

                          <button
                            type="button"
                            disabled={testingKey === item.key}
                            onClick={() => handleTestMessage(item.key)}
                            className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-pink-600/20 hover:bg-pink-600/30 text-pink-400 border border-pink-500/30 text-xs font-semibold transition-all disabled:opacity-50"
                          >
                            <Send className="w-3.5 h-3.5" />
                            {testingKey === item.key ? 'Отправка...' : 'Отправить тест в Discord'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
            );
          })
        )}
      </div>

      {/* Floating Save Toolbar at Bottom */}
      <div className="fixed bottom-4 left-64 right-8 z-20 flex justify-end pointer-events-none">
        <div className="pointer-events-auto bg-[#151921]/95 backdrop-blur-md border border-pink-500/30 shadow-2xl shadow-pink-600/20 rounded-2xl p-3 px-6 flex items-center gap-4 animate-in fade-in slide-in-from-bottom-4">
          <div className="text-xs text-slate-300 hidden sm:block">
            Изменения сообщений и плейсхолдеров готовы к публикации
          </div>
          <button
            onClick={handleSaveAll}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-pink-600 via-rose-500 to-fuchsia-600 hover:from-pink-500 hover:to-rose-400 text-white text-xs font-bold shadow-lg shadow-pink-600/30 transition-all disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Сохранение...' : 'Сохранить все изменения'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default BotMessages;
