import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Gamepad2,
  Radio,
  Tv,
  Headphones,
  Trophy,
  MessageSquare,
  Sparkles,
  Save,
  RotateCcw,
  RefreshCw,
  Plus,
  Trash2,
  CheckCircle2,
  ExternalLink,
  Flame,
  Clock,
  Users,
  Volume2,
  Copy,
  Check,
  Power,
  Layers,
  Sliders,
  AlertCircle
} from 'lucide-react';
import api from '../api/client';
import { useModal } from '../context/ModalContext';

interface ActivityItem {
  id: string;
  type: string;
  name: string;
  state?: string;
  streamingUrl?: string;
  enabled?: boolean;
}

interface ActivityConfig {
  enabled: boolean;
  status: 'online' | 'idle' | 'dnd' | 'invisible';
  mode: 'STATIC' | 'ROTATING';
  rotationInterval: number;
  activityType: 'PLAYING' | 'STREAMING' | 'LISTENING' | 'WATCHING' | 'COMPETING' | 'CUSTOM';
  activityName: string;
  activityState: string;
  streamingUrl: string;
  activities: ActivityItem[];
}

interface LiveSnapshot {
  isOnline: boolean;
  botTag: string;
  botAvatar: string | null;
  botId: string | null;
  currentActivity: any;
  lastAppliedAt: string | null;
}

const ACTIVITY_TYPES = [
  { value: 'PLAYING', label: 'Играет в', icon: Gamepad2, desc: 'Отображается как "Играет в ..."' },
  { value: 'STREAMING', label: 'Стримит на Twitch', icon: Radio, desc: 'Фиолетовая плашка со ссылкой на стрим' },
  { value: 'LISTENING', label: 'Слушает', icon: Headphones, desc: 'Отображается как "Слушает ..."' },
  { value: 'WATCHING', label: 'Смотрит', icon: Tv, desc: 'Отображается как "Смотрит ..."' },
  { value: 'COMPETING', label: 'Соревнуется в', icon: Trophy, desc: 'Отображается как "Соревнуется в ..."' },
  { value: 'CUSTOM', label: 'Свой статус', icon: MessageSquare, desc: 'Пользовательский кастомный статус' },
];

const STATUS_OPTIONS = [
  { value: 'online', label: 'В сети', color: 'bg-emerald-500', border: 'border-emerald-500', desc: 'Зелёный индикатор' },
  { value: 'idle', label: 'Не активен', color: 'bg-amber-500', border: 'border-amber-500', desc: 'Жёлтый полумесяц' },
  { value: 'dnd', label: 'Не беспокоить', color: 'bg-rose-500', border: 'border-rose-500', desc: 'Красный кирпич' },
  { value: 'invisible', label: 'Невидимка', color: 'bg-zinc-500', border: 'border-zinc-500', desc: 'Серый кружок (оффлайн)' },
];

const PRESETS = [
  {
    name: 'Majestic RP • Dallas',
    badge: 'GTA 5 RP',
    type: 'PLAYING',
    activityName: 'Majestic RP • Dallas',
    activityState: 'Семья INTERPOL • {members} бойцов',
    streamingUrl: '',
    status: 'online',
  },
  {
    name: 'Капты & Дропы (Twitch)',
    badge: 'Стрим',
    type: 'STREAMING',
    activityName: 'Капты & Дропы на Dallas',
    activityState: 'Семья INTERPOL',
    streamingUrl: 'https://twitch.tv/interpol',
    status: 'online',
  },
  {
    name: 'На страже сервера',
    badge: 'Мониторинг',
    type: 'WATCHING',
    activityName: 'за порядком в штате Dallas',
    activityState: 'Участников: {members} | В войсе: {voiceCount}',
    streamingUrl: '',
    status: 'online',
  },
  {
    name: 'Рация семьи',
    badge: 'Голос',
    type: 'LISTENING',
    activityName: 'Голосовые каналы INTERPOL',
    activityState: '{voiceCount} чел. на связи',
    streamingUrl: '',
    status: 'online',
  },
  {
    name: 'Битва за территории',
    badge: 'Сборы МП',
    type: 'COMPETING',
    activityName: 'Война за граффити и дропы',
    activityState: 'Активных сборов: {activeEvents}',
    streamingUrl: '',
    status: 'dnd',
  },
];

export const BotActivity: React.FC = () => {
  const modal = useModal();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copiedVar, setCopiedVar] = useState<string | null>(null);

  // Focus tracking for inserting variables
  const [lastFocusedInput, setLastFocusedInput] = useState<'name' | 'state' | 'streamingUrl' | null>('name');
  const [focusedRotationId, setFocusedRotationId] = useState<{ id: string; field: 'name' | 'state' } | null>(null);

  // Main config state
  const [config, setConfig] = useState<ActivityConfig>({
    enabled: true,
    status: 'online',
    mode: 'STATIC',
    rotationInterval: 30,
    activityType: 'PLAYING',
    activityName: 'Majestic RP • INTERPOL',
    activityState: 'Сервер Dallas • {members} уч.',
    streamingUrl: 'https://twitch.tv/interpol',
    activities: [],
  });

  // Live snapshot from Discord
  const [liveSnapshot, setLiveSnapshot] = useState<LiveSnapshot | null>(null);
  const [liveVariables, setLiveVariables] = useState<Record<string, string | number>>({});

  const loadData = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const res = await api.get('/activity');
      if (res.data) {
        const { config: conf, live, variables } = res.data;
        setConfig({
          enabled: Boolean(conf.enabled),
          status: conf.status || 'online',
          mode: conf.mode || 'STATIC',
          rotationInterval: Number(conf.rotationInterval) || 30,
          activityType: conf.activityType || 'PLAYING',
          activityName: conf.activityName || '',
          activityState: conf.activityState || '',
          streamingUrl: conf.streamingUrl || '',
          activities: Array.isArray(conf.activities) ? conf.activities : [],
        });
        setLiveSnapshot(live);
        setLiveVariables(variables || {});
      }
    } catch (err: any) {
      console.error('Failed to load activity config:', err);
      if (!silent) {
        modal.error('Не удалось загрузить конфигурацию активности бота');
      }
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(() => {
      loadData(true);
    }, 15000); // 15 sec periodic poll for live status
    return () => clearInterval(interval);
  }, []);

  // Save changes
  const handleSave = async () => {
    try {
      setSaving(true);
      const res = await api.put('/activity', config);
      if (res.data?.snapshot) {
        setLiveSnapshot(res.data.snapshot.live);
        setLiveVariables(res.data.snapshot.variables || {});
      }
      modal.success('Активность бота успешно обновлена и применена в Discord!');
    } catch (err: any) {
      console.error('Failed to save activity:', err);
      modal.error(err.response?.data?.error || 'Ошибка при сохранении активности');
    } finally {
      setSaving(false);
    }
  };

  // Force Apply immediately
  const handleApplyNow = async () => {
    try {
      setSaving(true);
      await api.put('/activity', config);
      const res = await api.post('/activity/apply');
      if (res.data?.snapshot) {
        setLiveSnapshot(res.data.snapshot.live);
        setLiveVariables(res.data.snapshot.variables || {});
      }
      modal.success('Активность бота моментально отправлена в Discord Gateway!');
    } catch (err: any) {
      console.error('Failed to apply activity:', err);
      modal.error(err.response?.data?.error || 'Ошибка применения активности');
    } finally {
      setSaving(false);
    }
  };

  // Reset / Clear activity
  const handleReset = async () => {
    const ok = await modal.confirm({
      title: 'Сбросить активность?',
      message: 'Бот очистит статус и перестанет отображать игровую активность в Discord.',
      confirmText: 'Да, сбросить',
      cancelText: 'Отмена',
      type: 'warning',
    });
    if (!ok) return;

    try {
      setSaving(true);
      await api.post('/activity/reset');
      setConfig((prev) => ({ ...prev, enabled: false }));
      await loadData(true);
      modal.success('Активность бота отключена и очищена');
    } catch (err: any) {
      console.error('Failed to reset activity:', err);
      modal.error(err.response?.data?.error || 'Ошибка при сбросе активности');
    } finally {
      setSaving(false);
    }
  };

  // Interpolate template placeholders for preview
  const interpolate = (template: string) => {
    if (!template) return '';
    return template.replace(/\{(\w+)\}/g, (match, key) => {
      if (liveVariables[key] !== undefined) {
        return String(liveVariables[key]);
      }
      return match;
    });
  };

  // Insert or copy variable
  const handleVariableClick = (varKey: string) => {
    const placeholder = `{${varKey}}`;
    navigator.clipboard.writeText(placeholder);
    setCopiedVar(varKey);
    setTimeout(() => setCopiedVar(null), 2000);

    // If focused on a rotation item
    if (focusedRotationId) {
      setConfig((prev) => ({
        ...prev,
        activities: prev.activities.map((act) => {
          if (act.id === focusedRotationId.id) {
            const currentVal = act[focusedRotationId.field] || '';
            return {
              ...act,
              [focusedRotationId.field]: currentVal + placeholder,
            };
          }
          return act;
        }),
      }));
      return;
    }

    // Static mode fields
    if (lastFocusedInput === 'name') {
      setConfig((prev) => ({ ...prev, activityName: prev.activityName + placeholder }));
    } else if (lastFocusedInput === 'state') {
      setConfig((prev) => ({ ...prev, activityState: prev.activityState + placeholder }));
    }
  };

  // Apply a preset
  const handleApplyPreset = (preset: typeof PRESETS[0]) => {
    setConfig((prev) => ({
      ...prev,
      enabled: true,
      activityType: preset.type as any,
      activityName: preset.activityName,
      activityState: preset.activityState,
      streamingUrl: preset.streamingUrl || prev.streamingUrl,
      status: preset.status as any,
    }));
  };

  // Add rotating item
  const handleAddRotationItem = () => {
    const newItem: ActivityItem = {
      id: Date.now().toString(),
      type: 'PLAYING',
      name: 'Новый статус',
      state: 'Семья INTERPOL',
      streamingUrl: '',
      enabled: true,
    };
    setConfig((prev) => ({
      ...prev,
      activities: [...prev.activities, newItem],
    }));
  };

  // Remove rotating item
  const handleRemoveRotationItem = (id: string) => {
    setConfig((prev) => ({
      ...prev,
      activities: prev.activities.filter((act) => act.id !== id),
    }));
  };

  // Update rotating item
  const handleUpdateRotationItem = (id: string, updates: Partial<ActivityItem>) => {
    setConfig((prev) => ({
      ...prev,
      activities: prev.activities.map((act) => (act.id === id ? { ...act, ...updates } : act)),
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-pink-500/10 border border-pink-500/20 flex items-center justify-center animate-spin">
            <RefreshCw className="w-6 h-6 text-pink-500" />
          </div>
          <span className="text-zinc-400 text-sm font-medium">Загрузка настроек активности...</span>
        </div>
      </div>
    );
  }

  // Active activity name & state for preview
  const previewName = interpolate(config.activityName || 'Majestic RP • INTERPOL');
  const previewState = interpolate(config.activityState || '');
  const previewTypeInfo = ACTIVITY_TYPES.find((t) => t.value === config.activityType) || ACTIVITY_TYPES[0];

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-dark-900/60 backdrop-blur-xl p-6 rounded-2xl border border-dark-700/60 shadow-xl">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-pink-500/20 via-purple-500/20 to-indigo-500/20 border border-pink-500/30 flex items-center justify-center shadow-lg shadow-pink-500/10">
            <Gamepad2 className="w-7 h-7 text-pink-400" />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-white tracking-tight">Игровая активность бота</h1>
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-semibold flex items-center gap-1.5 ${
                  config.enabled
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : 'bg-zinc-500/10 text-zinc-400 border border-zinc-500/20'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${config.enabled ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-400'}`} />
                {config.enabled ? 'Активность включена' : 'Отключена'}
              </span>
            </div>
            <p className="text-sm text-zinc-400 mt-1">
              Управление Discord Presence: сетевой статус, игра, Twitch-стримы, ротация и динамические счетчики
            </p>
          </div>
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center gap-3 self-end md:self-auto">
          <button
            onClick={() => setConfig((prev) => ({ ...prev, enabled: !prev.enabled }))}
            className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all flex items-center gap-2 border ${
              config.enabled
                ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/20'
                : 'bg-dark-800 text-zinc-400 border-dark-700 hover:text-white hover:bg-dark-750'
            }`}
          >
            <Power className="w-4 h-4" />
            {config.enabled ? 'Активность включена' : 'Включить'}
          </button>

          <button
            onClick={handleReset}
            disabled={saving}
            className="px-4 py-2.5 rounded-xl text-sm font-medium bg-dark-800 text-zinc-300 border border-dark-700 hover:text-rose-400 hover:border-rose-500/30 hover:bg-rose-500/10 transition-all flex items-center gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            Сбросить
          </button>

          <button
            onClick={handleApplyNow}
            disabled={saving || !config.enabled}
            className="px-4 py-2.5 rounded-xl text-sm font-medium bg-dark-800 text-pink-300 border border-pink-500/30 hover:bg-pink-500/10 hover:border-pink-500/50 transition-all flex items-center gap-2 disabled:opacity-50"
            title="Применить текущую активность в Discord прямо сейчас"
          >
            <Sparkles className="w-4 h-4 text-pink-400" />
            Применить сейчас
          </button>

          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-pink-500 to-rose-600 hover:from-pink-600 hover:to-rose-700 text-white shadow-lg shadow-pink-500/25 transition-all flex items-center gap-2 disabled:opacity-50"
          >
            {saving ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Сохранение...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Сохранить настройки
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main Grid: Settings & Live Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Configuration Forms (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Status & Mode Switcher */}
          <div className="bg-dark-900/60 backdrop-blur-xl p-6 rounded-2xl border border-dark-700/60 space-y-5">
            <h2 className="text-base font-semibold text-white flex items-center gap-2">
              <Sliders className="w-4 h-4 text-pink-400" />
              1. Сетевой статус в Discord
            </h2>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {STATUS_OPTIONS.map((st) => {
                const isSelected = config.status === st.value;
                return (
                  <button
                    key={st.value}
                    type="button"
                    onClick={() => setConfig((prev) => ({ ...prev, status: st.value as any }))}
                    className={`flex flex-col items-center justify-center p-3.5 rounded-xl border text-center transition-all ${
                      isSelected
                        ? 'bg-pink-500/10 border-pink-500/60 text-white shadow-md shadow-pink-500/10 ring-1 ring-pink-500/40'
                        : 'bg-dark-800/80 border-dark-700 text-zinc-400 hover:border-dark-600 hover:text-zinc-200'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className={`w-3 h-3 rounded-full ${st.color} shadow-sm`} />
                      <span className="font-semibold text-sm">{st.label}</span>
                    </div>
                    <span className="text-[11px] text-zinc-500">{st.desc}</span>
                  </button>
                );
              })}
            </div>

            {/* Mode selection: Single vs Rotating */}
            <div className="pt-3 border-t border-dark-700/60">
              <label className="text-xs font-medium text-zinc-400 mb-2.5 block">Режим отображения:</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setConfig((prev) => ({ ...prev, mode: 'STATIC' }))}
                  className={`flex items-center gap-3 p-3.5 rounded-xl border transition-all text-left ${
                    config.mode === 'STATIC'
                      ? 'bg-pink-500/10 border-pink-500/50 text-white ring-1 ring-pink-500/30'
                      : 'bg-dark-800/70 border-dark-700 text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <div className={`p-2 rounded-lg ${config.mode === 'STATIC' ? 'bg-pink-500 text-white' : 'bg-dark-700 text-zinc-400'}`}>
                    <Gamepad2 className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold">Одиночный статус</div>
                    <div className="text-xs text-zinc-500">Постоянная активность бота</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setConfig((prev) => ({ ...prev, mode: 'ROTATING' }))}
                  className={`flex items-center gap-3 p-3.5 rounded-xl border transition-all text-left ${
                    config.mode === 'ROTATING'
                      ? 'bg-pink-500/10 border-pink-500/50 text-white ring-1 ring-pink-500/30'
                      : 'bg-dark-800/70 border-dark-700 text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <div className={`p-2 rounded-lg ${config.mode === 'ROTATING' ? 'bg-pink-500 text-white' : 'bg-dark-700 text-zinc-400'}`}>
                    <Layers className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold">Авто-ротация статусов</div>
                    <div className="text-xs text-zinc-500">Сменяет статусы по таймеру</div>
                  </div>
                </button>
              </div>
            </div>
          </div>

          {/* Mode 1: Static Config */}
          {config.mode === 'STATIC' && (
            <div className="bg-dark-900/60 backdrop-blur-xl p-6 rounded-2xl border border-dark-700/60 space-y-5">
              <h2 className="text-base font-semibold text-white flex items-center gap-2">
                <Gamepad2 className="w-4 h-4 text-pink-400" />
                2. Настройка активности
              </h2>

              {/* Activity Type Selection */}
              <div>
                <label className="text-xs font-medium text-zinc-400 mb-2 block">Тип активности:</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {ACTIVITY_TYPES.map((type) => {
                    const isSelected = config.activityType === type.value;
                    const Icon = type.icon;
                    return (
                      <button
                        key={type.value}
                        type="button"
                        onClick={() => setConfig((prev) => ({ ...prev, activityType: type.value as any }))}
                        className={`flex items-center gap-2.5 p-3 rounded-xl border text-left transition-all ${
                          isSelected
                            ? 'bg-pink-500/10 border-pink-500/60 text-white ring-1 ring-pink-500/30'
                            : 'bg-dark-800/60 border-dark-700 text-zinc-400 hover:border-dark-600 hover:text-zinc-200'
                        }`}
                      >
                        <Icon className={`w-4 h-4 ${isSelected ? 'text-pink-400' : 'text-zinc-500'}`} />
                        <span className="text-xs font-semibold">{type.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Activity Name */}
              <div>
                <label className="text-xs font-medium text-zinc-400 mb-1.5 flex items-center justify-between">
                  <span>Название активности (Activity Name):</span>
                  <span className="text-[11px] text-zinc-500">Обязательное поле</span>
                </label>
                <input
                  type="text"
                  value={config.activityName}
                  onFocus={() => {
                    setLastFocusedInput('name');
                    setFocusedRotationId(null);
                  }}
                  onChange={(e) => setConfig((prev) => ({ ...prev, activityName: e.target.value }))}
                  placeholder="Например: Majestic RP • Dallas"
                  className="w-full px-4 py-3 rounded-xl bg-dark-800 border border-dark-700 text-white placeholder-zinc-500 focus:outline-none focus:border-pink-500/70 focus:ring-1 focus:ring-pink-500/50 text-sm transition-all"
                />
              </div>

              {/* Activity State (details) */}
              <div>
                <label className="text-xs font-medium text-zinc-400 mb-1.5 flex items-center justify-between">
                  <span>Дополнительное описание / Состояние (State):</span>
                  <span className="text-[11px] text-zinc-500">Вторая строка в профиле</span>
                </label>
                <input
                  type="text"
                  value={config.activityState}
                  onFocus={() => {
                    setLastFocusedInput('state');
                    setFocusedRotationId(null);
                  }}
                  onChange={(e) => setConfig((prev) => ({ ...prev, activityState: e.target.value }))}
                  placeholder="Например: Семья INTERPOL • {members} бойцов"
                  className="w-full px-4 py-3 rounded-xl bg-dark-800 border border-dark-700 text-white placeholder-zinc-500 focus:outline-none focus:border-pink-500/70 focus:ring-1 focus:ring-pink-500/50 text-sm transition-all"
                />
              </div>

              {/* Streaming URL (Only if STREAMING) */}
              {config.activityType === 'STREAMING' && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="pt-2"
                >
                  <label className="text-xs font-medium text-purple-400 mb-1.5 flex items-center gap-1.5">
                    <Radio className="w-3.5 h-3.5" />
                    Ссылка на Twitch / YouTube трансляцию:
                  </label>
                  <input
                    type="url"
                    value={config.streamingUrl}
                    onChange={(e) => setConfig((prev) => ({ ...prev, streamingUrl: e.target.value }))}
                    placeholder="https://twitch.tv/ваш_канал"
                    className="w-full px-4 py-3 rounded-xl bg-purple-950/20 border border-purple-500/40 text-purple-200 placeholder-purple-400/40 focus:outline-none focus:border-purple-400 text-sm transition-all"
                  />
                  <p className="text-[11px] text-purple-400/80 mt-1.5">
                    * Discord требует действительную ссылку на Twitch или YouTube для активации фиолетовой иконки стриминга.
                  </p>
                </motion.div>
              )}
            </div>
          )}

          {/* Mode 2: Rotating Config */}
          {config.mode === 'ROTATING' && (
            <div className="bg-dark-900/60 backdrop-blur-xl p-6 rounded-2xl border border-dark-700/60 space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-semibold text-white flex items-center gap-2">
                    <Layers className="w-4 h-4 text-pink-400" />
                    Список статусов для ротации
                  </h2>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Бот автоматически переключается между включенными статусами по очереди
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleAddRotationItem}
                  className="px-3.5 py-1.5 rounded-xl bg-pink-500/10 text-pink-400 border border-pink-500/20 hover:bg-pink-500/20 text-xs font-semibold flex items-center gap-1.5 transition-all"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Добавить статус
                </button>
              </div>

              {/* Interval selector */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-dark-800/60 border border-dark-700">
                <div className="flex items-center gap-2.5">
                  <Clock className="w-4 h-4 text-pink-400" />
                  <span className="text-xs font-medium text-zinc-300">Интервал смены статуса:</span>
                </div>
                <div className="flex items-center gap-2">
                  {[15, 30, 60, 120, 300].map((sec) => (
                    <button
                      key={sec}
                      type="button"
                      onClick={() => setConfig((prev) => ({ ...prev, rotationInterval: sec }))}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
                        config.rotationInterval === sec
                          ? 'bg-pink-500 text-white border-pink-500'
                          : 'bg-dark-700/60 border-dark-600 text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      {sec >= 60 ? `${sec / 60} мин` : `${sec} сек`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Rotation items list */}
              <div className="space-y-3">
                {config.activities.length === 0 ? (
                  <div className="text-center py-8 border border-dashed border-dark-700 rounded-xl text-zinc-500 text-sm">
                    Нет добавленных статусов. Нажмите «Добавить статус», чтобы настроить ротацию.
                  </div>
                ) : (
                  config.activities.map((item, idx) => (
                    <div
                      key={item.id}
                      className="p-4 rounded-xl bg-dark-800/80 border border-dark-700/80 space-y-3 relative group"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-lg bg-dark-700 text-zinc-400 text-xs font-bold flex items-center justify-center">
                            #{idx + 1}
                          </span>
                          <select
                            value={item.type}
                            onChange={(e) => handleUpdateRotationItem(item.id, { type: e.target.value })}
                            className="px-2.5 py-1 rounded-lg bg-dark-700 border border-dark-600 text-xs font-medium text-white focus:outline-none focus:border-pink-500"
                          >
                            {ACTIVITY_TYPES.map((t) => (
                              <option key={t.value} value={t.value}>
                                {t.label}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleUpdateRotationItem(item.id, { enabled: !item.enabled })}
                            className={`px-2 py-0.5 rounded text-[11px] font-medium border transition-all ${
                              item.enabled !== false
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                : 'bg-zinc-700/40 text-zinc-400 border-zinc-600'
                            }`}
                          >
                            {item.enabled !== false ? 'Включен' : 'Отключен'}
                          </button>

                          <button
                            type="button"
                            onClick={() => handleRemoveRotationItem(item.id)}
                            className="p-1 text-zinc-500 hover:text-rose-400 transition-colors"
                            title="Удалить статус"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div>
                          <input
                            type="text"
                            value={item.name}
                            onFocus={() => {
                              setFocusedRotationId({ id: item.id, field: 'name' });
                            }}
                            onChange={(e) => handleUpdateRotationItem(item.id, { name: e.target.value })}
                            placeholder="Название (например: Majestic RP)"
                            className="w-full px-3 py-2 rounded-lg bg-dark-700/60 border border-dark-600 text-white placeholder-zinc-500 focus:outline-none focus:border-pink-500 text-xs"
                          />
                        </div>

                        <div>
                          <input
                            type="text"
                            value={item.state || ''}
                            onFocus={() => {
                              setFocusedRotationId({ id: item.id, field: 'state' });
                            }}
                            onChange={(e) => handleUpdateRotationItem(item.id, { state: e.target.value })}
                            placeholder="Описание (например: {members} бойцов)"
                            className="w-full px-3 py-2 rounded-lg bg-dark-700/60 border border-dark-600 text-white placeholder-zinc-500 focus:outline-none focus:border-pink-500 text-xs"
                          />
                        </div>
                      </div>

                      {item.type === 'STREAMING' && (
                        <div>
                          <input
                            type="url"
                            value={item.streamingUrl || ''}
                            onChange={(e) => handleUpdateRotationItem(item.id, { streamingUrl: e.target.value })}
                            placeholder="https://twitch.tv/interpol"
                            className="w-full px-3 py-1.5 rounded-lg bg-purple-950/20 border border-purple-500/30 text-purple-200 placeholder-purple-400/40 text-xs focus:outline-none focus:border-purple-400"
                          />
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Quick Presets */}
          <div className="bg-dark-900/60 backdrop-blur-xl p-6 rounded-2xl border border-dark-700/60 space-y-4">
            <h2 className="text-base font-semibold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-pink-400" />
              Готовые пресеты в 1 клик
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
              {PRESETS.map((preset, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleApplyPreset(preset)}
                  className="p-3 rounded-xl bg-dark-800/80 border border-dark-700 hover:border-pink-500/40 hover:bg-dark-750 transition-all text-left group"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-white group-hover:text-pink-300 transition-colors">
                      {preset.name}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-pink-500/10 text-pink-400 font-medium">
                      {preset.badge}
                    </span>
                  </div>
                  <div className="text-[11px] text-zinc-400 truncate">{preset.activityState || preset.activityName}</div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Discord Live Preview & Dynamic Placeholders (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Discord Profile Preview Card */}
          <div className="bg-[#1e1f22] rounded-2xl border border-dark-700/80 shadow-2xl overflow-hidden">
            {/* Discord Header Banner */}
            <div className="h-28 bg-gradient-to-r from-pink-600 via-rose-600 to-indigo-800 relative p-4 flex items-start justify-between">
              <div className="flex items-center gap-1.5 bg-black/40 backdrop-blur-md px-2.5 py-1 rounded-full text-[11px] font-semibold text-white/90">
                <Sparkles className="w-3.5 h-3.5 text-pink-300" />
                Discord Live Preview
              </div>

              {liveSnapshot?.isOnline && (
                <div className="flex items-center gap-1.5 bg-emerald-500/20 backdrop-blur-md border border-emerald-500/30 px-2.5 py-1 rounded-full text-[11px] font-medium text-emerald-300">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  Бот в сети
                </div>
              )}
            </div>

            {/* Profile Avatar & Body */}
            <div className="px-5 pb-5 -mt-10 relative space-y-4">
              {/* Avatar with Status Badge */}
              <div className="relative inline-block">
                <div className="w-20 h-20 rounded-full border-4 border-[#1e1f22] overflow-hidden bg-dark-800 shadow-xl flex items-center justify-center">
                  {liveSnapshot?.botAvatar ? (
                    <img
                      src={liveSnapshot.botAvatar}
                      alt="Bot Avatar"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Flame className="w-10 h-10 text-pink-500" />
                  )}
                </div>

                {/* Discord Status Indicator Badge */}
                <span
                  className={`absolute bottom-1 right-1 w-6 h-6 rounded-full border-[3.5px] border-[#1e1f22] flex items-center justify-center shadow-md ${
                    config.status === 'online'
                      ? 'bg-[#23a55a]'
                      : config.status === 'idle'
                      ? 'bg-[#f0b232]'
                      : config.status === 'dnd'
                      ? 'bg-[#f23f43]'
                      : 'bg-[#80848e]'
                  }`}
                >
                  {config.status === 'dnd' && <span className="w-2.5 h-0.5 bg-white rounded-full" />}
                  {config.status === 'idle' && (
                    <span className="w-2.5 h-2.5 rounded-full bg-[#1e1f22] -ml-1 -mt-1" />
                  )}
                </span>
              </div>

              {/* Bot User Info */}
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-white leading-tight">
                    {liveSnapshot?.botTag?.split('#')[0] || 'INTERPOL BOT'}
                  </h3>
                  <span className="bg-[#5865f2] text-white text-[10px] font-bold px-1.5 py-0.5 rounded tracking-wider uppercase flex items-center gap-1">
                    ✓ БОТ
                  </span>
                </div>
                <div className="text-xs text-zinc-400">
                  {liveSnapshot?.botTag || 'interpol#0000'}
                </div>
              </div>

              {/* Discord Divider */}
              <div className="h-px bg-[#2b2d31]" />

              {/* Activity Section inside Discord Card */}
              <div className="space-y-3">
                <div className="text-[11px] font-bold tracking-wider text-zinc-400 uppercase">
                  {config.enabled ? 'Активность' : 'Статус'}
                </div>

                {config.enabled ? (
                  <div className="bg-[#2b2d31]/70 p-3.5 rounded-xl border border-white/5 space-y-2.5">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-pink-500/20 border border-pink-500/30 flex items-center justify-center shrink-0">
                        {React.createElement(previewTypeInfo.icon, { className: 'w-5 h-5 text-pink-400' })}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="text-[11px] font-bold text-zinc-300 uppercase tracking-wide flex items-center gap-1.5">
                          {config.activityType === 'STREAMING' && (
                            <span className="w-2 h-2 rounded-full bg-purple-500 animate-ping" />
                          )}
                          {previewTypeInfo.label}
                        </div>

                        <div className="text-sm font-semibold text-white truncate mt-0.5">
                          {previewName || 'Majestic RP • Dallas'}
                        </div>

                        {previewState && (
                          <div className="text-xs text-zinc-400 truncate mt-0.5">
                            {previewState}
                          </div>
                        )}

                        {config.activityType === 'STREAMING' && config.streamingUrl && (
                          <div className="text-[11px] text-purple-400 mt-1 flex items-center gap-1 truncate">
                            <Radio className="w-3 h-3 shrink-0" />
                            {config.streamingUrl}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Mode Rotation Indicator */}
                    {config.mode === 'ROTATING' && (
                      <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[11px] text-zinc-400">
                        <span className="flex items-center gap-1.5 text-pink-400">
                          <Layers className="w-3.5 h-3.5" />
                          В очереди {config.activities.filter((a) => a.enabled !== false).length} статуса(-ов)
                        </span>
                        <span>Каждые {config.rotationInterval}с</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-3 rounded-xl bg-dark-800/40 text-xs text-zinc-500 text-center border border-dashed border-zinc-700/50">
                    Активность сейчас выключена
                  </div>
                )}
              </div>

              {/* Bot Info Footer */}
              <div className="pt-2 text-[11px] text-zinc-500 flex items-center justify-between">
                <span>Пинг WebSocket: {liveVariables.ping || '15ms'}</span>
                <span>МСК: {liveVariables.time || '--:--'}</span>
              </div>
            </div>
          </div>

          {/* Dynamic Placeholders / Variables Assistant */}
          <div className="bg-dark-900/60 backdrop-blur-xl p-5 rounded-2xl border border-dark-700/60 space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-pink-400" />
                <h3 className="text-sm font-bold text-white">Динамические переменные</h3>
              </div>
              <span className="text-[11px] text-zinc-400">Нажмите, чтобы вставить</span>
            </div>

            <p className="text-xs text-zinc-400 leading-relaxed">
              Используйте теги в названии или описании статуса. Они автоматически подменяются на актуальные значения с сервера:
            </p>

            <div className="grid grid-cols-2 gap-2">
              {[
                { tag: 'members', label: 'Всего участников', val: liveVariables.members, icon: Users },
                { tag: 'voiceCount', label: 'В голосовых каналах', val: liveVariables.voiceCount, icon: Volume2 },
                { tag: 'online', label: 'Участников онлайн', val: liveVariables.online, icon: CheckCircle2 },
                { tag: 'activeEvents', label: 'Сборов на МП', val: liveVariables.activeEvents, icon: Trophy },
                { tag: 'time', label: 'Время (МСК)', val: liveVariables.time, icon: Clock },
                { tag: 'date', label: 'Дата', val: liveVariables.date, icon: Clock },
                { tag: 'ping', label: 'Задержка бота', val: liveVariables.ping, icon: Radio },
                { tag: 'guilds', label: 'Количество серверов', val: liveVariables.guilds, icon: Layers },
              ].map((item) => (
                <button
                  key={item.tag}
                  type="button"
                  onClick={() => handleVariableClick(item.tag)}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-dark-800/80 border border-dark-700 hover:border-pink-500/50 hover:bg-dark-750 transition-all text-left group"
                >
                  <div className="min-w-0 pr-1">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-xs font-bold text-pink-400 group-hover:text-pink-300">
                        {`{${item.tag}}`}
                      </span>
                    </div>
                    <div className="text-[10px] text-zinc-400 truncate">{item.label}</div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-xs font-semibold text-zinc-300 bg-dark-700/60 px-1.5 py-0.5 rounded">
                      {item.val !== undefined ? String(item.val) : '...'}
                    </span>
                    {copiedVar === item.tag ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3 h-3 text-zinc-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                    )}
                  </div>
                </button>
              ))}
            </div>

            <div className="pt-2 text-[11px] text-zinc-500 flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 text-pink-400 shrink-0" />
              При ротации переменные обновляются при каждом шаге смены активности.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BotActivity;
