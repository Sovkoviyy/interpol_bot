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
  Swords
} from 'lucide-react';
import api from '../api/client';
import { useModal } from '../context/ModalContext';

export const Logs: React.FC = () => {
  const modal = useModal();
  const [config, setConfig] = useState<any>(null);
  const [channels, setChannels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [autoSetting, setAutoSetting] = useState(false);

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

  const fetchData = async () => {
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
    fetchData();
  }, []);

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
      message: 'Бот автоматически создаст закрытую категорию LOGS и все 7 каналов логов на вашем сервере Discord. Продолжить?',
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
      fetchData();
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

  const toggleLogType = (type: string) => {
    const current: string[] = config.enabledLogTypes || [];
    const updated = current.includes(type)
      ? current.filter((t) => t !== type)
      : [...current, type];
    setConfig({ ...config, enabledLogTypes: updated });
  };

  const textChannels = channels.filter((c) => c.type === 0);
  const categories = channels.filter((c) => c.type === 4);

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
            <ScrollText className="w-6 h-6 text-pink-500" />
            Аудит и логирование сервера
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Логирование абсолютно всех действий на сервере с определением инициатора (Audit Logs) и раскладкой по каналам
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleAutoSetup}
            disabled={autoSetting}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-600 to-orange-500 hover:from-amber-500 hover:to-orange-400 text-white font-semibold text-xs transition-all shadow-lg shadow-amber-500/20 disabled:opacity-50"
          >
            <Wand2 className="w-4 h-4" />
            <span>{autoSetting ? 'Создание каналов...' : '⚡ Авто-создание каналов в Discord'}</span>
          </button>

          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-pink-600 to-rose-500 hover:from-pink-500 hover:to-rose-400 text-white font-semibold text-xs transition-all shadow-lg shadow-pink-600/25 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>Сохранить настройки</span>
          </button>
        </div>
      </div>

      {/* Category selector */}
      <div className="bg-[#151921] border border-[#1E232F] rounded-2xl p-6">
        <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
          Родительская категория для каналов аудита
        </label>
        <select
          value={config?.categoryId || ''}
          onChange={(e) => setConfig({ ...config, categoryId: e.target.value })}
          className="w-full md:w-96 bg-[#0B0E14] border border-[#1E232F] rounded-xl px-3 py-2 text-xs text-slate-200"
        >
          <option value="">Без категории (или авто-созданная LOGS)</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>📁 {c.name}</option>
          ))}
        </select>
      </div>

      {/* Channels List */}
      <div className="bg-[#151921] border border-[#1E232F] rounded-2xl p-6 space-y-4">
        <h2 className="text-sm font-bold text-white mb-2">Каналы категорий логирования</h2>

        <div className="space-y-3">
          {logCategoryDefinitions.map((cat) => {
            const Icon = cat.icon;
            const isEnabled = config?.enabledLogTypes?.includes(cat.type);
            const currentChannelId = config?.[cat.key] || '';

            return (
              <div
                key={cat.type}
                className="p-4 rounded-xl bg-[#0B0E14] border border-[#1E232F] flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
              >
                <div className="flex items-start gap-3 max-w-md">
                  <div className={`w-9 h-9 rounded-xl bg-[#151921] border border-[#1E232F] flex items-center justify-center flex-shrink-0 ${cat.color}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-white text-xs">#{cat.name}</span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => toggleLogType(cat.type)}
                          className={`relative inline-flex h-5 w-10 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                            isEnabled ? 'bg-pink-600 shadow-sm shadow-pink-500/50' : 'bg-slate-700/60'
                          }`}
                          role="switch"
                          aria-checked={isEnabled}
                        >
                          <span
                            aria-hidden="true"
                            className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                              isEnabled ? 'translate-x-5' : 'translate-x-0'
                            }`}
                          />
                        </button>
                        <span className={`text-[11px] font-semibold ${isEnabled ? 'text-pink-400' : 'text-slate-500'}`}>
                          {isEnabled ? 'Включено' : 'Выключено'}
                        </span>
                      </div>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5">{cat.label}</p>
                    {cat.type === 'MESSAGES' && (
                      <label className="flex items-center gap-2 mt-2 text-[11px] text-slate-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={config?.logSentMessages ?? true}
                          onChange={(e) => setConfig({ ...config, logSentMessages: e.target.checked })}
                          className="rounded border-slate-700 text-pink-600 focus:ring-pink-500 bg-[#0B0E14]"
                        />
                        <span>Логировать отправку новых сообщений в чатах</span>
                      </label>
                    )}
                  </div>
                </div>

                <div className="w-full md:w-64 text-xs">
                  <select
                    value={currentChannelId}
                    onChange={(e) => setConfig({ ...config, [cat.key]: e.target.value })}
                    className="w-full bg-[#151921] border border-[#1E232F] rounded-xl px-3 py-2 text-slate-200"
                  >
                    <option value="">Не привязан</option>
                    {textChannels.map((c) => (
                      <option key={c.id} value={c.id}>#{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default Logs;
