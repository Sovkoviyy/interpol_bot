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
  UserCheck,
  MessageSquare,
  ExternalLink,
  Target,
  Check,
  ChevronRight,
  ChevronLeft,
  ShieldAlert,
  Plus,
  Search,
  Wand2,
  Info,
  Users
} from 'lucide-react';
import api from '../api/client';
import { useModal } from '../context/ModalContext';
import { RoleSelect, DiscordRoleItem } from '../components/RoleSelect';
import { ChannelSelect } from '../components/ChannelSelect';
import { CustomSelect } from '../components/CustomSelect';

type ActiveTab = 'wizard' | 'channels' | 'roles' | 'provision';

export const ServerSetup: React.FC = () => {
  const modal = useModal();
  const [guilds, setGuilds] = useState<any[]>([]);
  const [selectedGuildId, setSelectedGuildId] = useState<string>('');
  const [state, setState] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ActiveTab>('wizard');
  const [wizardStep, setWizardStep] = useState<number>(1);

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
    tierCategoryId: '',
    tierApplyChannelId: '',
    tierReviewChannelId: '',
    tierCheckerRoleId: '',
    welcomeChannelId: '',
    welcomeEnabled: true,
  });

  // Role bindings state - array of IDs for each role type (multi-select support)
  const [roleBindings, setRoleBindings] = useState<Record<string, string[]>>({
    recruiterRoleId: [],
    recruitApprovedRoleId: [],
    academicRoleId: [],
    promotedRoleId: [],
    tierCheckerRoleId: [],
    eventPriorityRoleId: [],
  });

  const [savingBindings, setSavingBindings] = useState(false);
  const [savingRoles, setSavingRoles] = useState(false);
  const [deployingPanel, setDeployingPanel] = useState<string | null>(null);
  const [provisioning, setProvisioning] = useState(false);
  const [deployPanelsCheck, setDeployPanelsCheck] = useState(true);
  const [autoDetecting, setAutoDetecting] = useState(false);

  // Inline Quick Create Role State
  const [creatingRoleKey, setCreatingRoleKey] = useState<string | null>(null);
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleColor, setNewRoleColor] = useState('#ec4899');
  const [isCreatingRole, setIsCreatingRole] = useState(false);

  // Inline Quick Create Channel State
  const [creatingChannelKey, setCreatingChannelKey] = useState<string | null>(null);
  const [newChannelName, setNewChannelName] = useState('');
  const [isCreatingChannel, setIsCreatingChannel] = useState(false);

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

  // Helper to normalize role IDs into array
  const toArray = (arr: any, single: any): string[] => {
    if (Array.isArray(arr) && arr.length > 0) return arr.map(String);
    if (single) return [String(single)];
    return [];
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
          tierCategoryId: res.data.bindings.tierCategoryId || '',
          tierApplyChannelId: res.data.bindings.tierApplyChannelId || '',
          tierReviewChannelId: res.data.bindings.tierReviewChannelId || '',
          tierCheckerRoleId: res.data.bindings.tierCheckerRoleId || '',
          welcomeChannelId: res.data.bindings.welcomeChannelId || '',
          welcomeEnabled: res.data.bindings.welcomeEnabled ?? true,
        });
      }
      if (res.data.roleBindings) {
        const rb = res.data.roleBindings;
        setRoleBindings({
          recruiterRoleId: toArray(rb.recruiterRoleIds, rb.recruiterRoleId),
          recruitApprovedRoleId: toArray(rb.recruitApprovedRoleIds, rb.recruitApprovedRoleId),
          academicRoleId: toArray(rb.academicRoleIds, rb.academicRoleId),
          promotedRoleId: toArray(rb.promotedRoleIds, rb.promotedRoleId),
          tierCheckerRoleId: toArray(rb.tierCheckerRoleIds, rb.tierCheckerRoleId),
          eventPriorityRoleId: toArray(rb.eventPriorityRoleIds, rb.eventPriorityRoleId),
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

  // 3. Auto-Detect bindings & roles by keyword
  const handleAutoDetect = async () => {
    try {
      setAutoDetecting(true);
      const res = await api.post('/setup/auto-detect', { guildId: selectedGuildId });
      const { rolesCount, channelsCount } = res.data;

      modal.alert({
        title: 'Авто-распознавание завершено',
        message: `Бот просканировал сервер и успешно сопоставил:\n\n• Ролей найдено: ${rolesCount}\n• Каналов найдено: ${channelsCount}\n\nВсе совпадения автоматически сохранены!`,
        type: 'success',
      });
      await fetchState(selectedGuildId);
    } catch (err: any) {
      modal.alert({
        title: 'Ошибка распознавания',
        message: err.response?.data?.error || 'Не удалось распознать структуру сервера',
        type: 'error',
      });
    } finally {
      setAutoDetecting(false);
    }
  };

  // 4. Save channel bindings
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
      await fetchState(selectedGuildId);
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

  // 5. Save role bindings
  const handleSaveRoles = async () => {
    try {
      setSavingRoles(true);
      await api.post('/setup/role-bindings', {
        guildId: selectedGuildId,
        roleBindings: {
          recruiterRoleIds: roleBindings.recruiterRoleId || [],
          recruiterRoleId: roleBindings.recruiterRoleId?.[0] || null,
          recruitApprovedRoleIds: roleBindings.recruitApprovedRoleId || [],
          recruitApprovedRoleId: roleBindings.recruitApprovedRoleId?.[0] || null,
          academicRoleIds: roleBindings.academicRoleId || [],
          academicRoleId: roleBindings.academicRoleId?.[0] || null,
          promotedRoleIds: roleBindings.promotedRoleId || [],
          promotedRoleId: roleBindings.promotedRoleId?.[0] || null,
          tierCheckerRoleIds: roleBindings.tierCheckerRoleId || [],
          tierCheckerRoleId: roleBindings.tierCheckerRoleId?.[0] || null,
          eventPriorityRoleIds: roleBindings.eventPriorityRoleId || [],
          eventPriorityRoleId: roleBindings.eventPriorityRoleId?.[0] || null,
        },
      });

      modal.alert({
        title: 'Успешно',
        message: 'Привязки ролей успешно сохранены в базе данных!',
        type: 'success',
      });
      await fetchState(selectedGuildId);
    } catch (err: any) {
      modal.alert({
        title: 'Ошибка сохранения',
        message: err.response?.data?.error || 'Не удалось сохранить роли',
        type: 'error',
      });
    } finally {
      setSavingRoles(false);
    }
  };

  // 6. Inline Create Role in Discord
  const handleQuickCreateRole = async (targetKey: string, defaultName: string, defaultColor: string) => {
    try {
      setIsCreatingRole(true);
      const name = newRoleName.trim() || defaultName;
      const res = await api.post('/setup/create-role', {
        guildId: selectedGuildId,
        name,
        color: newRoleColor || defaultColor,
        hoist: true,
      });

      const created = res.data.role;
      const currentList = roleBindings[targetKey] || [];
      const updatedList = [...currentList, created.id];
      const updatedRoles = { ...roleBindings, [targetKey]: updatedList };
      setRoleBindings(updatedRoles);

      await api.post('/setup/role-bindings', {
        guildId: selectedGuildId,
        roleBindings: {
          [`${targetKey}s`]: updatedList,
          [targetKey]: updatedList[0] || null,
        },
      });

      modal.alert({
        title: 'Роль создана в Discord!',
        message: `Роль «${created.name}» успешно создана на сервере Discord и добавлена в список!`,
        type: 'success',
      });

      setCreatingRoleKey(null);
      setNewRoleName('');
      await fetchState(selectedGuildId);
    } catch (err: any) {
      modal.alert({
        title: 'Ошибка создания роли',
        message: err.response?.data?.error || 'Не удалось создать роль в Discord',
        type: 'error',
      });
    } finally {
      setIsCreatingRole(false);
    }
  };

  // 7. Inline Create Channel in Discord
  const handleQuickCreateChannel = async (targetKey: string, defaultName: string, type: number, parentId?: string) => {
    try {
      setIsCreatingChannel(true);
      const name = newChannelName.trim() || defaultName;
      const res = await api.post('/setup/create-channel', {
        guildId: selectedGuildId,
        name,
        type,
        parentId,
      });

      const created = res.data.channel;
      const updatedBindings = { ...bindings, [targetKey]: created.id };
      setBindings(updatedBindings);
      await api.post('/setup/bindings', { guildId: selectedGuildId, bindings: updatedBindings });

      modal.alert({
        title: 'Канал создан в Discord!',
        message: `Канал «${created.name}» успешно создан на сервере Discord и привязан в конфигурации бота!`,
        type: 'success',
      });

      setCreatingChannelKey(null);
      setNewChannelName('');
      await fetchState(selectedGuildId);
    } catch (err: any) {
      modal.alert({
        title: 'Ошибка создания канала',
        message: err.response?.data?.error || 'Не удалось создать канал в Discord',
        type: 'error',
      });
    } finally {
      setIsCreatingChannel(false);
    }
  };

  // 8. Deploy / Re-deploy specific panel
  const handleDeploySpecificPanel = async (panelType: 'static' | 'leave' | 'recruit' | 'welcome' | 'logs' | 'tier', channelId?: string) => {
    try {
      setDeployingPanel(panelType);
      await api.post('/setup/deploy-panel', {
        guildId: selectedGuildId,
        panelType,
        channelId,
      });

      modal.alert({
        title: 'Панель опубликована!',
        message: 'Сообщение бота с интерактивными кнопками успешно отправлено в целевой канал!',
        type: 'success',
      });
      await fetchState(selectedGuildId);
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

  // 9. Full One-Click Provision
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
        `• Категорию «📹 ОТКАТЫ С МП» (#сдать-откат, #разбор-откатов)\n` +
        (deployPanelsCheck ? `• Авто-отправку всех интерактивных сообщений с кнопками\n\n` : `\n`) +
        `Если каналы с такими именами уже существуют, бот переиспользует их.`,
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
              `Все ID каналов сохранены в базу данных.`,
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

  const currentGuild = guilds.find((g) => g.id === selectedGuildId);
  const textChannels = (state?.channels || []).filter((c: any) => c.type === 0 || c.type === 'GUILD_TEXT');
  const voiceChannels = (state?.channels || []).filter((c: any) => c.type === 2 || c.type === 'GUILD_VOICE');
  const categories = (state?.channels || []).filter((c: any) => c.type === 4 || c.type === 'GUILD_CATEGORY');
  const roles: DiscordRoleItem[] = state?.roles || [];
  const botPerms = state?.botPermissions;

  // Calculate readiness percentage
  const totalChecks = 10;
  let passedChecks = 0;
  if (botPerms?.hasAdministrator || (botPerms?.manageRoles && botPerms?.manageChannels)) passedChecks++;
  if ((roleBindings.recruiterRoleId || []).length > 0) passedChecks++;
  if ((roleBindings.academicRoleId || []).length > 0) passedChecks++;
  if ((roleBindings.promotedRoleId || []).length > 0) passedChecks++;
  if (bindings.staticBindingChannelId) passedChecks++;
  if (bindings.leaveRequestChannelId) passedChecks++;
  if (bindings.recruitmentApplyChannelId) passedChecks++;
  if (bindings.academyCategoryId) passedChecks++;
  if (bindings.eventAnnounceChannelId) passedChecks++;
  if (state?.bindings?.messageLogsChannelId) passedChecks++;
  const readinessPercent = Math.round((passedChecks / totalChecks) * 100);

  // Required Roles Specification List
  const requiredRolesList = [
    {
      key: 'recruiterRoleId',
      name: 'Рекрутер',
      defaultName: '👔 Рекрутер',
      defaultColor: '#3b82f6',
      badge: 'Рекрутинг',
      desc: 'Доступ к управлению тикетами набора, проверке анкет и начислению выплат за приглашенных участников.',
    },
    {
      key: 'recruitApprovedRoleId',
      name: 'Одобренный рекрут / Участник',
      defaultName: '👥 Участник',
      defaultColor: '#10b981',
      badge: 'Семья',
      desc: 'Роль, автоматически выдаваемая игроку сразу после того, как рекрутер одобрил его анкету.',
    },
    {
      key: 'academicRoleId',
      name: 'Академик (1 ранг семьи)',
      defaultName: '🎓 Академик [1]',
      defaultColor: '#f59e0b',
      badge: 'Академия',
      desc: 'Начальный ранг новичка в семье. Бот следит за прогрессом курсанта и открывает каналы сдачи теории/практики.',
    },
    {
      key: 'promotedRoleId',
      name: 'Основной состав (2 ранг семьи)',
      defaultName: '⭐ Основной состав [2]',
      defaultColor: '#ec4899',
      badge: 'Повышение',
      desc: 'Полноправный член семьи. Автоматически выдается ботом при успешном завершении и сдаче Академии.',
    },
    {
      key: 'tierCheckerRoleId',
      name: 'Проверяющий откатов (Разбор ошибок)',
      defaultName: '🎯 Чекер откатов',
      defaultColor: '#8b5cf6',
      badge: 'Откаты с МП',
      desc: 'Опытный игрок / наставник стрельбы. Получает уведомления в Discord и делает разбор ошибок по присланным откатам.',
    },
  ];

  return (
    <div className="space-y-6 w-full">
      {/* Header & Server Selector */}
      <div className="bg-[#0B0E14] border border-[#1E232F] rounded-2xl p-6 backdrop-blur-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
              <Wand2 className="w-6 h-6 text-pink-500" />
              Первоначальная настройка бота на сервере
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Пошаговый мастер сопоставления каналов, создания ролей и проверки прав для готового сервера
            </p>
          </div>

          {/* Server Selector Dropdown */}
          <div className="flex items-center gap-3 bg-[#151921] border border-[#1E232F] p-2 rounded-xl">
            <Server className="w-4 h-4 text-pink-400 shrink-0 ml-1" />
            <div className="text-xs text-slate-400 shrink-0">Выбранный сервер:</div>
            <CustomSelect
              options={guilds.map((g) => ({
                value: g.id,
                label: g.name,
                sublabel: `${g.memberCount} участников`,
              }))}
              value={selectedGuildId}
              onChange={(val) => handleGuildChange(val)}
              placeholder="Выберите сервер..."
              className="w-64"
            />
          </div>
        </div>

        {/* Selected Guild Overview Card */}
        {currentGuild && (
          <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-[#151921]/60 border border-[#1E232F] rounded-xl">
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
                  <span className="text-[11px] font-mono text-slate-500 font-normal">ID: {currentGuild.id}</span>
                </div>
                <div className="text-xs text-slate-400">
                  Участников в Discord: <span className="text-slate-200 font-medium">{currentGuild.memberCount}</span> •
                  Каналов: <span className="text-slate-200 font-medium">{state?.channels?.length || 0}</span> •
                  Ролей: <span className="text-slate-200 font-medium">{roles.length}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Readiness Progress pill */}
              <div className="flex items-center gap-2 bg-[#0B0E14] border border-[#1E232F] px-3 py-1.5 rounded-xl">
                <span className="text-xs text-slate-400">Готовность к запуску:</span>
                <div className="w-20 bg-slate-800 rounded-full h-2 overflow-hidden">
                  <div 
                    className="bg-gradient-to-r from-pink-500 to-emerald-400 h-full rounded-full transition-all duration-500"
                    style={{ width: `${readinessPercent}%` }}
                  ></div>
                </div>
                <span className="text-xs font-bold text-pink-400 font-mono">{readinessPercent}%</span>
              </div>

              {botPerms?.hasAdministrator ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <ShieldCheck className="w-4 h-4" />
                  Администратор
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  <AlertTriangle className="w-4 h-4" />
                  Нет роли Администратора
                </span>
              )}

              <button
                onClick={handleAutoDetect}
                disabled={autoDetecting || loading}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 text-white rounded-xl text-xs font-semibold transition shadow-md shadow-pink-500/20 disabled:opacity-50"
                title="Автоматически найти существующие роли и каналы по названиям"
              >
                <Search className={`w-3.5 h-3.5 ${autoDetecting ? 'animate-spin' : ''}`} />
                {autoDetecting ? 'Сканирование...' : 'Авто-распознать всё'}
              </button>
            </div>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 border-b border-[#1E232F] pt-2">
          <button
            onClick={() => setActiveTab('wizard')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-xl transition-all border-b-2 ${
              activeTab === 'wizard'
                ? 'border-pink-500 text-pink-400 bg-pink-500/10'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-[#151921]'
            }`}
          >
            <Wand2 className="w-4 h-4" />
            <span>Мастер первоначальной настройки</span>
            <span className="px-1.5 py-0.5 rounded-md text-[10px] bg-pink-500/20 text-pink-300 font-mono">
              Шаг {wizardStep}/5
            </span>
          </button>

          <button
            onClick={() => setActiveTab('roles')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-xl transition-all border-b-2 ${
              activeTab === 'roles'
                ? 'border-pink-500 text-pink-400 bg-pink-500/10'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-[#151921]'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Роли семьи</span>
          </button>

          <button
            onClick={() => setActiveTab('channels')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-xl transition-all border-b-2 ${
              activeTab === 'channels'
                ? 'border-pink-500 text-pink-400 bg-pink-500/10'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-[#151921]'
            }`}
          >
            <FolderTree className="w-4 h-4" />
            <span>Каналы и Категории</span>
          </button>

          <button
            onClick={() => setActiveTab('provision')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-xl transition-all border-b-2 ${
              activeTab === 'provision'
                ? 'border-pink-500 text-pink-400 bg-pink-500/10'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-[#151921]'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>Авто-развертывание (Вайп/С нуля)</span>
          </button>
        </div>
      </div>

      {/* TAB 1: INITIAL SETUP WIZARD */}
      {activeTab === 'wizard' && (
        <div className="space-y-6">
          {/* Stepper Header */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            {[
              { num: 1, title: 'Роли в Discord', icon: Users },
              { num: 2, title: 'Каналы сервера', icon: FolderTree },
              { num: 3, title: 'Права и Иерархия', icon: ShieldCheck },
              { num: 4, title: 'Панели бота', icon: Send },
              { num: 5, title: 'Итог и Запуск', icon: CheckCircle2 },
            ].map((step) => {
              const Icon = step.icon;
              const isCurrent = wizardStep === step.num;
              const isDone = wizardStep > step.num;

              return (
                <button
                  key={step.num}
                  onClick={() => setWizardStep(step.num)}
                  className={`p-3 rounded-xl border text-left transition-all flex items-center gap-3 ${
                    isCurrent
                      ? 'bg-pink-500/10 border-pink-500/40 text-pink-400 shadow-md shadow-pink-500/10'
                      : isDone
                      ? 'bg-[#151921]/80 border-emerald-500/30 text-emerald-400'
                      : 'bg-[#0B0E14] border-[#1E232F] text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 font-bold text-xs ${
                      isCurrent
                        ? 'bg-pink-500 text-white shadow'
                        : isDone
                        ? 'bg-emerald-500 text-white'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {isDone ? <Check className="w-4 h-4" /> : step.num}
                  </div>
                  <div className="min-w-0">
                    <span className="text-[10px] text-slate-500 block uppercase font-mono font-bold">
                      Шаг {step.num}
                    </span>
                    <span className="text-xs font-semibold block truncate text-slate-200">
                      {step.title}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* STEP 1: DISCORD ROLES SETUP */}
          {wizardStep === 1 && (
            <div className="bg-[#0B0E14] border border-[#1E232F] rounded-2xl p-6 space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#1E232F] pb-5">
                <div>
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <Users className="w-5 h-5 text-pink-500" />
                    Шаг 1: Настройка ролей семьи в Discord
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Так как бот ставится на уже существующий сервер, сопоставьте свои существующие роли (можно выбрать несколько для каждого назначения) или создайте недостающие прямо отсюда в 1 клик.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleAutoDetect}
                    disabled={autoDetecting}
                    className="flex items-center gap-1.5 px-3 py-2 bg-[#151921] hover:bg-[#1E232F] text-slate-200 border border-slate-700 rounded-xl text-xs font-medium transition"
                  >
                    <Search className="w-3.5 h-3.5 text-pink-400" />
                    Авто-поиск по названию
                  </button>
                  <button
                    onClick={handleSaveRoles}
                    disabled={savingRoles}
                    className="flex items-center gap-1.5 px-4 py-2 bg-pink-600 hover:bg-pink-500 text-white rounded-xl text-xs font-semibold transition shadow-md shadow-pink-600/20"
                  >
                    <Save className="w-3.5 h-3.5" />
                    {savingRoles ? 'Сохранение...' : 'Сохранить роли'}
                  </button>
                </div>
              </div>

              {/* Roles Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {requiredRolesList.map((item) => {
                  const currentRoleIds = roleBindings[item.key] || [];
                  const isConfigured = currentRoleIds.length > 0;

                  return (
                    <div
                      key={item.key}
                      className={`p-4 rounded-xl border transition-all space-y-3 ${
                        isConfigured
                          ? 'bg-[#151921]/60 border-pink-500/30'
                          : 'bg-[#151921]/30 border-[#1E232F]'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-white">{item.name}</span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-pink-500/10 text-pink-400 border border-pink-500/20">
                              {item.badge}
                            </span>
                            {currentRoleIds.length > 1 && (
                              <span className="px-1.5 py-0.5 rounded-md text-[10px] font-mono bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                                {currentRoleIds.length} ролей
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                            {item.desc}
                          </p>
                        </div>
                        <span
                          className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${
                            isConfigured
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                          }`}
                        >
                          {isConfigured ? '✓' : '!'}
                        </span>
                      </div>

                      {/* Dropdown & Quick Create */}
                      <div className="space-y-2 pt-1">
                        <label className="block text-[11px] font-medium text-slate-300">
                          Выберите роли из списка Discord (поиск, цвета, мульти-выбор):
                        </label>

                        {/* Modern RoleSelect Component */}
                        <RoleSelect
                          roles={roles}
                          value={currentRoleIds}
                          onChange={(newIds) =>
                            setRoleBindings({ ...roleBindings, [item.key]: newIds })
                          }
                          isMulti={true}
                          placeholder={`Выберите роли ${item.name.toLowerCase()}...`}
                        />

                        {/* Inline Create Form / Trigger */}
                        {creatingRoleKey === item.key ? (
                          <div className="p-3 bg-[#0B0E14] border border-pink-500/30 rounded-xl space-y-2 animate-in fade-in duration-150">
                            <div className="text-[11px] font-semibold text-pink-400">
                              Создание роли в Discord:
                            </div>
                            <div className="flex gap-2">
                              <input
                                type="text"
                                placeholder={item.defaultName}
                                value={newRoleName}
                                onChange={(e) => setNewRoleName(e.target.value)}
                                className="flex-1 bg-[#151921] border border-[#1E232F] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-pink-500"
                              />
                              <input
                                type="color"
                                value={newRoleColor}
                                onChange={(e) => setNewRoleColor(e.target.value)}
                                className="w-9 h-8 rounded-lg bg-transparent border-0 cursor-pointer"
                                title="Цвет роли"
                              />
                            </div>
                            <div className="flex justify-end gap-2 pt-1">
                              <button
                                onClick={() => setCreatingRoleKey(null)}
                                className="px-2.5 py-1 text-[11px] text-slate-400 hover:text-white"
                              >
                                Отмена
                              </button>
                              <button
                                onClick={() =>
                                  handleQuickCreateRole(item.key, item.defaultName, item.defaultColor)
                                }
                                disabled={isCreatingRole}
                                className="px-3 py-1 bg-pink-600 hover:bg-pink-500 text-white rounded-lg text-[11px] font-semibold transition"
                              >
                                {isCreatingRole ? 'Создание...' : 'Создать в Discord'}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => {
                              setCreatingRoleKey(item.key);
                              setNewRoleName(item.defaultName);
                              setNewRoleColor(item.defaultColor);
                            }}
                            className="inline-flex items-center gap-1.5 text-[11px] text-pink-400 hover:text-pink-300 font-medium transition"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            Нет такой роли? Создать в 1 клик ({item.defaultName})
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Wizard Footer Nav */}
              <div className="flex justify-between items-center pt-4 border-t border-[#1E232F]">
                <span className="text-xs text-slate-400">
                  Сохраните роли перед переходом к следующему шагу.
                </span>
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      handleSaveRoles();
                      setWizardStep(2);
                    }}
                    className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 text-white rounded-xl text-xs font-bold transition shadow-lg shadow-pink-600/25"
                  >
                    <span>Далее: Каналы сервера</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: CHANNELS SETUP */}
          {wizardStep === 2 && (
            <div className="bg-[#0B0E14] border border-[#1E232F] rounded-2xl p-6 space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#1E232F] pb-5">
                <div>
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <FolderTree className="w-5 h-5 text-pink-500" />
                    Шаг 2: Назначение каналов и категорий
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Укажите, в какие каналы вашего Discord-сервера бот будет отправлять интерактивные сообщения, куда пересылать логи и где создавать тикеты.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleAutoDetect}
                    disabled={autoDetecting}
                    className="flex items-center gap-1.5 px-3 py-2 bg-[#151921] hover:bg-[#1E232F] text-slate-200 border border-slate-700 rounded-xl text-xs font-medium transition"
                  >
                    <Search className="w-3.5 h-3.5 text-pink-400" />
                    Авто-поиск каналов
                  </button>
                  <button
                    onClick={handleSaveBindings}
                    disabled={savingBindings}
                    className="flex items-center gap-1.5 px-4 py-2 bg-pink-600 hover:bg-pink-500 text-white rounded-xl text-xs font-semibold transition shadow-md shadow-pink-600/20"
                  >
                    <Save className="w-3.5 h-3.5" />
                    {savingBindings ? 'Сохранить каналы...' : 'Сохранить каналы'}
                  </button>
                </div>
              </div>

              {/* Channel Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 1. Static Binding */}
                <div className="p-4 bg-[#151921]/60 border border-[#1E232F] rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <IdCard className="w-4 h-4 text-pink-400" />
                      <span className="text-xs font-bold text-white">Канал привязки Static ID</span>
                    </div>
                    <span className="text-[10px] text-pink-400 font-mono">#привязка-статика</span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Здесь бот разместит кнопку «🆔 Привязать статик», через которую игроки вводят ник и статический ID персонажа.
                  </p>
                  <ChannelSelect
                    channels={state?.channels || []}
                    channelType="text"
                    value={bindings.staticBindingChannelId}
                    onChange={(val) => setBindings({ ...bindings, staticBindingChannelId: val })}
                    placeholder="Выберите текстовый канал..."
                  />
                  <button
                    onClick={() => handleQuickCreateChannel('staticBindingChannelId', 'привязка-статика', 0)}
                    className="inline-flex items-center gap-1 text-[11px] text-pink-400 hover:text-pink-300 font-medium"
                  >
                    <Plus className="w-3.5 h-3.5" /> Создать канал #привязка-статика в 1 клик
                  </button>
                </div>

                {/* 2. Leave Channel */}
                <div className="p-4 bg-[#151921]/60 border border-[#1E232F] rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CalendarOff className="w-4 h-4 text-amber-400" />
                      <span className="text-xs font-bold text-white">Канал отпусков и неактива</span>
                    </div>
                    <span className="text-[10px] text-amber-400 font-mono">#отпуска-неактив</span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Канал с кнопкой «🏖️ Подать на отпуск» для фиксации дат отсутствия членов семьи.
                  </p>
                  <ChannelSelect
                    channels={state?.channels || []}
                    channelType="text"
                    value={bindings.leaveRequestChannelId}
                    onChange={(val) => setBindings({ ...bindings, leaveRequestChannelId: val })}
                    placeholder="Выберите текстовый канал..."
                  />
                  <button
                    onClick={() => handleQuickCreateChannel('leaveRequestChannelId', 'отпуска-неактив', 0)}
                    className="inline-flex items-center gap-1 text-[11px] text-amber-400 hover:text-amber-300 font-medium"
                  >
                    <Plus className="w-3.5 h-3.5" /> Создать канал #отпуска-неактив в 1 клик
                  </button>
                </div>

                {/* 3. Recruitment Apply Channel */}
                <div className="p-4 bg-[#151921]/60 border border-[#1E232F] rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <UserPlus className="w-4 h-4 text-blue-400" />
                      <span className="text-xs font-bold text-white">Канал подачи заявок в семью</span>
                    </div>
                    <span className="text-[10px] text-blue-400 font-mono">#подать-заявку</span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Канал, видимый гостям сервера с кнопкой «📝 Подать заявку в семью».
                  </p>
                  <ChannelSelect
                    channels={state?.channels || []}
                    channelType="text"
                    value={bindings.recruitmentApplyChannelId}
                    onChange={(val) => setBindings({ ...bindings, recruitmentApplyChannelId: val })}
                    placeholder="Выберите текстовый канал..."
                  />
                  <button
                    onClick={() => handleQuickCreateChannel('recruitmentApplyChannelId', 'подать-заявку', 0)}
                    className="inline-flex items-center gap-1 text-[11px] text-blue-400 hover:text-blue-300 font-medium"
                  >
                    <Plus className="w-3.5 h-3.5" /> Создать канал #подать-заявку в 1 клик
                  </button>
                </div>

                {/* 4. Recruitment Tickets Category */}
                <div className="p-4 bg-[#151921]/60 border border-[#1E232F] rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Layers className="w-4 h-4 text-blue-400" />
                      <span className="text-xs font-bold text-white">Категория тикетов набора</span>
                    </div>
                    <span className="text-[10px] text-blue-400 font-mono">📥 НАБОР В СЕМЬЮ</span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Категория Discord, внутри которой бот автоматически создает приватные каналы тикетов кандидатов.
                  </p>
                  <ChannelSelect
                    channels={state?.channels || []}
                    channelType="category"
                    value={bindings.recruitmentReviewChannelId}
                    onChange={(val) => setBindings({ ...bindings, recruitmentReviewChannelId: val })}
                    placeholder="Выберите категорию..."
                  />
                  <button
                    onClick={() => handleQuickCreateChannel('recruitmentReviewChannelId', '📥 НАБОР В СЕМЬЮ', 4)}
                    className="inline-flex items-center gap-1 text-[11px] text-blue-400 hover:text-blue-300 font-medium"
                  >
                    <Plus className="w-3.5 h-3.5" /> Создать категорию набора в 1 клик
                  </button>
                </div>

                {/* 5. Academy Category */}
                <div className="p-4 bg-[#151921]/60 border border-[#1E232F] rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <GraduationCap className="w-4 h-4 text-fuchsia-400" />
                      <span className="text-xs font-bold text-white">Категория тикетов Академии</span>
                    </div>
                    <span className="text-[10px] text-fuchsia-400 font-mono">🎓 ACADEMY</span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Категория для тикетов сдачи экзаменов новичков (1 ранг) перед менторами.
                  </p>
                  <ChannelSelect
                    channels={state?.channels || []}
                    channelType="category"
                    value={bindings.academyCategoryId}
                    onChange={(val) => setBindings({ ...bindings, academyCategoryId: val })}
                    placeholder="Выберите категорию..."
                  />
                  <button
                    onClick={() => handleQuickCreateChannel('academyCategoryId', '🎓 ACADEMY', 4)}
                    className="inline-flex items-center gap-1 text-[11px] text-fuchsia-400 hover:text-fuchsia-300 font-medium"
                  >
                    <Plus className="w-3.5 h-3.5" /> Создать категорию Академии в 1 клик
                  </button>
                </div>

                {/* 6. Events Announce Channel */}
                <div className="p-4 bg-[#151921]/60 border border-[#1E232F] rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CalendarDays className="w-4 h-4 text-rose-400" />
                      <span className="text-xs font-bold text-white">Канал сборов на Мероприятия (МП)</span>
                    </div>
                    <span className="text-[10px] text-rose-400 font-mono">#сборы-на-мп</span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Канал, куда бот публикует карточки сборов с таймером и кнопками «✅ Буду / ❌ Не смогу».
                  </p>
                  <ChannelSelect
                    channels={state?.channels || []}
                    channelType="text"
                    value={bindings.eventAnnounceChannelId}
                    onChange={(val) => setBindings({ ...bindings, eventAnnounceChannelId: val })}
                    placeholder="Выберите текстовый канал..."
                  />
                  <button
                    onClick={() => handleQuickCreateChannel('eventAnnounceChannelId', 'сборы-на-мп', 0)}
                    className="inline-flex items-center gap-1 text-[11px] text-rose-400 hover:text-rose-300 font-medium"
                  >
                    <Plus className="w-3.5 h-3.5" /> Создать канал #сборы-на-мп в 1 клик
                  </button>
                </div>
              </div>

              {/* Wizard Footer Nav */}
              <div className="flex justify-between items-center pt-4 border-t border-[#1E232F]">
                <button
                  onClick={() => setWizardStep(1)}
                  className="flex items-center gap-2 px-4 py-2.5 bg-[#151921] hover:bg-[#1E232F] text-slate-300 rounded-xl text-xs font-medium transition"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Назад: Роли семьи</span>
                </button>
                <button
                  onClick={() => {
                    handleSaveBindings();
                    setWizardStep(3);
                  }}
                  className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 text-white rounded-xl text-xs font-bold transition shadow-lg shadow-pink-600/25"
                >
                  <span>Далее: Права и Иерархия</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: BOT PERMISSIONS & HIERARCHY CHECK */}
          {wizardStep === 3 && (
            <div className="bg-[#0B0E14] border border-[#1E232F] rounded-2xl p-6 space-y-6">
              <div className="border-b border-[#1E232F] pb-5">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-400" />
                  Шаг 3: Диагностика прав и иерархии ролей бота
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Discord требует строгого соблюдения прав и позиции роли бота в списке ролей сервера.
                </p>
              </div>

              {/* Bot Hierarchy Warning Box */}
              <div className="p-4 rounded-xl bg-pink-500/10 border border-pink-500/30 space-y-2">
                <div className="flex items-center gap-2 text-pink-400 font-bold text-xs">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  КРИТИЧЕСКИ ВАЖНО: Иерархия ролей в Discord
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  В Discord бот <strong>не может выдавать или забирать роли</strong>, которые находятся <strong>выше</strong> его собственной наивысшей роли в списке ролей сервера!
                </p>
                <div className="p-3 bg-[#0B0E14]/80 rounded-lg text-xs font-mono text-slate-300 space-y-1 border border-pink-500/20">
                  <div>1. Откройте в Discord: <strong>Настройки сервера ➔ Роли</strong></div>
                  <div>2. Зажмите мышкой роль бота (<strong>{botPerms?.botHighestRoleName || 'INTERPOL BOT'}</strong>)</div>
                  <div>3. Перетащите её <strong>ВЫШЕ</strong> всех ролей семьи: «Рекрутер», «Академик», «Основной состав», «Капт состав»</div>
                  <div className="text-emerald-400 font-semibold pt-1">
                    ✓ Текущая высшая роль бота: «{botPerms?.botHighestRoleName || 'Bot'}» (позиция {botPerms?.botRolePosition || 0})
                  </div>
                </div>
              </div>

              {/* Permissions Checklist */}
              <div className="space-y-3">
                <div className="text-xs font-bold text-white uppercase tracking-wider text-slate-400">
                  Чеклист прав бота на сервере
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    {
                      name: 'Права Администратора (Administrator)',
                      desc: 'Рекомендуется для 100% стабильной работы всех модулей',
                      ok: botPerms?.hasAdministrator,
                    },
                    {
                      name: 'Управление ролями (Manage Roles)',
                      desc: 'Необходимо для выдачи Академика, 2 ранга и ролей ЧС',
                      ok: botPerms?.manageRoles || botPerms?.hasAdministrator,
                    },
                    {
                      name: 'Управление каналами (Manage Channels)',
                      desc: 'Необходимо для авто-создания тикетов набора и академии',
                      ok: botPerms?.manageChannels || botPerms?.hasAdministrator,
                    },
                    {
                      name: 'Управление никнеймами (Manage Nicknames)',
                      desc: 'Необходимо для авто-смены ников по статическому ID',
                      ok: botPerms?.manageNicknames || botPerms?.hasAdministrator,
                    },
                    {
                      name: 'Отправка сообщений (Send Messages)',
                      desc: 'Базовое право отправки сообщений в каналы',
                      ok: botPerms?.sendMessages || botPerms?.hasAdministrator,
                    },
                    {
                      name: 'Встраивание ссылок (Embed Links)',
                      desc: 'Необходимо для красивых Embed карточек и панелей',
                      ok: botPerms?.embedLinks || botPerms?.hasAdministrator,
                    },
                  ].map((perm, idx) => (
                    <div
                      key={idx}
                      className="p-3.5 rounded-xl bg-[#151921]/60 border border-[#1E232F] flex items-start justify-between gap-3"
                    >
                      <div className="space-y-1">
                        <span className="text-xs font-semibold text-white block">{perm.name}</span>
                        <span className="text-[11px] text-slate-400 block">{perm.desc}</span>
                      </div>
                      <span
                        className={`px-2.5 py-1 rounded-full text-xs font-bold shrink-0 ${
                          perm.ok
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-red-500/10 text-red-400 border border-red-500/20'
                        }`}
                      >
                        {perm.ok ? '✓ Активно' : '✕ Отсутствует'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Wizard Footer Nav */}
              <div className="flex justify-between items-center pt-4 border-t border-[#1E232F]">
                <button
                  onClick={() => setWizardStep(2)}
                  className="flex items-center gap-2 px-4 py-2.5 bg-[#151921] hover:bg-[#1E232F] text-slate-300 rounded-xl text-xs font-medium transition"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Назад: Каналы сервера</span>
                </button>
                <div className="flex gap-2">
                  <button
                    onClick={() => fetchState(selectedGuildId)}
                    className="flex items-center gap-1.5 px-3 py-2 bg-[#151921] hover:bg-[#1E232F] text-slate-300 rounded-xl text-xs font-medium transition"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Перепроверить права
                  </button>
                  <button
                    onClick={() => setWizardStep(4)}
                    className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 text-white rounded-xl text-xs font-bold transition shadow-lg shadow-pink-600/25"
                  >
                    <span>Далее: Развертывание панелей</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: DEPLOY INTERACTIVE PANELS */}
          {wizardStep === 4 && (
            <div className="bg-[#0B0E14] border border-[#1E232F] rounded-2xl p-6 space-y-6">
              <div className="border-b border-[#1E232F] pb-5">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Send className="w-5 h-5 text-pink-500" />
                  Шаг 4: Публикация интерактивных панелей бота в каналах
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Отправьте готовые красивые Embed сообщения с кнопками в привязанные каналы вашего сервера.
                </p>
              </div>

              {/* Panels Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Panel 1 */}
                <div className="p-4 bg-[#151921]/60 border border-[#1E232F] rounded-xl flex items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <IdCard className="w-4 h-4 text-pink-400" />
                      <span className="text-xs font-bold text-white">Панель привязки Static ID</span>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Канал: {bindings.staticBindingChannelId ? `#${textChannels.find((c: any) => c.id === bindings.staticBindingChannelId)?.name || bindings.staticBindingChannelId}` : 'не привязан'}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDeploySpecificPanel('static', bindings.staticBindingChannelId)}
                    disabled={deployingPanel === 'static' || !bindings.staticBindingChannelId}
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-pink-600 hover:bg-pink-500 text-white rounded-xl text-xs font-semibold transition disabled:opacity-40 shrink-0"
                  >
                    <Send className="w-3.5 h-3.5" />
                    {deployingPanel === 'static' ? 'Отправка...' : 'Отправить в канал'}
                  </button>
                </div>

                {/* Panel 2 */}
                <div className="p-4 bg-[#151921]/60 border border-[#1E232F] rounded-xl flex items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <CalendarOff className="w-4 h-4 text-amber-400" />
                      <span className="text-xs font-bold text-white">Панель подачи заявок на отпуск</span>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Канал: {bindings.leaveRequestChannelId ? `#${textChannels.find((c: any) => c.id === bindings.leaveRequestChannelId)?.name || bindings.leaveRequestChannelId}` : 'не привязан'}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDeploySpecificPanel('leave', bindings.leaveRequestChannelId)}
                    disabled={deployingPanel === 'leave' || !bindings.leaveRequestChannelId}
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-semibold transition disabled:opacity-40 shrink-0"
                  >
                    <Send className="w-3.5 h-3.5" />
                    {deployingPanel === 'leave' ? 'Отправка...' : 'Отправить в канал'}
                  </button>
                </div>

                {/* Panel 3 */}
                <div className="p-4 bg-[#151921]/60 border border-[#1E232F] rounded-xl flex items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <UserPlus className="w-4 h-4 text-blue-400" />
                      <span className="text-xs font-bold text-white">Панель набора в семью</span>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Канал: {bindings.recruitmentApplyChannelId ? `#${textChannels.find((c: any) => c.id === bindings.recruitmentApplyChannelId)?.name || bindings.recruitmentApplyChannelId}` : 'не привязан'}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDeploySpecificPanel('recruit', bindings.recruitmentApplyChannelId)}
                    disabled={deployingPanel === 'recruit' || !bindings.recruitmentApplyChannelId}
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold transition disabled:opacity-40 shrink-0"
                  >
                    <Send className="w-3.5 h-3.5" />
                    {deployingPanel === 'recruit' ? 'Отправка...' : 'Отправить в канал'}
                  </button>
                </div>

                {/* Panel 4 */}
                <div className="p-4 bg-[#151921]/60 border border-[#1E232F] rounded-xl flex items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Target className="w-4 h-4 text-fuchsia-400" />
                      <span className="text-xs font-bold text-white">Панель сдачи откатов с МП</span>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Канал: {bindings.tierApplyChannelId ? `#${textChannels.find((c: any) => c.id === bindings.tierApplyChannelId)?.name || bindings.tierApplyChannelId}` : 'не привязан'}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDeploySpecificPanel('tier', bindings.tierApplyChannelId)}
                    disabled={deployingPanel === 'tier' || !bindings.tierApplyChannelId}
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-fuchsia-600 hover:bg-fuchsia-500 text-white rounded-xl text-xs font-semibold transition disabled:opacity-40 shrink-0"
                  >
                    <Send className="w-3.5 h-3.5" />
                    {deployingPanel === 'tier' ? 'Отправка...' : 'Отправить в канал'}
                  </button>
                </div>
              </div>

              {/* Wizard Footer Nav */}
              <div className="flex justify-between items-center pt-4 border-t border-[#1E232F]">
                <button
                  onClick={() => setWizardStep(3)}
                  className="flex items-center gap-2 px-4 py-2.5 bg-[#151921] hover:bg-[#1E232F] text-slate-300 rounded-xl text-xs font-medium transition"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Назад: Права бота</span>
                </button>
                <button
                  onClick={() => setWizardStep(5)}
                  className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 text-white rounded-xl text-xs font-bold transition shadow-lg shadow-pink-600/25"
                >
                  <span>Далее: Завершение и Итог</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 5: FINAL READINESS & LAUNCH */}
          {wizardStep === 5 && (
            <div className="bg-[#0B0E14] border border-[#1E232F] rounded-2xl p-6 space-y-6">
              <div className="text-center max-w-xl mx-auto space-y-3 py-4">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-pink-600 via-rose-500 to-emerald-400 flex items-center justify-center mx-auto shadow-xl shadow-pink-500/20">
                  <CheckCircle2 className="w-8 h-8 text-white" />
                </div>
                <h2 className="text-xl font-bold text-white">
                  {readinessPercent >= 70 ? 'Сервер готов к работе!' : 'Настройка почти завершена'}
                </h2>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Бот INTERPOL BOT подключен к серверу «{currentGuild?.name}». Проверьте статус готовности ключевых модулей ниже:
                </p>

                <div className="inline-flex items-center gap-2 bg-[#151921] border border-[#1E232F] px-4 py-2 rounded-xl">
                  <span className="text-xs text-slate-300">Общий показатель готовности:</span>
                  <span className="text-base font-bold text-pink-400 font-mono">{readinessPercent}%</span>
                </div>
              </div>

              {/* Status Checklist Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="p-4 bg-[#151921]/60 border border-[#1E232F] rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white">Роли семьи</span>
                    <span className="text-xs font-mono text-pink-400">
                      {(roleBindings.recruiterRoleId || []).length > 0 && (roleBindings.academicRoleId || []).length > 0 ? '✓ Настроены' : '! Не все'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Рекрутер, Академик 1 ранг и Основной состав 2 ранг привязаны в системе.
                  </p>
                </div>

                <div className="p-4 bg-[#151921]/60 border border-[#1E232F] rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white">Каналы модулей</span>
                    <span className="text-xs font-mono text-pink-400">
                      {bindings.staticBindingChannelId && bindings.recruitmentApplyChannelId ? '✓ Настроены' : '! Не все'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Привязка статика, отпуска, набор и сборы на мероприятия распределены по каналам.
                  </p>
                </div>

                <div className="p-4 bg-[#151921]/60 border border-[#1E232F] rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white">Права бота</span>
                    <span className="text-xs font-mono text-emerald-400">
                      {botPerms?.hasAdministrator ? '✓ Администратор' : '✓ Базовые'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Иерархия ролей и доступ к отправке сообщений проверены.
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap justify-center gap-4 pt-4 border-t border-[#1E232F]">
                <a
                  href="/members"
                  className="px-6 py-3 bg-pink-600 hover:bg-pink-500 text-white rounded-xl text-xs font-bold transition shadow-lg shadow-pink-600/25 flex items-center gap-2"
                >
                  <Users className="w-4 h-4" />
                  Перейти к списку участников сервера
                </a>
                <a
                  href="/messages"
                  className="px-6 py-3 bg-[#151921] hover:bg-[#1E232F] text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold transition flex items-center gap-2"
                >
                  <MessageSquare className="w-4 h-4 text-pink-400" />
                  Кастомизировать тексты сообщений бота
                </a>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: DETAILED ROLES TAB */}
      {activeTab === 'roles' && (
        <div className="bg-[#0B0E14] border border-[#1E232F] rounded-2xl p-6 space-y-6">
          <div className="flex items-center justify-between border-b border-[#1E232F] pb-4">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-pink-500" />
                Все роли семьи в Discord
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Управление ролями для автоматических повышений, набора, академии и тиров с поддержкой мульти-выбора
              </p>
            </div>
            <button
              onClick={handleSaveRoles}
              disabled={savingRoles}
              className="flex items-center gap-2 px-4 py-2 bg-pink-600 hover:bg-pink-500 text-white rounded-xl text-xs font-semibold transition shadow-md shadow-pink-600/20 disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              {savingRoles ? 'Сохранение...' : 'Сохранить все роли'}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {requiredRolesList.map((item) => {
              const currentRoleIds = roleBindings[item.key] || [];
              return (
                <div key={item.key} className="p-4 bg-[#151921]/60 border border-[#1E232F] rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white">{item.name}</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-pink-500/10 text-pink-400 border border-pink-500/20">
                      {item.badge}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400">{item.desc}</p>
                  
                  <RoleSelect
                    roles={roles}
                    value={currentRoleIds}
                    onChange={(newIds) =>
                      setRoleBindings({ ...roleBindings, [item.key]: newIds })
                    }
                    isMulti={true}
                    placeholder={`Выберите роли ${item.name.toLowerCase()}...`}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 3: CHANNELS & CATEGORIES FULL VIEW */}
      {activeTab === 'channels' && (
        <div className="bg-[#0B0E14] border border-[#1E232F] rounded-2xl p-6 space-y-6">
          <div className="flex items-center justify-between border-b border-[#1E232F] pb-4">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <FolderTree className="w-5 h-5 text-pink-500" />
                Все каналы и категории сервера
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Детальная привязка каналов для всех подсистем бота
              </p>
            </div>
            <button
              onClick={handleSaveBindings}
              disabled={savingBindings}
              className="flex items-center gap-2 px-4 py-2 bg-pink-600 hover:bg-pink-500 text-white rounded-xl text-xs font-semibold transition shadow-md shadow-pink-600/20 disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              {savingBindings ? 'Сохранение...' : 'Сохранить привязки'}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Card 1: Static Binding */}
            <div className="p-4 bg-[#151921]/60 border border-[#1E232F] rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white">Привязка Static ID</span>
                <button
                  onClick={() => handleDeploySpecificPanel('static', bindings.staticBindingChannelId)}
                  disabled={!bindings.staticBindingChannelId}
                  className="text-[11px] text-pink-400 hover:text-pink-300 font-medium"
                >
                  Отправить панель
                </button>
              </div>
              <ChannelSelect
                channels={state?.channels || []}
                channelType="text"
                value={bindings.staticBindingChannelId}
                onChange={(val) => setBindings({ ...bindings, staticBindingChannelId: val })}
                placeholder="Выберите текстовый канал..."
              />
            </div>

            {/* Card 2: Leaves */}
            <div className="p-4 bg-[#151921]/60 border border-[#1E232F] rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white">Заявки на отпуск</span>
                <button
                  onClick={() => handleDeploySpecificPanel('leave', bindings.leaveRequestChannelId)}
                  disabled={!bindings.leaveRequestChannelId}
                  className="text-[11px] text-amber-400 hover:text-amber-300 font-medium"
                >
                  Отправить панель
                </button>
              </div>
              <ChannelSelect
                channels={state?.channels || []}
                channelType="text"
                value={bindings.leaveRequestChannelId}
                onChange={(val) => setBindings({ ...bindings, leaveRequestChannelId: val })}
                placeholder="Выберите текстовый канал..."
              />
            </div>

            {/* Card 3: Recruitment */}
            <div className="p-4 bg-[#151921]/60 border border-[#1E232F] rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white">Канал подачи анкет набора</span>
                <button
                  onClick={() => handleDeploySpecificPanel('recruit', bindings.recruitmentApplyChannelId)}
                  disabled={!bindings.recruitmentApplyChannelId}
                  className="text-[11px] text-blue-400 hover:text-blue-300 font-medium"
                >
                  Отправить панель
                </button>
              </div>
              <ChannelSelect
                channels={state?.channels || []}
                channelType="text"
                value={bindings.recruitmentApplyChannelId}
                onChange={(val) => setBindings({ ...bindings, recruitmentApplyChannelId: val })}
                placeholder="Выберите текстовый канал..."
              />
            </div>

            {/* Card 4: Welcome */}
            <div className="p-4 bg-[#151921]/60 border border-[#1E232F] rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white">Канал приветствий (Welcome)</span>
                <button
                  onClick={() => handleDeploySpecificPanel('welcome', bindings.welcomeChannelId)}
                  disabled={!bindings.welcomeChannelId}
                  className="text-[11px] text-pink-400 hover:text-pink-300 font-medium"
                >
                  Тест отправка
                </button>
              </div>
              <ChannelSelect
                channels={state?.channels || []}
                channelType="text"
                value={bindings.welcomeChannelId}
                onChange={(val) => setBindings({ ...bindings, welcomeChannelId: val })}
                placeholder="Выберите текстовый канал..."
              />
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: QUICK PROVISIONING (FOR EMPTY SERVERS) */}
      {activeTab === 'provision' && (
        <div className="relative overflow-hidden bg-gradient-to-br from-pink-950/30 via-[#0B0E14] to-[#0B0E14] border border-pink-500/30 rounded-2xl p-6 backdrop-blur-sm shadow-xl">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 relative z-10">
            <div className="space-y-2 max-w-2xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-pink-500/20 text-pink-400 border border-pink-500/30">
                <Sparkles className="w-3.5 h-3.5" />
                Авто-развертывание с нуля
              </div>
              <h2 className="text-lg font-bold text-white">
                Создать всю структуру каналов, категорий и сообщений в 1 клик
              </h2>
              <p className="text-xs text-slate-300 leading-relaxed">
                Используйте эту функцию, если вы создали пустой сервер Discord. Бот автоматически сформирует все категории (Информация, Набор, Академия, Тиры, МП, Логи), настроит каналы и отправит рабочие кнопки.
              </p>
              <div className="pt-2 flex items-center gap-2">
                <input
                  type="checkbox"
                  id="deployPanels"
                  checked={deployPanelsCheck}
                  onChange={(e) => setDeployPanelsCheck(e.target.checked)}
                  className="w-4 h-4 rounded text-pink-600 focus:ring-pink-500 bg-[#151921] border-slate-700 cursor-pointer"
                />
                <label htmlFor="deployPanels" className="text-xs text-slate-300 cursor-pointer">
                  Сразу опубликовать интерактивные кнопки в каналы (привязка статика, отпуска, набор)
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
      )}
    </div>
  );
};

export default ServerSetup;
