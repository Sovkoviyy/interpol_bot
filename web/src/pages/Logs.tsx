import React, { useEffect, useState, useMemo } from 'react';
import { 
  ScrollText, 
  Save, 
  Wand2, 
  ShieldCheck, 
  MessageSquare, 
  UserCheck, 
  ShieldAlert, 
  Hash, 
  Mic, 
  Link2, 
  Bot, 
  CheckCircle2, 
  Swords,
  Search,
  Filter,
  RefreshCw,
  Trash2,
  PlusCircle,
  UserX,
  Shield,
  Layers,
  Sparkles,
  Clock,
  ChevronLeft,
  ChevronRight,
  Download,
  Copy,
  Check,
  Volume2,
  VolumeX,
  UserMinus,
  UserPlus,
  Edit3,
  Radio,
  FileSpreadsheet,
  FileCode,
  Calendar,
  AlertCircle,
  ExternalLink
} from 'lucide-react';
import api from '../api/client';
import { useModal } from '../context/ModalContext';
import { ChannelSelect } from '../components/ChannelSelect';
import { CustomSelect } from '../components/CustomSelect';
import { Modal } from '../components/Modal';

// Action metadata mapping for badges, labels and icons
interface ActionDefinition {
  label: string;
  category: string;
  badgeClass: string;
  icon: React.ComponentType<{ className?: string }>;
}

const ACTION_DEFINITIONS: Record<string, ActionDefinition> = {
  // Moderation & Mutes
  MEMBER_TIMEOUT: {
    label: 'Мут (Тайм-аут)',
    category: 'MODERATION',
    badgeClass: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    icon: Clock,
  },
  MEMBER_UNTIMEOUT: {
    label: 'Снятие мута (Размут)',
    category: 'MODERATION',
    badgeClass: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    icon: CheckCircle2,
  },
  MEMBER_KICK: {
    label: 'Кик участника',
    category: 'MODERATION',
    badgeClass: 'bg-red-500/15 text-red-400 border-red-500/30',
    icon: UserX,
  },
  MEMBER_BAN: {
    label: 'Бан участника',
    category: 'MODERATION',
    badgeClass: 'bg-rose-600/15 text-rose-400 border-rose-500/30',
    icon: ShieldAlert,
  },
  MEMBER_UNBAN: {
    label: 'Разбан',
    category: 'MODERATION',
    badgeClass: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    icon: ShieldCheck,
  },
  VOICE_SERVER_MUTE: {
    label: 'Серверный мут в войсе',
    category: 'MODERATION',
    badgeClass: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    icon: VolumeX,
  },
  VOICE_SERVER_UNMUTE: {
    label: 'Снятие мута в войсе',
    category: 'MODERATION',
    badgeClass: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    icon: Volume2,
  },
  VOICE_SERVER_DEAF: {
    label: 'Серверный деф (отключение звука)',
    category: 'MODERATION',
    badgeClass: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
    icon: VolumeX,
  },
  VOICE_SERVER_UNDEAF: {
    label: 'Снятие дефа',
    category: 'MODERATION',
    badgeClass: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    icon: Volume2,
  },
  VOICE_MOVE_MOD: {
    label: 'Перемещение в войсе',
    category: 'MODERATION',
    badgeClass: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30',
    icon: Mic,
  },
  VOICE_DISCONNECT_MOD: {
    label: 'Кик из войса',
    category: 'MODERATION',
    badgeClass: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
    icon: UserMinus,
  },
  MESSAGE_DELETE_MOD: {
    label: 'Удаление чужого сообщения',
    category: 'MODERATION',
    badgeClass: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
    icon: Trash2,
  },
  PENALTY_ADDED: {
    label: 'Выдача штрафа',
    category: 'MODERATION',
    badgeClass: 'bg-red-500/15 text-red-400 border-red-500/30',
    icon: ShieldAlert,
  },
  PENALTY_REMOVED: {
    label: 'Снятие штрафа',
    category: 'MODERATION',
    badgeClass: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    icon: CheckCircle2,
  },

  // Members & Roles
  MEMBER_JOIN: {
    label: 'Вход на сервер',
    category: 'MEMBERS',
    badgeClass: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    icon: UserPlus,
  },
  MEMBER_LEAVE: {
    label: 'Выход с сервера',
    category: 'MEMBERS',
    badgeClass: 'bg-slate-500/15 text-slate-400 border-slate-500/30',
    icon: UserMinus,
  },
  MEMBER_NICKNAME_UPDATE: {
    label: 'Смена никнейма',
    category: 'MEMBERS',
    badgeClass: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
    icon: Edit3,
  },
  MEMBER_ROLES_UPDATE: {
    label: 'Изменение ролей',
    category: 'ROLES',
    badgeClass: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
    icon: Shield,
  },
  ROLE_CREATE: {
    label: 'Создание роли',
    category: 'ROLES',
    badgeClass: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    icon: PlusCircle,
  },
  ROLE_DELETE: {
    label: 'Удаление роли',
    category: 'ROLES',
    badgeClass: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
    icon: Trash2,
  },
  ROLE_UPDATE: {
    label: 'Обновление роли',
    category: 'ROLES',
    badgeClass: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
    icon: Shield,
  },

  // Messages
  MESSAGE_DELETE: {
    label: 'Удаление сообщения',
    category: 'MESSAGES',
    badgeClass: 'bg-slate-500/15 text-slate-300 border-slate-500/30',
    icon: Trash2,
  },
  MESSAGE_EDIT: {
    label: 'Редактирование сообщения',
    category: 'MESSAGES',
    badgeClass: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
    icon: Edit3,
  },
  MESSAGE_BULK_DELETE: {
    label: 'Очистка сообщений',
    category: 'MESSAGES',
    badgeClass: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
    icon: Trash2,
  },
  MESSAGE_SEND: {
    label: 'Отправка сообщения',
    category: 'MESSAGES',
    badgeClass: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
    icon: MessageSquare,
  },

  // Voice
  VOICE_JOIN: {
    label: 'Вход в войс',
    category: 'VOICE',
    badgeClass: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    icon: Mic,
  },
  VOICE_LEAVE: {
    label: 'Выход из войса',
    category: 'VOICE',
    badgeClass: 'bg-slate-500/15 text-slate-400 border-slate-500/30',
    icon: Mic,
  },
  VOICE_STREAM_START: {
    label: 'Запуск стрима',
    category: 'VOICE',
    badgeClass: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30',
    icon: Radio,
  },
  VOICE_STREAM_STOP: {
    label: 'Остановка стрима',
    category: 'VOICE',
    badgeClass: 'bg-slate-500/15 text-slate-400 border-slate-500/30',
    icon: Radio,
  },

  // Channels & Server
  CHANNEL_CREATE: {
    label: 'Создание канала',
    category: 'CHANNELS',
    badgeClass: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    icon: PlusCircle,
  },
  CHANNEL_DELETE: {
    label: 'Удаление канала',
    category: 'CHANNELS',
    badgeClass: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
    icon: Trash2,
  },
  CHANNEL_UPDATE: {
    label: 'Обновление канала',
    category: 'CHANNELS',
    badgeClass: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
    icon: Hash,
  },
  EMOJI_CREATE: {
    label: 'Создание эмодзи',
    category: 'CHANNELS',
    badgeClass: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    icon: Sparkles,
  },
  EMOJI_DELETE: {
    label: 'Удаление эмодзи',
    category: 'CHANNELS',
    badgeClass: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
    icon: Trash2,
  },
  GUILD_UPDATE: {
    label: 'Обновление сервера',
    category: 'CHANNELS',
    badgeClass: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    icon: ShieldAlert,
  },
  INVITE_CREATE: {
    label: 'Создание инвайта',
    category: 'INVITES',
    badgeClass: 'bg-teal-500/15 text-teal-400 border-teal-500/30',
    icon: Link2,
  },
  INVITE_DELETE: {
    label: 'Удаление инвайта',
    category: 'INVITES',
    badgeClass: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
    icon: Link2,
  },

  // Bot & Family
  PROFILE_STATIC_UPDATED: {
    label: 'Привязка статика',
    category: 'BOT',
    badgeClass: 'bg-pink-500/15 text-pink-400 border-pink-500/30',
    icon: UserCheck,
  },
  LEAVE_REQUESTED: {
    label: 'Заявка на отпуск',
    category: 'BOT',
    badgeClass: 'bg-sky-500/15 text-sky-400 border-sky-500/30',
    icon: Clock,
  },
  LEAVE_APPROVED: {
    label: 'Одобрение отпуска',
    category: 'BOT',
    badgeClass: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    icon: CheckCircle2,
  },
  LEAVE_REJECTED: {
    label: 'Отклонение отпуска',
    category: 'BOT',
    badgeClass: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
    icon: UserX,
  },
};

export const Logs: React.FC = () => {
  const modal = useModal();
  const [tab, setTab] = useState<'viewer' | 'settings'>('viewer');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [config, setConfig] = useState<any>(null);
  const [channels, setChannels] = useState<any[]>([]);
  const [entries, setEntries] = useState<any[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [limit, setLimit] = useState(50);
  const [loading, setLoading] = useState(true);
  const [loadingEntries, setLoadingEntries] = useState(false);
  const [saving, setSaving] = useState(false);
  const [autoSetting, setAutoSetting] = useState(false);
  const [exporting, setExporting] = useState<'csv' | 'json' | null>(null);

  // Filters & Search
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('ALL');

  // Selected Log Entry for Details Modal
  const [selectedEntry, setSelectedEntry] = useState<any | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [showRawJson, setShowRawJson] = useState(false);

  const categories = [
    { id: 'ALL', label: 'Все логи', icon: Layers },
    { id: 'MODERATION', label: '⚖️ Модерация и Муты', icon: ShieldAlert },
    { id: 'MEMBERS', label: '👥 Участники', icon: UserCheck },
    { id: 'ROLES', label: '🛡️ Роли', icon: Shield },
    { id: 'MESSAGES', label: '💬 Сообщения', icon: MessageSquare },
    { id: 'VOICE', label: '🔊 Войс', icon: Mic },
    { id: 'CHANNELS', label: '📁 Каналы и Сервер', icon: Hash },
    { id: 'BOT', label: '🤖 Действия бота', icon: Bot },
  ];

  const logCategoryDefinitions = [
    { type: 'MESSAGES', key: 'messageLogsChannelId', name: 'сообщения-лог', label: 'Удаление, редактирование, очистка сообщений', icon: MessageSquare, color: 'text-rose-400' },
    { type: 'MEMBERS', key: 'memberLogsChannelId', name: 'участники-лог', label: 'Вход, выход, кики, баны, смена ников, тайм-ауты', icon: UserCheck, color: 'text-blue-400' },
    { type: 'ROLES', key: 'roleLogsChannelId', name: 'роли-лог', label: 'Создание, удаление, смена прав и выдача ролей', icon: ShieldAlert, color: 'text-purple-400' },
    { type: 'CHANNELS', key: 'channelLogsChannelId', name: 'каналы-лог', label: 'Создание, удаление, переименование каналов', icon: Hash, color: 'text-emerald-400' },
    { type: 'VOICE', key: 'voiceLogsChannelId', name: 'войс-лог', label: 'Вход/выход из войса, переходы, серверный мут', icon: Mic, color: 'text-indigo-400' },
    { type: 'INVITES', key: 'inviteLogsChannelId', name: 'инвайты-лог', label: 'Создание и удаление инвайтов сервера', icon: Link2, color: 'text-amber-400' },
    { type: 'EVENTS', key: 'eventLogsChannelId', name: 'ивенты-лог', label: 'Создание сборов на МП, запись участников, резерв, старт, завершение и удаление сообщений', icon: Swords, color: 'text-pink-400' },
    { type: 'BOT', key: 'botLogsChannelId', name: 'бот-лог', label: 'Действия рекрутеров, одобрения заявок, синхронизация', icon: Bot, color: 'text-teal-400' },
  ];

  const fetchEntries = async (page = currentPage) => {
    try {
      setLoadingEntries(true);
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (actionFilter && actionFilter !== 'ALL') params.append('action', actionFilter);
      if (categoryFilter && categoryFilter !== 'ALL') params.append('category', categoryFilter);
      params.append('page', String(page));
      params.append('limit', String(limit));

      const res = await api.get(`/logs/entries?${params.toString()}`);
      setEntries(res.data.entries || []);
      setTotalCount(res.data.total || 0);
      setCurrentPage(res.data.page || 1);
      setTotalPages(res.data.totalPages || 1);
    } catch (err) {
      console.error('Error fetching logs:', err);
    } finally {
      setLoadingEntries(false);
    }
  };

  const fetchConfig = async () => {
    try {
      setLoading(true);
      const [configRes, channelsRes] = await Promise.all([
        api.get('/logs/config'),
        api.get('/guild/channels'),
      ]);
      setConfig(configRes.data.config);
      setChannels(channelsRes.data.channels);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
    fetchEntries(1);
  }, []);

  // Refetch when filters or search change
  useEffect(() => {
    if (tab === 'viewer') {
      const delay = setTimeout(() => {
        fetchEntries(1);
      }, 250);
      return () => clearTimeout(delay);
    }
  }, [search, actionFilter, categoryFilter, limit]);

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleExport = async (format: 'csv' | 'json') => {
    try {
      setExporting(format);
      const res = await api.get(`/logs/export?format=${format}`, {
        responseType: 'blob',
      });
      const blob = new Blob([res.data], {
        type: format === 'csv' ? 'text/csv;charset=utf-8' : 'application/json',
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit_logs_${new Date().toISOString().slice(0, 10)}.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export failed:', err);
      modal.alert({
        title: 'Ошибка',
        message: 'Не удалось экспортировать логи',
        type: 'error',
      });
    } finally {
      setExporting(null);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await api.post('/logs/config', config);
      modal.alert({
        title: 'Успешно',
        message: 'Настройки логирования успешно сохранены!',
        type: 'success',
      });
    } catch (err) {
      modal.alert({
        title: 'Ошибка',
        message: 'Ошибка при сохранении настроек',
        type: 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleAutoSetup = async () => {
    const confirmed = await modal.confirm({
      title: 'Авто-создание каналов',
      message: 'Бот автоматически создаст закрытую категорию LOGS и все 8 каналов логов на вашем сервере Discord. Продолжить?',
      confirmText: 'Создать каналы',
      type: 'pink',
    });
    if (!confirmed) return;

    try {
      setAutoSetting(true);
      await api.post('/logs/auto-setup');
      modal.alert({
        title: 'Успешно',
        message: 'Категория LOGS и каналы успешно созданы в Discord!',
        type: 'success',
      });
      fetchConfig();
    } catch (err: any) {
      modal.alert({
        title: 'Ошибка',
        message: err.response?.data?.error || 'Ошибка создания каналов',
        type: 'error',
      });
    } finally {
      setAutoSetting(false);
    }
  };

  const renderActionBadge = (action: string) => {
    const def = ACTION_DEFINITIONS[action];
    if (def) {
      const Icon = def.icon;
      return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold border ${def.badgeClass}`}>
          <Icon className="w-3.5 h-3.5 flex-shrink-0" />
          <span>{def.label}</span>
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-pink-500/10 text-pink-400 border border-pink-500/20">
        <Bot className="w-3 h-3 flex-shrink-0" />
        {action.replace(/_/g, ' ')}
      </span>
    );
  };

  // Helper for relative time (e.g. 5 минут назад)
  const formatTimeAgo = (dateStr: string) => {
    const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
    if (diff < 60) return 'только что';
    if (diff < 3600) return `${Math.floor(diff / 60)} мин. назад`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} ч. назад`;
    if (diff < 2592000) return `${Math.floor(diff / 86400)} дн. назад`;
    return new Date(dateStr).toLocaleDateString('ru-RU');
  };

  return (
    <div className="space-y-6 w-full">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
            <ScrollText className="w-6 h-6 text-pink-500" />
            Аудит логи Discord и Бота
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Полный журнал действий на сервере: муты, кики, баны, изменения ролей, сообщения, войс и бот
          </p>
        </div>

        {/* Tab switchers */}
        <div className="flex bg-[#0B0E14] p-1 rounded-xl border border-[#1E232F]">
          <button
            onClick={() => setTab('viewer')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              tab === 'viewer'
                ? 'bg-gradient-to-r from-pink-600 to-rose-500 text-white shadow-md shadow-pink-600/25'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            📜 Журнал аудита ({totalCount})
          </button>
          <button
            onClick={() => setTab('settings')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              tab === 'settings'
                ? 'bg-gradient-to-r from-pink-600 to-rose-500 text-white shadow-md shadow-pink-600/25'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            ⚙️ Каналы логирования
          </button>
        </div>
      </div>

      {/* TAB 1: AUDIT VIEWER */}
      {tab === 'viewer' && (
        <div className="space-y-4">
          {/* Category Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 p-1.5 bg-[#0D1017] border border-[#1E232F] rounded-2xl overflow-x-auto">
            {categories.map((cat) => {
              const Icon = cat.icon;
              const isActive = categoryFilter === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => {
                    setCategoryFilter(cat.id);
                    setActionFilter('ALL');
                  }}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
                    isActive
                      ? 'bg-pink-600 text-white shadow-md shadow-pink-600/25 border border-pink-500/50'
                      : 'text-slate-400 hover:text-white hover:bg-[#151922]'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{cat.label}</span>
                </button>
              );
            })}
          </div>

          {/* Controls Bar */}
          <div className="bg-[#151921] border border-[#1E232F] rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Поиск по нику, ID, причине, действию..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-[#0B0E14] border border-[#1E232F] rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-pink-500 placeholder-slate-500"
              />
            </div>

            {/* Filter & Action buttons */}
            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
              <CustomSelect
                options={[
                  { value: 'ALL', label: 'Все действия категории' },
                  // Moderation
                  { value: 'MEMBER_TIMEOUT', label: '⏳ Мут / Тайм-аут' },
                  { value: 'MEMBER_UNTIMEOUT', label: '✨ Снятие мута' },
                  { value: 'MEMBER_KICK', label: '👢 Кик участника' },
                  { value: 'MEMBER_BAN', label: '🔨 Бан участника' },
                  { value: 'MEMBER_UNBAN', label: '🔓 Разбан' },
                  { value: 'VOICE_SERVER_MUTE', label: '🔇 Серверный мут (Войс)' },
                  { value: 'VOICE_SERVER_UNMUTE', label: '🔊 Снятие мута (Войс)' },
                  { value: 'VOICE_SERVER_DEAF', label: '🛑 Серверный деф' },
                  { value: 'VOICE_SERVER_UNDEAF', label: '🎧 Снятие дефа' },
                  { value: 'VOICE_MOVE_MOD', label: '🔀 Перемещение модератором' },
                  { value: 'VOICE_DISCONNECT_MOD', label: '❌ Кик из войса' },
                  { value: 'MESSAGE_DELETE_MOD', label: '🗑️ Удаление сообщения модератором' },
                  { value: 'PENALTY_ADDED', label: '⚠️ Выдача штрафа' },
                  { value: 'PENALTY_REMOVED', label: '✨ Снятие штрафа' },
                  // Members & Roles
                  { value: 'MEMBER_JOIN', label: '📥 Вход на сервер' },
                  { value: 'MEMBER_LEAVE', label: '📤 Выход с сервера' },
                  { value: 'MEMBER_NICKNAME_UPDATE', label: '🏷️ Смена никнейма' },
                  { value: 'MEMBER_ROLES_UPDATE', label: '🛡️ Выдача / снятие ролей' },
                  { value: 'ROLE_CREATE', label: '➕ Создание роли' },
                  { value: 'ROLE_DELETE', label: '🗑️ Удаление роли' },
                  // Messages
                  { value: 'MESSAGE_DELETE', label: '🗑️ Удаление сообщения' },
                  { value: 'MESSAGE_EDIT', label: '✏️ Редактирование сообщения' },
                  { value: 'MESSAGE_BULK_DELETE', label: '🧹 Очистка сообщений' },
                  // Voice
                  { value: 'VOICE_JOIN', label: '🟢 Вход в войс' },
                  { value: 'VOICE_LEAVE', label: '🔴 Выход из войса' },
                  { value: 'VOICE_STREAM_START', label: '📺 Стрим / Экран' },
                  // Channels
                  { value: 'CHANNEL_CREATE', label: '➕ Создание канала' },
                  { value: 'CHANNEL_DELETE', label: '🗑️ Удаление канала' },
                  { value: 'CHANNEL_UPDATE', label: '⚙️ Обновление канала' },
                  { value: 'EMOJI_CREATE', label: '✨ Создание эмодзи' },
                  { value: 'GUILD_UPDATE', label: '🏰 Обновление сервера' },
                  // Bot
                  { value: 'PROFILE_STATIC_UPDATED', label: '👤 Изменение статика' },
                  { value: 'LEAVE_REQUESTED', label: '🏖️ Заявка на отпуск' },
                  { value: 'LEAVE_APPROVED', label: '✅ Одобрение отпуска' },
                ]}
                value={actionFilter}
                onChange={(val) => setActionFilter(val)}
                className="w-56"
              />

              {/* Items per page selector */}
              <select
                value={limit}
                onChange={(e) => setLimit(Number(e.target.value))}
                className="bg-[#0B0E14] border border-[#1E232F] rounded-xl px-2.5 py-2 text-xs text-slate-300 focus:outline-none focus:border-pink-500"
                title="Записей на страницу"
              >
                <option value={25}>25 / стр</option>
                <option value={50}>50 / стр</option>
                <option value={100}>100 / стр</option>
              </select>

              {/* Refresh button */}
              <button
                onClick={() => fetchEntries(currentPage)}
                disabled={loadingEntries}
                className="p-2 rounded-xl bg-[#0B0E14] border border-[#1E232F] text-slate-300 hover:text-white transition-all disabled:opacity-50"
                title="Обновить журнал"
              >
                <RefreshCw className={`w-4 h-4 ${loadingEntries ? 'animate-spin text-pink-400' : ''}`} />
              </button>

              {/* Export dropdown */}
              <div className="flex items-center gap-1 bg-[#0B0E14] border border-[#1E232F] p-0.5 rounded-xl">
                <button
                  onClick={() => handleExport('csv')}
                  disabled={exporting !== null}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-300 hover:text-white hover:bg-[#1E232F] transition disabled:opacity-50"
                  title="Скачать в формате CSV (Excel)"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                  <span>CSV</span>
                </button>
                <button
                  onClick={() => handleExport('json')}
                  disabled={exporting !== null}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-300 hover:text-white hover:bg-[#1E232F] transition disabled:opacity-50"
                  title="Скачать в формате JSON"
                >
                  <FileCode className="w-3.5 h-3.5 text-blue-400" />
                  <span>JSON</span>
                </button>
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="bg-[#151921] border border-[#1E232F] rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#1E232F]/60 text-slate-400 uppercase tracking-wider font-semibold border-b border-[#1E232F]">
                  <tr>
                    <th className="px-5 py-3.5">Время (МСК)</th>
                    <th className="px-4 py-3.5">Источник</th>
                    <th className="px-4 py-3.5">Действие</th>
                    <th className="px-5 py-3.5">Модератор / Инициатор</th>
                    <th className="px-5 py-3.5">Цель / Участник</th>
                    <th className="px-5 py-3.5">Причина / Подробности</th>
                    <th className="px-4 py-3.5 text-right">Инфо</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1E232F]">
                  {loadingEntries ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-14 text-center">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <RefreshCw className="w-6 h-6 animate-spin text-pink-500" />
                          <span className="text-slate-400 text-xs font-medium">Загрузка записей аудита...</span>
                        </div>
                      </td>
                    </tr>
                  ) : entries.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-14 text-center">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <Layers className="w-8 h-8 text-slate-600" />
                          <span className="text-slate-300 text-sm font-semibold">Записей аудита не найдено</span>
                          <span className="text-slate-500 text-xs">Попробуйте изменить категорию или поисковый запрос</span>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    entries.map((entry) => (
                      <tr 
                        key={entry.id} 
                        onClick={() => {
                          setSelectedEntry(entry);
                          setShowRawJson(false);
                        }}
                        className="hover:bg-[#1A1F2B]/60 transition-colors cursor-pointer group"
                      >
                        {/* Time */}
                        <td className="px-5 py-3.5 whitespace-nowrap">
                          <div className="text-slate-300 font-mono text-[11px]">
                            {new Date(entry.createdAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </div>
                          <div className="text-[10px] text-slate-500">
                            {formatTimeAgo(entry.createdAt)}
                          </div>
                        </td>

                        {/* Source */}
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            entry.source === 'DISCORD' 
                              ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' 
                              : 'bg-teal-500/10 text-teal-400 border border-teal-500/20'
                          }`}>
                            {entry.source === 'DISCORD' ? 'Discord Audit' : 'Bot System'}
                          </span>
                        </td>

                        {/* Action badge */}
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          {renderActionBadge(entry.action)}
                        </td>

                        {/* Executor */}
                        <td className="px-5 py-3.5 whitespace-nowrap font-medium">
                          <div className="text-white flex items-center gap-1.5">
                            <span className="text-pink-400">@</span>
                            <span>{entry.executorTag || 'Система'}</span>
                          </div>
                          {entry.executorId && (
                            <span className="block text-[10px] text-slate-500 font-mono">
                              ID: {entry.executorId}
                            </span>
                          )}
                        </td>

                        {/* Target */}
                        <td className="px-5 py-3.5 whitespace-nowrap">
                          {entry.targetTag ? (
                            <div>
                              <span className="text-slate-200 font-medium">{entry.targetTag}</span>
                              {entry.targetId && (
                                <span className="block text-[10px] text-slate-500 font-mono">
                                  ID: {entry.targetId}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-500">—</span>
                          )}
                        </td>

                        {/* Details */}
                        <td className="px-5 py-3.5 text-slate-300 max-w-md">
                          <div className="truncate font-medium" title={entry.details}>
                            {entry.details || '—'}
                          </div>
                          {entry.metadata?.durationStr && (
                            <div className="text-[11px] text-amber-400 flex items-center gap-1 mt-0.5">
                              <Clock className="w-3 h-3" />
                              <span>Срок: {entry.metadata.durationStr}</span>
                            </div>
                          )}
                        </td>

                        {/* Info Action */}
                        <td className="px-4 py-3.5 whitespace-nowrap text-right">
                          <span className="px-2.5 py-1 rounded-lg bg-[#0B0E14] border border-[#1E232F] text-slate-400 group-hover:text-pink-400 group-hover:border-pink-500/40 text-[11px] font-semibold transition">
                            Детали 🔍
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="p-4 border-t border-[#1E232F] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
                <div>
                  Показано <span className="font-semibold text-white">{(currentPage - 1) * limit + 1}</span> - <span className="font-semibold text-white">{Math.min(currentPage * limit, totalCount)}</span> из <span className="font-semibold text-white">{totalCount}</span> записей
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => fetchEntries(currentPage - 1)}
                    disabled={currentPage <= 1 || loadingEntries}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#0B0E14] border border-[#1E232F] text-slate-300 hover:text-white disabled:opacity-40 transition"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span>Назад</span>
                  </button>

                  <span className="px-3 py-1.5 rounded-xl bg-[#1E232F]/50 text-white font-mono font-bold">
                    {currentPage} / {totalPages}
                  </span>

                  <button
                    onClick={() => fetchEntries(currentPage + 1)}
                    disabled={currentPage >= totalPages || loadingEntries}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#0B0E14] border border-[#1E232F] text-slate-300 hover:text-white disabled:opacity-40 transition"
                  >
                    <span>Вперед</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: LOG CHANNELS CONFIG */}
      {tab === 'settings' && (
        <div className="space-y-6">
          <div className="bg-[#151921] border border-[#1E232F] rounded-2xl p-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-pink-500" />
                  Автоматическая настройка логов
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Бот создаст отдельную категорию «LOGS» в вашем Discord с нужными правами и каналами
                </p>
              </div>
              <button
                onClick={handleAutoSetup}
                disabled={autoSetting}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-pink-600 to-rose-500 hover:from-pink-500 hover:to-rose-400 text-white font-semibold text-xs shadow-lg shadow-pink-600/25 transition-all disabled:opacity-50"
              >
                <Wand2 className="w-4 h-4" />
                <span>{autoSetting ? 'Создание...' : '1-Клик Создать категорию и каналы'}</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {logCategoryDefinitions.map((cat) => {
                const Icon = cat.icon;
                return (
                  <div key={cat.type} className="p-4 rounded-xl bg-[#0B0E14] border border-[#1E232F] space-y-2">
                    <div className="flex items-center gap-2">
                      <Icon className={`w-4 h-4 ${cat.color}`} />
                      <span className="font-bold text-white text-xs">#{cat.name}</span>
                    </div>
                    <p className="text-[11px] text-slate-400">{cat.label}</p>
                    <ChannelSelect
                      channels={channels}
                      channelType="text"
                      value={config?.[cat.key] || ''}
                      onChange={(val) => setConfig({ ...config, [cat.key]: val })}
                      placeholder="Выберите канал..."
                    />
                  </div>
                );
              })}
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-pink-600 to-rose-500 hover:from-pink-500 hover:to-rose-400 text-white font-semibold text-xs shadow-lg shadow-pink-600/25 transition-all disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>{saving ? 'Сохранение...' : 'Сохранить каналы логов'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* INSPECT LOG DETAILS MODAL */}
      <Modal
        isOpen={!!selectedEntry}
        onClose={() => setSelectedEntry(null)}
        title="Детали события аудита"
        description={`ID записи: ${selectedEntry?.id || ''}`}
        maxWidth="max-w-2xl"
      >
        {selectedEntry && (
          <div className="space-y-5 text-xs">
            {/* Top Banner */}
            <div className="p-4 rounded-xl bg-[#0B0E14] border border-[#1E232F] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                {renderActionBadge(selectedEntry.action)}
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  selectedEntry.source === 'DISCORD' 
                    ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' 
                    : 'bg-teal-500/10 text-teal-400 border border-teal-500/20'
                }`}>
                  {selectedEntry.source === 'DISCORD' ? 'Discord Audit Log' : 'Bot System Log'}
                </span>
              </div>
              <div className="text-slate-400 text-[11px] font-mono flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-500" />
                <span>{new Date(selectedEntry.createdAt).toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' })} (МСК)</span>
              </div>
            </div>

            {/* Moderator & Target 2-Column Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Executor Card */}
              <div className="p-3.5 rounded-xl bg-[#0B0E14] border border-[#1E232F] space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-pink-400" />
                  Модератор / Инициатор
                </span>
                <div className="text-sm font-bold text-white flex items-center gap-1.5">
                  <span className="text-pink-400">@</span>
                  <span>{selectedEntry.executorTag || 'Система'}</span>
                </div>
                {selectedEntry.executorId ? (
                  <div className="flex items-center justify-between bg-[#151921] px-2.5 py-1.5 rounded-lg border border-[#1E232F]">
                    <span className="text-[11px] text-slate-400 font-mono truncate">{selectedEntry.executorId}</span>
                    <button
                      onClick={() => handleCopy(selectedEntry.executorId, 'exec-id')}
                      className="text-slate-400 hover:text-white transition ml-2 flex-shrink-0"
                      title="Скопировать ID"
                    >
                      {copiedKey === 'exec-id' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                ) : (
                  <span className="text-slate-500 text-[11px]">ID не указан</span>
                )}
              </div>

              {/* Target Card */}
              <div className="p-3.5 rounded-xl bg-[#0B0E14] border border-[#1E232F] space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <UserCheck className="w-3.5 h-3.5 text-blue-400" />
                  Объект / Цель действия
                </span>
                <div className="text-sm font-bold text-white">
                  {selectedEntry.targetTag || '—'}
                </div>
                {selectedEntry.targetId ? (
                  <div className="flex items-center justify-between bg-[#151921] px-2.5 py-1.5 rounded-lg border border-[#1E232F]">
                    <span className="text-[11px] text-slate-400 font-mono truncate">{selectedEntry.targetId}</span>
                    <button
                      onClick={() => handleCopy(selectedEntry.targetId, 'target-id')}
                      className="text-slate-400 hover:text-white transition ml-2 flex-shrink-0"
                      title="Скопировать ID"
                    >
                      {copiedKey === 'target-id' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                ) : (
                  <span className="text-slate-500 text-[11px]">ID не указан</span>
                )}
              </div>
            </div>

            {/* Moderation Details & Reason */}
            <div className="p-4 rounded-xl bg-[#0B0E14] border border-[#1E232F] space-y-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                Описание и Причина
              </span>
              <div className="text-slate-200 bg-[#151921] p-3 rounded-xl border border-[#1E232F] leading-relaxed">
                {selectedEntry.details || 'Описание отсутствует'}
              </div>

              {/* Timeout expiration info */}
              {selectedEntry.metadata?.durationStr && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300">
                    <span className="block text-[10px] text-amber-400/70 uppercase font-semibold">Срок действия</span>
                    <span className="text-xs font-bold">{selectedEntry.metadata.durationStr}</span>
                  </div>
                  {selectedEntry.metadata?.until && (
                    <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300">
                      <span className="block text-[10px] text-amber-400/70 uppercase font-semibold">Действует до</span>
                      <span className="text-xs font-bold font-mono">
                        {new Date(selectedEntry.metadata.until).toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' })}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Nickname change details */}
              {selectedEntry.metadata?.oldNick && selectedEntry.metadata?.newNick && (
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20">
                    <span className="block text-[10px] text-rose-400 uppercase font-semibold">Старый никнейм</span>
                    <span className="text-xs text-white font-medium">{selectedEntry.metadata.oldNick}</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                    <span className="block text-[10px] text-emerald-400 uppercase font-semibold">Новый никнейм</span>
                    <span className="text-xs text-white font-medium">{selectedEntry.metadata.newNick}</span>
                  </div>
                </div>
              )}

              {/* Role additions / removals */}
              {(selectedEntry.metadata?.addedRoles?.length > 0 || selectedEntry.metadata?.removedRoles?.length > 0) && (
                <div className="space-y-2 pt-1">
                  {selectedEntry.metadata.addedRoles?.length > 0 && (
                    <div>
                      <span className="text-[10px] text-emerald-400 font-semibold block mb-1">Выданные роли:</span>
                      <div className="flex flex-wrap gap-1">
                        {selectedEntry.metadata.addedRoles.map((r: string, idx: number) => (
                          <span key={idx} className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 text-[11px] font-semibold">
                            + {r}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {selectedEntry.metadata.removedRoles?.length > 0 && (
                    <div>
                      <span className="text-[10px] text-rose-400 font-semibold block mb-1">Снятые роли:</span>
                      <div className="flex flex-wrap gap-1">
                        {selectedEntry.metadata.removedRoles.map((r: string, idx: number) => (
                          <span key={idx} className="px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/25 text-[11px] font-semibold">
                            - {r}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Toggle Raw JSON */}
            <div>
              <button
                type="button"
                onClick={() => setShowRawJson(!showRawJson)}
                className="text-slate-400 hover:text-white text-[11px] font-semibold flex items-center gap-1.5 transition"
              >
                <span>{showRawJson ? '▼ Скрыть сырые данные' : '▶ Показать полные метаданные (JSON)'}</span>
              </button>
              {showRawJson && (
                <div className="mt-2 relative">
                  <pre className="p-3 rounded-xl bg-[#07090E] border border-[#1E232F] text-[11px] text-slate-300 font-mono overflow-x-auto max-h-52 custom-scrollbar">
                    {JSON.stringify(selectedEntry, null, 2)}
                  </pre>
                  <button
                    onClick={() => handleCopy(JSON.stringify(selectedEntry, null, 2), 'raw-json')}
                    className="absolute top-2 right-2 p-1.5 rounded-lg bg-[#151921] border border-[#1E232F] text-slate-400 hover:text-white transition"
                    title="Скопировать JSON"
                  >
                    {copiedKey === 'raw-json' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Logs;
