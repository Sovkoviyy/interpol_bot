import React, { useEffect, useState } from 'react';
import { 
  Server, 
  Sparkles, 
  Send, 
  Save, 
  FolderPlus, 
  Hash, 
  Volume2, 
  Layers, 
  ShieldCheck, 
  CheckCircle2, 
  RefreshCw, 
  AlertTriangle,
  FolderTree,
  IdCard,
  CalendarOff,
  UserPlus,
  CalendarDays,
  GraduationCap,
  ScrollText,
  HelpCircle,
  UserCheck,
  MessageSquare,
  ExternalLink
} from 'lucide-react';
import api from '../api/client';
import { useModal } from '../context/ModalContext';

export const ServerSetup: React.FC = () => {
  const modal = useModal();
  const [guilds, setGuilds] = useState<any[]>([]);
  const [selectedGuildId, setSelectedGuildId] = useState<string>('');
  const [state, setState] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [provisioning, setProvisioning] = useState(false);
  const [deployPanelsCheck, setDeployPanelsCheck] = useState(true);

  // Form bindings state
  const [bindings, setBindings] = useState({
    staticBindingChannelId: '',
    leaveRequestChannelId: '',
    eventAnnounceChannelId: '',
    eventVoiceChannelId: '',
    recruitmentApplyChannelId: '',
    recruitmentReviewChannelId: '',
    academyCategoryId: '',
    academyArchiveCategoryId: '',
    welcomeChannelId: '',
    welcomeEnabled: true,
  });

  const [savingBindings, setSavingBindings] = useState(false);
  const [deployingPanel, setDeployingPanel] = useState<string | null>(null);

  // 1. Fetch available guilds
  const fetchGuilds = async () => {
    try {
      const res = await api.get('/setup/guilds');
      const list = res.data.guilds || [];
      setGuilds(list);

      const savedGuildId = localStorage.getItem('selectedGuildId');
      if (savedGuildId && list.some((g: any) => g.id === savedGuildId)) {
        setSelectedGuildId(savedGuildId);
      } else if (list.length > 0) {
        setSelectedGuildId(list[0].id);
        localStorage.setItem('selectedGuildId', list[0].id);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // 2. Fetch setup state for selected guild
  const fetchState = async (guildId: string) => {
    if (!guildId) return;
    try {
      setLoading(true);
      const res = await api.get(`/setup/status?guildId=${guildId}`);
      setState(res.data);
      if (res.data.bindings) {
        setBindings({
          staticBindingChannelId: res.data.bindings.staticBindingChannelId || '',
          leaveRequestChannelId: res.data.bindings.leaveRequestChannelId || '',
          eventAnnounceChannelId: res.data.bindings.eventAnnounceChannelId || '',
          eventVoiceChannelId: res.data.bindings.eventVoiceChannelId || '',
          recruitmentApplyChannelId: res.data.bindings.recruitmentApplyChannelId || '',
          recruitmentReviewChannelId: res.data.bindings.recruitmentReviewChannelId || '',
          academyCategoryId: res.data.bindings.academyCategoryId || '',
          academyArchiveCategoryId: res.data.bindings.academyArchiveCategoryId || '',
          welcomeChannelId: res.data.bindings.welcomeChannelId || '',
          welcomeEnabled: res.data.bindings.welcomeEnabled ?? true,
        });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGuilds();
  }, []);

  useEffect(() => {
    if (selectedGuildId) {
      localStorage.setItem('selectedGuildId', selectedGuildId);
      fetchState(selectedGuildId);
    }
  }, [selectedGuildId]);

  const handleGuildChange = (newGuildId: string) => {
    setSelectedGuildId(newGuildId);
  };

  // 3. One-Click Provisioning
  const handleProvision = () => {
    const currentGuild = guilds.find((g) => g.id === selectedGuildId);
    const guildName = currentGuild ? currentGuild.name : selectedGuildId;

    modal.confirm({
      title: 'Автоматическая настройка сервера?',
      message:
        `Бот автоматически создаст полную структуру сервера «${guildName}»:\n\n` +
        `• Категорию «📋 ИНФОРМАЦИЯ» (#добро-пожаловать, #привязка-статика, #отпуска-неактив)\n` +
        `• Категорию «📥 НАБОР В СЕМЬЮ» (#подать-заявку, #заявки-набор)\n` +
        `• Категорию «⚔️ МЕРОПРИЯТИЯ (МП)» (#сборы-на-мп, 🔊 Сбор на МП)\n` +
        `• Категории «🎓 ACADEMY» и «📁 ACADEMY ARCHIVE»\n` +
        `• Категорию «📜 LOGS» со всеми 8 лог-каналами аудита\n` +
        (deployPanelsCheck ? `• Авто-отправку всех интерактивных сообщений с кнопками\n\n` : `\n`) +
        `Если каналы с такими именами уже существуют, бот аккуратно переиспользует их без дублирования.`,
      type: 'pink',
      confirmText: 'Да, создать структуру',
      onConfirm: async () => {
        try {
          setProvisioning(true);
          const res = await api.post('/setup/provision', {
            guildId: selectedGuildId,
            deployPanels: deployPanelsCheck,
          });

          const resData = res.data?.result;
          modal.alert({
            title: 'Структура успешно развернута!',
            message:
              `Сервер «${resData?.guildName || guildName}» успешно настроен!\n\n` +
              `• Создано/найдено категорий: ${resData?.categoriesCreated?.length || 0}\n` +
              `• Создано/найдено каналов: ${resData?.channelsCreated?.length || 0}\n` +
              `• Опубликовано панелей с кнопками: ${resData?.panelsDeployed?.join(', ') || 'нет'}\n\n` +
              `Все ID каналов автоматически сохранены в базу данных.`,
            type: 'success',
          });

          await fetchState(selectedGuildId);
        } catch (err: any) {
          modal.alert({
            title: 'Ошибка инициализации',
            message: err.response?.data?.error || 'Не удалось создать структуру сервера',
            type: 'error',
          });
        } finally {
          setProvisioning(false);
        }
      },
    });
  };

  // 4. Save custom channel bindings
  const handleSaveBindings = async () => {
    try {
      setSavingBindings(true);
      await api.post('/setup/bindings', {
        guildId: selectedGuildId,
        bindings,
      });

      modal.alert({
        title: 'Успешно',
        message: 'Привязки каналов успешно обновлены и сохранены в базе!',
        type: 'success',
      });
      fetchState(selectedGuildId);
    } catch (err: any) {
      modal.alert({
        title: 'Ошибка сохранения',
        message: err.response?.data?.error || 'Не удалось сохранить привязки',
        type: 'error',
      });
    } finally {
      setSavingBindings(false);
    }
  };

  // 5. Deploy / Re-deploy specific panel
  const handleDeploySpecificPanel = async (panelType: 'static' | 'leave' | 'recruit' | 'welcome' | 'logs' | 'voice-tracker', channelId?: string) => {
    try {
      setDeployingPanel(panelType);
      await api.post('/setup/deploy-panel', {
        guildId: selectedGuildId,
        panelType,
        channelId,
      });

      modal.alert({
        title: 'Панель отправлена',
        message: 'Сообщение от бота с интерактивными кнопками успешно опубликовано в канале!',
        type: 'success',
      });
      fetchState(selectedGuildId);
    } catch (err: any) {
      modal.alert({
        title: 'Ошибка отправки',
        message: err.response?.data?.error || 'Не удалось отправить панель в канал',
        type: 'error',
      });
    } finally {
      setDeployingPanel(null);
    }
  };

  const currentGuild = guilds.find((g) => g.id === selectedGuildId);
  const textChannels = (state?.channels || []).filter((c: any) => c.type === 0 || c.type === 'GUILD_TEXT');
  const voiceChannels = (state?.channels || []).filter((c: any) => c.type === 2 || c.type === 'GUILD_VOICE');
  const categories = (state?.channels || []).filter((c: any) => c.type === 4 || c.type === 'GUILD_CATEGORY');

  return (
    <div className="space-y-6 w-full">
      {/* Header & Server Selector */}
      <div className="bg-dark-900/60 border border-dark-800 rounded-2xl p-6 backdrop-blur-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
              <FolderTree className="w-6 h-6 text-pink-500" />
              Инициализация сервера & Настройка каналов
            </h1>
            <p className="text-sm text-gray-400 mt-1">
              Автоматическое создание категорий, каналов и сообщений бота для тестового или рабочего сервера
            </p>
          </div>

          {/* Server Selector Dropdown */}
          <div className="flex items-center gap-3 bg-dark-800/80 border border-dark-700 p-2 rounded-xl">
            <Server className="w-4 h-4 text-pink-400 shrink-0 ml-1" />
            <div className="text-xs text-gray-400 shrink-0">Выбранный сервер:</div>
            <select
              value={selectedGuildId}
              onChange={(e) => handleGuildChange(e.target.value)}
              className="bg-dark-900 text-white font-medium text-xs px-3 py-1.5 rounded-lg border border-dark-700 focus:outline-none focus:border-pink-500 transition-colors"
            >
              {guilds.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name} ({g.memberCount} участников)
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Selected Guild Overview Card */}
        {currentGuild && (
          <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-dark-800/40 border border-dark-800 rounded-xl">
            <div className="flex items-center gap-3">
              {currentGuild.icon ? (
                <img
                  src={currentGuild.icon}
                  alt={currentGuild.name}
                  className="w-10 h-10 rounded-xl border border-pink-500/30"
                />
              ) : (
                <div className="w-10 h-10 rounded-xl bg-pink-500/10 border border-pink-500/20 flex items-center justify-center text-pink-400 font-bold text-sm">
                  {currentGuild.name.slice(0, 2).toUpperCase()}
                </div>
              )}
              <div>
                <div className="text-sm font-bold text-white flex items-center gap-2">
                  {currentGuild.name}
                  <span className="text-[11px] font-mono text-gray-500 font-normal">ID: {currentGuild.id}</span>
                </div>
                <div className="text-xs text-gray-400">
                  Участников: <span className="text-slate-200 font-medium">{currentGuild.memberCount}</span> •
                  Каналов на сервере: <span className="text-slate-200 font-medium">{state?.channels?.length || 0}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {currentGuild.hasAdmin ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Права Администратора активны
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Рекомендуется выдать роль с правами Администратора
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* One-Click Provisioning Banner */}
      <div className="relative overflow-hidden bg-gradient-to-br from-pink-950/30 via-dark-900 to-dark-900 border border-pink-500/30 rounded-2xl p-6 backdrop-blur-sm shadow-xl">
        <div className="absolute -right-10 -bottom-10 w-48 h-48 bg-pink-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-pink-500/20 text-pink-400 border border-pink-500/30">
              <Sparkles className="w-3.5 h-3.5" />
              Быстрый старт для тестового сервера
            </div>
            <h2 className="text-lg font-bold text-white">
              Создать всю структуру каналов, категорий и сообщений в 1 клик
            </h2>
            <p className="text-xs text-gray-300 leading-relaxed">
              Бот автоматически сформирует готовый сервер для семьи: создаст категории информации, набора,
              МП, академии и аудита, настроит права доступа, пропишет ID каналов в базу и опубликует рабочие интерактивные сообщения с кнопками.
            </p>
            <div className="pt-2 flex items-center gap-2">
              <input
                type="checkbox"
                id="deployPanels"
                checked={deployPanelsCheck}
                onChange={(e) => setDeployPanelsCheck(e.target.checked)}
                className="w-4 h-4 rounded text-pink-600 focus:ring-pink-500 bg-dark-800 border-dark-700 cursor-pointer"
              />
              <label htmlFor="deployPanels" className="text-xs text-gray-300 cursor-pointer">
                Сразу отправить интерактивные сообщения бота в каналы (привязка статика, отпуска, набор)
              </label>
            </div>
          </div>

          <button
            onClick={handleProvision}
            disabled={provisioning || loading}
            className="flex items-center justify-center gap-2.5 px-6 py-3.5 bg-gradient-to-r from-pink-600 via-rose-500 to-pink-500 hover:from-pink-500 hover:to-rose-400 text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-pink-500/25 shrink-0 disabled:opacity-50"
          >
            <Sparkles className={`w-4 h-4 ${provisioning ? 'animate-spin' : ''}`} />
            {provisioning ? 'Создание структуры...' : '🚀 Создать структуру сервера в 1 клик'}
          </button>
        </div>
      </div>

      {/* Module Channels Management & Re-deploy Cards */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <FolderPlus className="w-5 h-5 text-pink-500" />
              Привязка каналов и управление сообщениями
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Вы можете переназначить каналы для любого функционала и переотправить нужные сообщения бота по кнопке
            </p>
          </div>
          <button
            onClick={handleSaveBindings}
            disabled={savingBindings || loading}
            className="flex items-center gap-2 px-4 py-2 bg-pink-600 hover:bg-pink-500 text-white rounded-xl text-xs font-semibold transition-all shadow-md shadow-pink-500/20 disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" />
            {savingBindings ? 'Сохранение...' : 'Сохранить все привязки'}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Card 1: Static Binding */}
          <div className="bg-dark-900/60 border border-dark-800 rounded-2xl p-5 backdrop-blur-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-pink-500/10 border border-pink-500/20 flex items-center justify-center text-pink-400">
                  <IdCard className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">Привязка Static ID</h3>
                  <p className="text-[11px] text-gray-400">Кнопка «🆔 Привязать статик»</p>
                </div>
              </div>
              <button
                onClick={() => handleDeploySpecificPanel('static', bindings.staticBindingChannelId)}
                disabled={deployingPanel === 'static' || !bindings.staticBindingChannelId}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-dark-800 hover:bg-pink-500/20 text-pink-400 border border-dark-700 hover:border-pink-500/40 rounded-xl text-xs font-medium transition-all disabled:opacity-50"
                title="Отправить панель в выбранный канал"
              >
                <Send className="w-3 h-3" />
                {deployingPanel === 'static' ? 'Отправка...' : 'Отправить панель'}
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1.5">Канал для привязки статика</label>
              <select
                value={bindings.staticBindingChannelId}
                onChange={(e) => setBindings({ ...bindings, staticBindingChannelId: e.target.value })}
                className="w-full bg-dark-800/80 border border-dark-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-pink-500 transition-colors"
              >
                <option value="">Не выбран (выберите канал)...</option>
                {textChannels.map((ch: any) => (
                  <option key={ch.id} value={ch.id}>
                    #{ch.name} (ID: {ch.id})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Card 2: Leave & Absence */}
          <div className="bg-dark-900/60 border border-dark-800 rounded-2xl p-5 backdrop-blur-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                  <CalendarOff className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">Заявки на отпуск / АФК</h3>
                  <p className="text-[11px] text-gray-400">Кнопка «🏖️ Подать на отпуск»</p>
                </div>
              </div>
              <button
                onClick={() => handleDeploySpecificPanel('leave', bindings.leaveRequestChannelId)}
                disabled={deployingPanel === 'leave' || !bindings.leaveRequestChannelId}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-dark-800 hover:bg-amber-500/20 text-amber-400 border border-dark-700 hover:border-amber-500/40 rounded-xl text-xs font-medium transition-all disabled:opacity-50"
                title="Отправить панель в выбранный канал"
              >
                <Send className="w-3 h-3" />
                {deployingPanel === 'leave' ? 'Отправка...' : 'Отправить панель'}
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1.5">Канал для оформления отпусков</label>
              <select
                value={bindings.leaveRequestChannelId}
                onChange={(e) => setBindings({ ...bindings, leaveRequestChannelId: e.target.value })}
                className="w-full bg-dark-800/80 border border-dark-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-pink-500 transition-colors"
              >
                <option value="">Не выбран (выберите канал)...</option>
                {textChannels.map((ch: any) => (
                  <option key={ch.id} value={ch.id}>
                    #{ch.name} (ID: {ch.id})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Card 3: Recruitment */}
          <div className="bg-dark-900/60 border border-dark-800 rounded-2xl p-5 backdrop-blur-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                  <UserPlus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">Набор в семью (Рекрутинг)</h3>
                  <p className="text-[11px] text-gray-400">Кнопка «📝 Подать заявку в семью»</p>
                </div>
              </div>
              <button
                onClick={() => handleDeploySpecificPanel('recruit', bindings.recruitmentApplyChannelId)}
                disabled={deployingPanel === 'recruit' || !bindings.recruitmentApplyChannelId}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-dark-800 hover:bg-blue-500/20 text-blue-400 border border-dark-700 hover:border-blue-500/40 rounded-xl text-xs font-medium transition-all disabled:opacity-50"
                title="Отправить панель в канал набора"
              >
                <Send className="w-3 h-3" />
                {deployingPanel === 'recruit' ? 'Отправка...' : 'Отправить панель'}
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1.5">Канал с кнопкой подачи заявки</label>
                <select
                  value={bindings.recruitmentApplyChannelId}
                  onChange={(e) => setBindings({ ...bindings, recruitmentApplyChannelId: e.target.value })}
                  className="w-full bg-dark-800/80 border border-dark-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-pink-500 transition-colors"
                >
                  <option value="">Не выбран (выберите канал)...</option>
                  {textChannels.map((ch: any) => (
                    <option key={ch.id} value={ch.id}>
                      #{ch.name} (ID: {ch.id})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1.5">Канал для логов и проверки анкет (#заявки-лог)</label>
                <select
                  value={bindings.recruitmentReviewChannelId}
                  onChange={(e) => setBindings({ ...bindings, recruitmentReviewChannelId: e.target.value })}
                  className="w-full bg-dark-800/80 border border-dark-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-pink-500 transition-colors"
                >
                  <option value="">Не выбран (выберите канал)...</option>
                  {textChannels.map((ch: any) => (
                    <option key={ch.id} value={ch.id}>
                      #{ch.name} (ID: {ch.id})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Card 4: Events & Voice */}
          <div className="bg-dark-900/60 border border-dark-800 rounded-2xl p-5 backdrop-blur-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
                  <CalendarDays className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">Сборы на мероприятия (МП)</h3>
                  <p className="text-[11px] text-gray-400">Пульт управления МП и войс канал сбора</p>
                </div>
              </div>
              <button
                onClick={() => handleDeploySpecificPanel('voice-tracker', bindings.eventAnnounceChannelId)}
                disabled={deployingPanel === 'voice-tracker' || !bindings.eventAnnounceChannelId}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-dark-800 hover:bg-rose-500/20 text-rose-400 border border-dark-700 hover:border-rose-500/40 rounded-xl text-xs font-medium transition-all disabled:opacity-50"
                title="Отправить пульт управления МП в выбранный канал"
              >
                <Send className="w-3 h-3" />
                {deployingPanel === 'voice-tracker' ? 'Отправка...' : 'Отправить пульт МП'}
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1.5">Текстовый канал анонсов МП</label>
                <select
                  value={bindings.eventAnnounceChannelId}
                  onChange={(e) => setBindings({ ...bindings, eventAnnounceChannelId: e.target.value })}
                  className="w-full bg-dark-800/80 border border-dark-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-pink-500 transition-colors"
                >
                  <option value="">Не выбран (выберите канал)...</option>
                  {textChannels.map((ch: any) => (
                    <option key={ch.id} value={ch.id}>
                      #{ch.name} (ID: {ch.id})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1.5">Голосовой канал сбора (Voice Tracker)</label>
                <select
                  value={bindings.eventVoiceChannelId}
                  onChange={(e) => setBindings({ ...bindings, eventVoiceChannelId: e.target.value })}
                  className="w-full bg-dark-800/80 border border-dark-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-pink-500 transition-colors"
                >
                  <option value="">Не выбран (выберите канал)...</option>
                  {voiceChannels.map((ch: any) => (
                    <option key={ch.id} value={ch.id}>
                      🔊 {ch.name} (ID: {ch.id})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Card 5: Academy */}
          <div className="bg-dark-900/60 border border-dark-800 rounded-2xl p-5 backdrop-blur-sm space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-fuchsia-500/10 border border-fuchsia-500/20 flex items-center justify-center text-fuchsia-400">
                <GraduationCap className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">Категории Академии (1-2 ранг)</h3>
                <p className="text-[11px] text-gray-400">Категории для каналов #academ-name и архива</p>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1.5">Категория активных академиков</label>
                <select
                  value={bindings.academyCategoryId}
                  onChange={(e) => setBindings({ ...bindings, academyCategoryId: e.target.value })}
                  className="w-full bg-dark-800/80 border border-dark-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-pink-500 transition-colors"
                >
                  <option value="">Не выбрана...</option>
                  {categories.map((c: any) => (
                    <option key={c.id} value={c.id}>
                      📁 {c.name} (ID: {c.id})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1.5">Категория архива завершенных каналов</label>
                <select
                  value={bindings.academyArchiveCategoryId}
                  onChange={(e) => setBindings({ ...bindings, academyArchiveCategoryId: e.target.value })}
                  className="w-full bg-dark-800/80 border border-dark-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-pink-500 transition-colors"
                >
                  <option value="">Не выбрана...</option>
                  {categories.map((c: any) => (
                    <option key={c.id} value={c.id}>
                      📁 {c.name} (ID: {c.id})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Card 6: Audit Logs & Setup */}
          <div className="bg-dark-900/60 border border-dark-800 rounded-2xl p-5 backdrop-blur-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                  <ScrollText className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">Аудит сервера (8 каналов логирования)</h3>
                  <p className="text-[11px] text-gray-400">Категория LOGS и каналы для фиксации всех событий сервера</p>
                </div>
              </div>
              <button
                onClick={() => handleDeploySpecificPanel('logs')}
                disabled={deployingPanel === 'logs'}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-dark-800 hover:bg-emerald-500/20 text-emerald-400 border border-dark-700 hover:border-emerald-500/40 rounded-xl text-xs font-medium transition-all disabled:opacity-50"
                title="Пересоздать / проверить каналы аудита"
              >
                <RefreshCw className={`w-3 h-3 ${deployingPanel === 'logs' ? 'animate-spin' : ''}`} />
                {deployingPanel === 'logs' ? 'Проверка...' : 'Развернуть логи'}
              </button>
            </div>

            {/* Category Status Bar */}
            <div className="flex items-center justify-between p-2.5 bg-dark-800/60 rounded-xl border border-dark-700/60 text-xs">
              <span className="text-gray-400 font-medium">Категория LOGS:</span>
              <span className="font-mono text-emerald-400 font-semibold">
                {state?.bindings?.logsCategoryId ? `📁 LOGS (ID: ${state.bindings.logsCategoryId})` : '⚪ Не создана'}
              </span>
            </div>

            {/* All 8 Log Channels Breakdown */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              {[
                { key: 'messageLogsChannelId', label: 'Логи сообщений', defName: 'msg-logs', icon: '💬' },
                { key: 'memberLogsChannelId', label: 'Логи участников', defName: 'member-logs', icon: '👤' },
                { key: 'roleLogsChannelId', label: 'Логи ролей', defName: 'role-logs', icon: '🛡️' },
                { key: 'channelLogsChannelId', label: 'Логи каналов', defName: 'channel-logs', icon: '📁' },
                { key: 'voiceLogsChannelId', label: 'Логи войса', defName: 'voice-logs', icon: '🔊' },
                { key: 'inviteLogsChannelId', label: 'Логи инвайтов', defName: 'invite-logs', icon: '🔗' },
                { key: 'botLogsChannelId', label: 'Действия бота', defName: 'bot-actions-logs', icon: '🤖' },
                { key: 'eventLogsChannelId', label: 'Логи МП и сборов', defName: 'ивенты-лог', icon: '⚔️' },
              ].map((log) => {
                const chId = (state?.bindings as any)?.[log.key];
                const channelObj = chId ? (state?.channels || []).find((c: any) => c.id === chId) : null;
                const isConfigured = Boolean(chId);

                return (
                  <div
                    key={log.key}
                    className="p-2.5 bg-dark-800/40 rounded-xl border border-dark-800/80 flex items-center justify-between gap-2"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm shrink-0">{log.icon}</span>
                      <div className="min-w-0">
                        <span className="text-white font-medium block truncate text-[11px]">{log.label}</span>
                        <span className="text-[10px] text-gray-400 font-mono block truncate">
                          {channelObj ? `#${channelObj.name}` : chId ? `ID: ${chId}` : `#${log.defName}`}
                        </span>
                      </div>
                    </div>

                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-semibold font-mono shrink-0 ${
                        isConfigured
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-gray-500/10 text-gray-500 border border-gray-700/30'
                      }`}
                    >
                      {isConfigured ? 'OK' : '—'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Card 7: Welcome Messages */}
          <div className="bg-dark-900/60 border border-dark-800 rounded-2xl p-5 backdrop-blur-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-pink-500/10 border border-pink-500/20 flex items-center justify-center text-pink-400">
                  <UserCheck className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">Приветственные сообщения (Welcome)</h3>
                  <p className="text-[11px] text-gray-400">Авто-сообщение в канал при входе игрока на сервер</p>
                </div>
              </div>
              <button
                onClick={() => handleDeploySpecificPanel('welcome', bindings.welcomeChannelId)}
                disabled={deployingPanel === 'welcome' || !bindings.welcomeChannelId}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-dark-800 hover:bg-pink-500/20 text-pink-400 border border-dark-700 hover:border-pink-500/40 rounded-xl text-xs font-medium transition-all disabled:opacity-50"
                title="Отправить тестовое приветствие"
              >
                <Send className="w-3 h-3" />
                {deployingPanel === 'welcome' ? 'Отправка...' : 'Тестовая отправка'}
              </button>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-dark-800/40 rounded-xl border border-dark-800">
                <div>
                  <span className="text-xs font-semibold text-white block">Включить отправку приветствий</span>
                  <span className="text-[11px] text-gray-400">Бот отправляет настроенный Embed новым участникам</span>
                </div>
                <input
                  type="checkbox"
                  checked={bindings.welcomeEnabled}
                  onChange={(e) => setBindings({ ...bindings, welcomeEnabled: e.target.checked })}
                  className="w-4 h-4 rounded text-pink-600 focus:ring-pink-500 bg-dark-800 border-dark-700 cursor-pointer"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1.5">Канал для приветствий</label>
                <select
                  value={bindings.welcomeChannelId}
                  onChange={(e) => setBindings({ ...bindings, welcomeChannelId: e.target.value })}
                  className="w-full bg-dark-800/80 border border-dark-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-pink-500 transition-colors"
                >
                  <option value="">Не выбран (выберите канал)...</option>
                  {textChannels.map((ch: any) => (
                    <option key={ch.id} value={ch.id}>
                      #{ch.name} (ID: {ch.id})
                    </option>
                  ))}
                </select>
              </div>

              <div className="text-[11px] text-gray-400 flex items-center justify-between pt-1">
                <span>Текст, цвет и переменные ({`{user}, {guild}`})</span>
                <a href="/messages" className="text-pink-400 hover:text-pink-300 underline inline-flex items-center gap-1 font-medium">
                  В модуль сообщений <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ServerSetup;
