import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldAlert,
  Zap,
  AlertTriangle,
  RefreshCw,
  Save,
  Trash2,
  CheckCircle2,
  ExternalLink,
  Plus,
  Shield,
  Bot,
  UserX,
  Sparkles,
  Clock,
  RotateCcw,
  MessageSquare,
  HelpCircle,
  Hash,
  FolderPlus
} from 'lucide-react';
import api from '../api/client';
import { useModal } from '../context/ModalContext';
import { ChannelSelect, DiscordChannelItem } from '../components/ChannelSelect';
import { RoleSelect, DiscordRoleItem } from '../components/RoleSelect';

interface HoneypotConfig {
  id: string;
  guildId: string | null;
  channelId: string | null;
  channelName: string;
  messageId: string | null;
  enabled: boolean;
  action: 'KICK' | 'BAN';
  deleteSeconds: number;
  totalCaught: number;
  whitelistRoles: string;
  embedTitle: string;
  embedDescription: string;
}

interface HoneypotLogItem {
  id: string;
  userId: string;
  userTag: string;
  userAvatar: string | null;
  actionTaken: string;
  messageContent: string | null;
  caughtAt: string;
}

export const Honeypot: React.FC = () => {
  const modal = useModal();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settingUp, setSettingUp] = useState(false);

  const [config, setConfig] = useState<HoneypotConfig>({
    id: 'default',
    guildId: null,
    channelId: null,
    channelName: 'канал-ловушка',
    messageId: null,
    enabled: true,
    action: 'KICK',
    deleteSeconds: 600,
    totalCaught: 0,
    whitelistRoles: '[]',
    embedTitle: '🛡️ Канал-ловушка автомодерации',
    embedDescription: '⚠️ **НЕ ПИШИТЕ СООБЩЕНИЯ В ЭТОТ КАНАЛ**\n\nЭтот канал используется для выявления спам-ботов.\nЛюбое сообщение здесь приведёт к немедленной блокировке.',
  });

  const [guilds, setGuilds] = useState<any[]>([]);
  const [selectedGuildId, setSelectedGuildId] = useState<string>('');
  const [whitelistRoleIds, setWhitelistRoleIds] = useState<string[]>([]);
  const [channels, setChannels] = useState<DiscordChannelItem[]>([]);
  const [roles, setRoles] = useState<DiscordRoleItem[]>([]);
  const [recentLogs, setRecentLogs] = useState<HoneypotLogItem[]>([]);
  const [totalLogs, setTotalLogs] = useState(0);
  const [isBotOnline, setIsBotOnline] = useState(false);

  const loadData = async (silent = false, guildIdOverride?: string) => {
    try {
      if (!silent) setLoading(true);
      const activeGId = guildIdOverride !== undefined ? guildIdOverride : selectedGuildId;
      const url = activeGId ? `/api/honeypot?guildId=${activeGId}` : '/api/honeypot';
      const res = await api.get(url);
      if (res.data) {
        const conf = res.data.config;
        setConfig(conf);
        try {
          setWhitelistRoleIds(JSON.parse(conf.whitelistRoles || '[]'));
        } catch {
          setWhitelistRoleIds([]);
        }
        setChannels(res.data.channels || []);
        setRoles(res.data.roles || []);
        setRecentLogs(res.data.recentLogs || []);
        setTotalLogs(res.data.totalLogs || 0);
        setIsBotOnline(Boolean(res.data.isBotOnline));
        if (res.data.guilds) setGuilds(res.data.guilds);
        if (res.data.selectedGuildId && !activeGId) {
          setSelectedGuildId(res.data.selectedGuildId);
        }
      }
    } catch (err: any) {
      console.error('Failed to load honeypot config:', err);
      if (!silent) {
        modal.error('Не удалось загрузить данные канала-ловушки');
      }
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(() => {
      loadData(true);
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  const handleGuildChange = (newGId: string) => {
    setSelectedGuildId(newGId);
    loadData(false, newGId);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const payload = {
        ...config,
        whitelistRoles: whitelistRoleIds,
      };
      await api.put('/api/honeypot', payload);
      modal.success('Настройки канала-ловушки успешно сохранены!');
      loadData(true);
    } catch (err: any) {
      console.error('Failed to save honeypot config:', err);
      modal.error(err.response?.data?.error || 'Ошибка при сохранении настроек');
    } finally {
      setSaving(false);
    }
  };

  const handleSetupChannel = async () => {
    const ok = await modal.confirm({
      title: 'Создать канал-ловушку?',
      message: 'Бот автоматически создаст текстовый канал "канал-ловушка" на сервере Discord, настроит правильные права доступа для @everyone и отправит закрепленное предупреждающее сообщение.',
      confirmText: 'Создать канал',
      cancelText: 'Отмена',
      type: 'pink',
    });
    if (!ok) return;

    try {
      setSettingUp(true);
      const res = await api.post('/api/honeypot/setup-channel', {
        guildId: selectedGuildId || config.guildId,
      });
      if (res.data?.success) {
        modal.success(`Канал #${res.data.channelName} успешно создан и активирован в Discord!`);
        await loadData(true, selectedGuildId || res.data.guildId);
      }
    } catch (err: any) {
      console.error('Failed to setup honeypot channel:', err);
      modal.error(err.response?.data?.error || 'Ошибка создания канала-ловушки в Discord');
    } finally {
      setSettingUp(false);
    }
  };

  const handleRefreshEmbed = async () => {
    try {
      setSaving(true);
      await api.post('/api/honeypot/refresh-embed');
      modal.success('Предупреждающее сообщение в канале успешно обновлено!');
    } catch (err: any) {
      modal.error(err.response?.data?.error || 'Ошибка обновления сообщения');
    } finally {
      setSaving(false);
    }
  };

  const handleResetCounter = async () => {
    const ok = await modal.confirm({
      title: 'Сбросить счетчик пойманых ботов?',
      message: 'Счетчик нарушителей будет обнулен до 0. Предупреждающее сообщение в канале обновится автоматически.',
      confirmText: 'Да, сбросить в 0',
      cancelText: 'Отмена',
      type: 'warning',
    });
    if (!ok) return;

    try {
      await api.post('/api/honeypot/reset-counter');
      setConfig((prev) => ({ ...prev, totalCaught: 0 }));
      modal.success('Счетчик нарушителей сброшен в 0');
    } catch (err: any) {
      modal.error('Ошибка сброса счетчика');
    }
  };

  const handleClearLogs = async () => {
    const ok = await modal.confirm({
      title: 'Очистить историю логов?',
      message: 'Все записи о пойманных нарушителях будут безвозвратно удалены из базы данных.',
      confirmText: 'Очистить историю',
      cancelText: 'Отмена',
      type: 'danger',
    });
    if (!ok) return;

    try {
      await api.delete('/api/honeypot/logs');
      setRecentLogs([]);
      setTotalLogs(0);
      modal.success('Журнал пойманных ботов очищен');
    } catch (err: any) {
      modal.error('Ошибка очистки логов');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center animate-spin">
            <RefreshCw className="w-6 h-6 text-rose-500" />
          </div>
          <span className="text-zinc-400 text-sm font-medium">Загрузка канала-ловушки...</span>
        </div>
      </div>
    );
  }

  const selectedChannel = channels.find((c) => c.id === config.channelId);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-dark-900/60 backdrop-blur-xl p-6 rounded-2xl border border-dark-700/60 shadow-xl">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-rose-500/20 via-pink-500/20 to-red-500/20 border border-rose-500/30 flex items-center justify-center shadow-lg shadow-rose-500/10">
            <ShieldAlert className="w-7 h-7 text-rose-400" />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-white tracking-tight">Канал-ловушка автомодерации</h1>
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-semibold flex items-center gap-1.5 ${
                  config.enabled
                    ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                    : 'bg-zinc-500/10 text-zinc-400 border border-zinc-500/20'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${config.enabled ? 'bg-rose-400 animate-pulse' : 'bg-zinc-400'}`} />
                {config.enabled ? 'Ловушка активна' : 'Отключена'}
              </span>
            </div>
            <p className="text-sm text-zinc-400 mt-1">
              Автоматический отлов спам-ботов и рейдеров: мгновенный кик/бан и удаление всех сообщений за последние 10 минут
            </p>
          </div>
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center gap-3 self-end md:self-auto">
          <button
            onClick={handleSetupChannel}
            disabled={settingUp}
            className="px-4 py-2.5 rounded-xl text-sm font-semibold bg-dark-800 text-rose-300 border border-rose-500/30 hover:bg-rose-500/10 transition-all flex items-center gap-2"
          >
            {settingUp ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <FolderPlus className="w-4 h-4 text-rose-400" />
            )}
            Создать канал-ловушку в Discord
          </button>

          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 text-white shadow-lg shadow-rose-500/25 transition-all flex items-center gap-2 disabled:opacity-50"
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

      {guilds.length > 1 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-dark-900/60 backdrop-blur-xl p-4 rounded-2xl border border-dark-700/60">
          <div className="flex items-center gap-2 text-xs font-medium text-zinc-300">
            <span className="w-2 h-2 rounded-full bg-rose-400 animate-pulse" />
            Активный сервер Discord:
          </div>
          <select
            value={selectedGuildId}
            onChange={(e) => handleGuildChange(e.target.value)}
            className="px-3 py-2 rounded-xl bg-dark-800 border border-dark-700 text-white text-xs font-semibold focus:outline-none focus:border-rose-500"
          >
            {guilds.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name} ({g.id})
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Quick Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Caught Bots */}
        <div className="bg-dark-900/60 backdrop-blur-xl p-5 rounded-2xl border border-dark-700/60 relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-400">Поймано спамеров</span>
            <div className="p-2 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
              <Bot className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-white mt-2 flex items-baseline gap-2">
            <span>{config.totalCaught}</span>
            <button
              onClick={handleResetCounter}
              className="text-[11px] font-normal text-zinc-500 hover:text-rose-400 underline transition-colors"
            >
              сбросить
            </button>
          </div>
          <div className="text-xs text-zinc-500 mt-1">Автоматически ликвидировано ботом</div>
        </div>

        {/* Metric 2: Punishment Action */}
        <div className="bg-dark-900/60 backdrop-blur-xl p-5 rounded-2xl border border-dark-700/60">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-400">Наказание</span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Zap className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-bold text-white mt-2 truncate">
            {config.action === 'BAN' ? 'Блокировка (Бан)' : 'Кик с сервера (Софтбан)'}
          </div>
          <div className="text-xs text-zinc-500 mt-1">Очистка сообщений за 10 мин</div>
        </div>

        {/* Metric 3: Active Channel */}
        <div className="bg-dark-900/60 backdrop-blur-xl p-5 rounded-2xl border border-dark-700/60">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-400">Канал в Discord</span>
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <Hash className="w-4 h-4" />
            </div>
          </div>
          <div className="text-base font-bold text-white mt-2 flex items-center gap-1.5 truncate">
            {selectedChannel ? (
              <span className="text-purple-300">#{selectedChannel.name}</span>
            ) : config.channelId ? (
              <span className="text-zinc-300">ID: {config.channelId}</span>
            ) : (
              <span className="text-amber-400 text-sm">Не привязан</span>
            )}
          </div>
          <div className="text-xs text-zinc-500 mt-1">
            {config.messageId ? 'Эмбед закреплен ✓' : 'Эмбед не отправлен'}
          </div>
        </div>

        {/* Metric 4: Protection Status */}
        <div className="bg-dark-900/60 backdrop-blur-xl p-5 rounded-2xl border border-dark-700/60">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-400">Статус бота</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Shield className="w-4 h-4" />
            </div>
          </div>
          <div className="text-lg font-bold text-emerald-400 mt-2 flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            {isBotOnline ? '24/7 Мониторинг' : 'Оффлайн'}
          </div>
          <div className="text-xs text-zinc-500 mt-1">Реакция &lt; 50мс на спам</div>
        </div>
      </div>

      {/* Main Grid: Form Settings & Live Discord Embed Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Settings Left Column (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-dark-900/60 backdrop-blur-xl p-6 rounded-2xl border border-dark-700/60 space-y-5">
            <h2 className="text-base font-semibold text-white flex items-center gap-2">
              <Zap className="w-4 h-4 text-rose-400" />
              Параметры ловушки
            </h2>

            {/* Toggle Enable */}
            <div className="flex items-center justify-between p-4 rounded-xl bg-dark-800/80 border border-dark-700">
              <div>
                <div className="text-sm font-semibold text-white">Включить канал-ловушку</div>
                <div className="text-xs text-zinc-400 mt-0.5">
                  При выключении бот перестанет наказывать участников за сообщения в этом канале
                </div>
              </div>
              <button
                type="button"
                onClick={() => setConfig((prev) => ({ ...prev, enabled: !prev.enabled }))}
                className={`w-12 h-6 rounded-full transition-colors relative flex items-center p-0.5 ${
                  config.enabled ? 'bg-rose-500' : 'bg-dark-700'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full bg-white transition-transform ${
                    config.enabled ? 'translate-x-6' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Target Channel Selector */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-medium text-zinc-400">Канал-ловушка в Discord:</span>
                <button
                  type="button"
                  onClick={() => loadData(false, selectedGuildId)}
                  className="text-[11px] text-rose-400 hover:text-rose-300 flex items-center gap-1 transition-colors"
                >
                  <RefreshCw className="w-3 h-3" />
                  Обновить список каналов ({channels.length})
                </button>
              </div>
              <ChannelSelect
                channels={channels}
                value={config.channelId || ''}
                onChange={(val) => setConfig((prev) => ({ ...prev, channelId: val }))}
                channelType="text"
                placeholder="Выберите текстовый канал для ловушки..."
              />
              {channels.length === 0 ? (
                <div className="mt-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>Каналы не загружены. Нажмите «Обновить список каналов» или нажмите вверху кнопку «Создать канал-ловушку в Discord».</span>
                </div>
              ) : (
                <p className="text-[11px] text-zinc-500 mt-1">
                  Или нажмите вверху кнопку <b>«Создать канал-ловушку в Discord»</b> для автоматического создания.
                </p>
              )}
            </div>

            {/* Action Type Selection */}
            <div>
              <label className="text-xs font-medium text-zinc-400 mb-2 block">
                Действие при обнаружении спама в канале:
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setConfig((prev) => ({ ...prev, action: 'KICK' }))}
                  className={`flex flex-col p-4 rounded-xl border text-left transition-all ${
                    config.action === 'KICK'
                      ? 'bg-rose-500/10 border-rose-500/60 text-white ring-1 ring-rose-500/30'
                      : 'bg-dark-800/80 border-dark-700 text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <UserX className="w-4 h-4 text-rose-400" />
                    <span className="font-bold text-sm">Кик с сервера (Софтбан)</span>
                  </div>
                  <span className="text-xs text-zinc-400">
                    Исключает нарушителя и удаляет <b>все его сообщения за последние 10 минут</b> по всему серверу.
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setConfig((prev) => ({ ...prev, action: 'BAN' }))}
                  className={`flex flex-col p-4 rounded-xl border text-left transition-all ${
                    config.action === 'BAN'
                      ? 'bg-rose-500/10 border-rose-500/60 text-white ring-1 ring-rose-500/30'
                      : 'bg-dark-800/80 border-dark-700 text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <AlertTriangle className="w-4 h-4 text-rose-400" />
                    <span className="font-bold text-sm">Перманентный бан</span>
                  </div>
                  <span className="text-xs text-zinc-400">
                    Навсегда блокирует нарушителя и удаляет <b>все его сообщения за последние 10 минут</b>.
                  </span>
                </button>
              </div>
            </div>

            {/* Whitelist Roles */}
            <div>
              <label className="text-xs font-medium text-zinc-400 mb-1.5 flex items-center justify-between">
                <span>Исключения (Whitelist ролей):</span>
                <span className="text-[11px] text-zinc-500">Администраторы защищены автоматически</span>
              </label>
              <RoleSelect
                roles={roles}
                value={whitelistRoleIds}
                onChange={(ids) => setWhitelistRoleIds(ids)}
                placeholder="Выберите роли, которые защищены от ловушки..."
                isMulti={true}
              />
              <p className="text-[11px] text-zinc-500 mt-1">
                Участники с этими ролями не будут наказываться при случайной отправке сообщения.
              </p>
            </div>

            {/* Embed Text Customization */}
            <div className="pt-3 border-t border-dark-700/60 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-zinc-300">Текст предупреждающего эмбеда:</span>
                <button
                  type="button"
                  onClick={handleRefreshEmbed}
                  className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1 transition-colors"
                >
                  <RefreshCw className="w-3 h-3" />
                  Обновить эмбед в канале
                </button>
              </div>

              <div>
                <label className="text-[11px] text-zinc-400 block mb-1">Заголовок эмбеда:</label>
                <input
                  type="text"
                  value={config.embedTitle}
                  onChange={(e) => setConfig((prev) => ({ ...prev, embedTitle: e.target.value }))}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-dark-800 border border-dark-700 text-white text-xs focus:outline-none focus:border-rose-500"
                />
              </div>

              <div>
                <label className="text-[11px] text-zinc-400 block mb-1">Описание / Текст предупреждения:</label>
                <textarea
                  rows={3}
                  value={config.embedDescription}
                  onChange={(e) => setConfig((prev) => ({ ...prev, embedDescription: e.target.value }))}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-dark-800 border border-dark-700 text-white text-xs focus:outline-none focus:border-rose-500 resize-none"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Discord Embed Preview Right Column (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Discord Card Preview */}
          <div className="bg-[#2b2d31] rounded-2xl border border-dark-700/80 shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between text-xs text-zinc-400 pb-2 border-b border-white/5">
              <span className="flex items-center gap-1.5 font-medium">
                <Sparkles className="w-3.5 h-3.5 text-rose-400" />
                Вид эмбеда в Discord
              </span>
              <span className="text-[11px] bg-black/30 px-2 py-0.5 rounded text-zinc-400">
                #{selectedChannel?.name || config.channelName || 'канал-ловушка'}
              </span>
            </div>

            {/* The Embed Box */}
            <div className="bg-[#1e1f22] rounded-lg border-l-4 border-rose-500 p-4 space-y-3.5 shadow-md">
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                  {config.embedTitle || '🛡️ Канал-ловушка автомодерации'}
                </h4>
                <div className="text-xs text-zinc-300 whitespace-pre-line leading-relaxed font-sans">
                  {config.embedDescription ||
                    '⚠️ НЕ ПИШИТЕ СООБЩЕНИЯ В ЭТОТ КАНАЛ\n\nЭтот канал используется для выявления спам-ботов.'}
                </div>
              </div>

              {/* Embed Fields */}
              <div className="space-y-2.5 pt-2 border-t border-white/5">
                <div className="space-y-0.5">
                  <div className="text-[11px] font-bold text-zinc-400 uppercase tracking-wide">
                    📊 Статистика защиты
                  </div>
                  <div className="text-xs text-zinc-300 space-y-0.5 font-mono">
                    <div>• Поймано и наказано: <span className="text-rose-400 font-bold">{config.totalCaught}</span></div>
                    <div>• Статус: <span className="text-emerald-400 font-bold">{config.enabled ? 'Активна 🟢' : 'Выключена 🔴'}</span></div>
                    <div>• Наказание: <span className="text-zinc-200">{config.action === 'BAN' ? 'Блокировка (Бан)' : 'Кик с сервера'}</span></div>
                  </div>
                </div>

                <div className="space-y-0.5">
                  <div className="text-[11px] font-bold text-zinc-400 uppercase tracking-wide">
                    ⚠️ Предупреждение
                  </div>
                  <div className="text-xs text-zinc-400 leading-snug">
                    Все сообщения в этом канале моментально удаляются, а автор исключается с сервера с удалением истории за 10 минут.
                  </div>
                </div>
              </div>

              {/* Embed Footer */}
              <div className="pt-2 text-[10px] text-zinc-500 flex items-center justify-between border-t border-white/5">
                <span>INTERPOL Security System • Автомодерация</span>
                <span>Сегодня</span>
              </div>
            </div>

            {/* Hint Box */}
            <div className="p-3 rounded-xl bg-dark-800/80 border border-dark-700/60 text-xs text-zinc-400 flex items-start gap-2.5">
              <HelpCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div>
                Обычные участники видят канал и предупреждение, но не пишут. Спам-боты и рейдеры рассылают сообщения по всем доступным каналам и моментально попадаются в ловушку.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Incidents / Logs Table */}
      <div className="bg-dark-900/60 backdrop-blur-xl p-6 rounded-2xl border border-dark-700/60 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <UserX className="w-4 h-4 text-rose-400" />
              Журнал перехваченных спам-ботов
            </h3>
            <p className="text-xs text-zinc-400 mt-0.5">
              Последние инциденты срабатывания ловушки автомодерации ({totalLogs} всего записей)
            </p>
          </div>

          {recentLogs.length > 0 && (
            <button
              onClick={handleClearLogs}
              className="px-3 py-1.5 rounded-xl bg-dark-800 hover:bg-rose-500/10 text-zinc-400 hover:text-rose-400 border border-dark-700 hover:border-rose-500/30 text-xs font-medium transition-all flex items-center gap-1.5 self-start sm:self-auto"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Очистить журнал
            </button>
          )}
        </div>

        {recentLogs.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-dark-700/80 rounded-xl text-zinc-500 text-sm">
            Спам-боты пока не попадались в ловушку. Система защиты активна и ожидает нарушителей.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-dark-700/60">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-dark-800/80 border-b border-dark-700 text-zinc-400 text-xs font-semibold uppercase tracking-wider">
                  <th className="py-3 px-4">Время (МСК)</th>
                  <th className="py-3 px-4">Нарушитель</th>
                  <th className="py-3 px-4">Действие</th>
                  <th className="py-3 px-4">Перехваченное сообщение</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-700/50 text-xs">
                {recentLogs.map((log) => {
                  const dateStr = new Date(log.caughtAt).toLocaleString('ru-RU', {
                    timeZone: 'Europe/Moscow',
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  });

                  return (
                    <tr key={log.id} className="hover:bg-dark-800/40 transition-colors">
                      <td className="py-3 px-4 text-zinc-400 font-mono whitespace-nowrap">
                        {dateStr}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          {log.userAvatar ? (
                            <img
                              src={log.userAvatar}
                              alt=""
                              className="w-7 h-7 rounded-full object-cover border border-white/10"
                            />
                          ) : (
                            <div className="w-7 h-7 rounded-full bg-dark-700 flex items-center justify-center text-zinc-400">
                              <Bot className="w-4 h-4" />
                            </div>
                          )}
                          <div>
                            <div className="font-semibold text-white">{log.userTag}</div>
                            <div className="text-[10px] text-zinc-500 font-mono">ID: {log.userId}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${
                            log.actionTaken === 'BAN'
                              ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                              : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                          }`}
                        >
                          {log.actionTaken === 'BAN' ? 'Забанен (10м)' : 'Кикнут (10м)'}
                        </span>
                      </td>
                      <td className="py-3 px-4 max-w-md truncate text-zinc-300 font-mono text-[11px]">
                        {log.messageContent || '[Без текста / Вложение]'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default Honeypot;
