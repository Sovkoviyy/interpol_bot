import React, { useEffect, useState } from 'react';
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
  Sparkles
} from 'lucide-react';
import api from '../api/client';
import { useModal } from '../context/ModalContext';

export const Logs: React.FC = () => {
  const modal = useModal();
  const [tab, setTab] = useState<'viewer' | 'settings'>('viewer');
  const [config, setConfig] = useState<any>(null);
  const [channels, setChannels] = useState<any[]>([]);
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingEntries, setLoadingEntries] = useState(false);
  const [saving, setSaving] = useState(false);
  const [autoSetting, setAutoSetting] = useState(false);

  // Filters & Search
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('ALL');

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

  const fetchEntries = async () => {
    try {
      setLoadingEntries(true);
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (actionFilter && actionFilter !== 'ALL') params.append('action', actionFilter);
      const res = await api.get(`/logs/entries?${params.toString()}`);
      setEntries(res.data.entries || []);
    } catch (err) {
      console.error(err);
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
    fetchEntries();
  }, []);

  useEffect(() => {
    if (tab === 'viewer') {
      const delay = setTimeout(() => {
        fetchEntries();
      }, 250);
      return () => clearTimeout(delay);
    }
  }, [search, actionFilter]);

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

  const getActionBadge = (action: string) => {
    if (action.includes('CHANNEL_DELETE') || action.includes('DELETE')) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
          <Trash2 className="w-3 h-3" />
          {action}
        </span>
      );
    }
    if (action.includes('CHANNEL_CREATE') || action.includes('CREATE')) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          <PlusCircle className="w-3 h-3" />
          {action}
        </span>
      );
    }
    if (action.includes('BAN') || action.includes('KICK')) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-red-500/10 text-red-400 border border-red-500/20">
          <UserX className="w-3 h-3" />
          {action}
        </span>
      );
    }
    if (action.includes('ROLE')) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/10 text-purple-400 border border-purple-500/20">
          <Shield className="w-3 h-3" />
          {action}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-pink-500/10 text-pink-400 border border-pink-500/20">
        <Bot className="w-3 h-3" />
        {action}
      </span>
    );
  };

  return (
    <div className="space-y-6 w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
            <ScrollText className="w-6 h-6 text-pink-500" />
            Аудит логи Discord и Бота
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Единый журнал аудита сервера Discord и действий внутри панели управления семьи
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
            📜 Журнал аудита ({entries.length})
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
          {/* Controls Bar */}
          <div className="bg-[#151921] border border-[#1E232F] rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Поиск по нику, ID, действию..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-[#0B0E14] border border-[#1E232F] rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-pink-500"
              />
            </div>

            {/* Filter buttons */}
            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
              <select
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value)}
                className="bg-[#0B0E14] border border-[#1E232F] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-pink-500"
              >
                <option value="ALL">Все действия</option>
                <option value="CHANNEL_DELETE">🗑️ Удаление каналов</option>
                <option value="CHANNEL_CREATE">➕ Создание каналов</option>
                <option value="ROLE_UPDATE">🛡️ Выдача / снятие ролей</option>
                <option value="MEMBER_KICK">👢 Кик участника</option>
                <option value="MEMBER_BAN">🔨 Бан участника</option>
                <option value="PROFILE_STATIC_UPDATED">👤 Привязка статиков в боте</option>
                <option value="PENALTY_ADDED">⚠️ Начисление штрафов</option>
                <option value="PENALTY_REMOVED">✨ Снятие штрафов</option>
                <option value="LEAVE_REQUESTED">🏖️ Заявки на отпуск / отгул</option>
                <option value="LEAVE_APPROVED">✅ Одобрения отпусков</option>
              </select>

              <button
                onClick={fetchEntries}
                disabled={loadingEntries}
                className="p-2 rounded-xl bg-[#0B0E14] border border-[#1E232F] text-slate-300 hover:text-white transition-all disabled:opacity-50"
                title="Обновить журнал"
              >
                <RefreshCw className={`w-4 h-4 ${loadingEntries ? 'animate-spin text-pink-400' : ''}`} />
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="bg-[#151921] border border-[#1E232F] rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#1E232F]/60 text-slate-400 uppercase tracking-wider font-semibold border-b border-[#1E232F]">
                  <tr>
                    <th className="px-5 py-3.5">Время</th>
                    <th className="px-4 py-3.5">Источник</th>
                    <th className="px-4 py-3.5">Действие</th>
                    <th className="px-5 py-3.5">Инициатор</th>
                    <th className="px-5 py-3.5">Объект / Цель</th>
                    <th className="px-5 py-3.5">Подробности</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1E232F]">
                  {loadingEntries ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-10 text-center text-slate-500">
                        Загрузка записей аудита...
                      </td>
                    </tr>
                  ) : entries.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                        Записей аудита по вашему запросу не найдено
                      </td>
                    </tr>
                  ) : (
                    entries.map((entry) => (
                      <tr key={entry.id} className="hover:bg-[#1A1F2B]/40 transition-colors">
                        <td className="px-5 py-3.5 whitespace-nowrap text-slate-400 font-mono text-[11px]">
                          {new Date(entry.createdAt).toLocaleString('ru-RU')}
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            entry.source === 'DISCORD' 
                              ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' 
                              : 'bg-teal-500/10 text-teal-400 border border-teal-500/20'
                          }`}>
                            {entry.source === 'DISCORD' ? 'Discord Audit' : 'Bot Action'}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          {getActionBadge(entry.action)}
                        </td>
                        <td className="px-5 py-3.5 whitespace-nowrap font-medium text-white">
                          @{entry.executorTag}
                          {entry.executorId && (
                            <span className="block text-[10px] text-slate-500 font-mono">
                              ID: {entry.executorId}
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 whitespace-nowrap text-slate-300">
                          {entry.targetTag ? (
                            <span>{entry.targetTag}</span>
                          ) : (
                            <span className="text-slate-500">—</span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-slate-300 max-w-sm truncate" title={entry.details}>
                          {entry.details || '—'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
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
                    <select
                      value={config?.[cat.key] || ''}
                      onChange={(e) => setConfig({ ...config, [cat.key]: e.target.value })}
                      className="w-full bg-[#151921] border border-[#1E232F] rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-pink-500"
                    >
                      <option value="">Выберите канал...</option>
                      {channels.map((c) => (
                        <option key={c.id} value={c.id}>
                          #{c.name}
                        </option>
                      ))}
                    </select>
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
    </div>
  );
};

export default Logs;
