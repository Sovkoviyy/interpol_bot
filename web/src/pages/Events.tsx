import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { 
  CalendarDays, 
  Plus, 
  Users, 
  Clock, 
  Mic, 
  Key, 
  ShieldAlert, 
  UserMinus, 
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ArrowUp,
  ArrowDown,
  Scale,
  Trash2,
  Info,
  Sparkles,
  HelpCircle,
  X
} from 'lucide-react';
import api from '../api/client';
import { useModal } from '../context/ModalContext';
import { ChannelSelect } from '../components/ChannelSelect';
import { RoleSelect } from '../components/RoleSelect';
import { CustomSelect } from '../components/CustomSelect';

export interface RoleHierarchyEntry {
  roleId: string;
  roleName?: string;
  priority: number;
}

export const Events: React.FC = () => {
  const modal = useModal();
  const [events, setEvents] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [channels, setChannels] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState('ACTIVE');
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  const [mainTab, setMainTab] = useState<'events' | 'prioritySettings'>('events');
  const [priorityConfig, setPriorityConfig] = useState<{
    eventPriorityRoleId: string;
    eventPriorityMinRank: number;
    eventRoleHierarchy: RoleHierarchyEntry[];
  }>({
    eventPriorityRoleId: '',
    eventPriorityMinRank: 0,
    eventRoleHierarchy: [],
  });
  const [savingPriority, setSavingPriority] = useState(false);

  // New role adder state
  const [selectedNewRole, setSelectedNewRole] = useState('');
  const [selectedNewPriority, setSelectedNewPriority] = useState(100);

  // New Event Form State
  const [form, setForm] = useState({
    title: 'Капт',
    description: '',
    type: 'LIMITED',
    checkInTime: '',
    eventTime: '',
    partyCode: '',
    voiceChannelId: '',
    targetRoleId: '',
    channelId: '',
    participantLimit: 10,
    pingIntervals: [15, 10, 5, 3, 1],
  });

  const [defaultSettings, setDefaultSettings] = useState<any>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [eventsRes, rolesRes, channelsRes, defaultsRes, cfgRes] = await Promise.all([
        api.get(`/events?status=${statusFilter}`),
        api.get('/guild/roles'),
        api.get('/guild/channels'),
        api.get('/events/defaults').catch(() => ({ data: {} })),
        api.get('/events/config').catch(() => ({ data: { eventPriorityRoleId: '', eventPriorityMinRank: 0, eventRoleHierarchy: [] } })),
      ]);
      setEvents(eventsRes.data.events);
      setRoles(rolesRes.data.roles);
      setChannels(channelsRes.data.channels);
      if (cfgRes.data) {
        setPriorityConfig({
          eventPriorityRoleId: cfgRes.data.eventPriorityRoleId || '',
          eventPriorityMinRank: cfgRes.data.eventPriorityMinRank || 0,
          eventRoleHierarchy: cfgRes.data.eventRoleHierarchy || [],
        });
      }
      if (defaultsRes.data) {
        setDefaultSettings(defaultsRes.data);
        setForm(prev => ({
          ...prev,
          channelId: prev.channelId || defaultsRes.data.channelId || '',
          voiceChannelId: prev.voiceChannelId || defaultsRes.data.voiceChannelId || '',
          targetRoleId: prev.targetRoleId || defaultsRes.data.targetRoleId || '',
        }));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSavePriorityConfig = async () => {
    try {
      setSavingPriority(true);
      await api.post('/events/config', priorityConfig);
      modal.alert({
        title: 'Успешно',
        message: 'Настройки иерархии ролей и приоритетов сборов успешно сохранены!',
        type: 'success',
      });
    } catch (err: any) {
      modal.alert({
        title: 'Ошибка',
        message: err.response?.data?.error || 'Не удалось сохранить настройки',
        type: 'error',
      });
    } finally {
      setSavingPriority(false);
    }
  };

  const addRoleToHierarchy = () => {
    if (!selectedNewRole) return;
    const foundRole = roles.find(r => r.id === selectedNewRole);
    if (!foundRole) return;

    if (priorityConfig.eventRoleHierarchy.some(r => r.roleId === selectedNewRole)) {
      modal.alert({ title: 'Внимание', message: 'Эта роль уже добавлена в иерархию', type: 'warning' });
      return;
    }

    const newHierarchy = [
      ...priorityConfig.eventRoleHierarchy,
      {
        roleId: selectedNewRole,
        roleName: foundRole.name,
        priority: selectedNewPriority,
      },
    ];

    // Keep sorted by priority descending
    newHierarchy.sort((a, b) => b.priority - a.priority);

    setPriorityConfig(prev => ({
      ...prev,
      eventRoleHierarchy: newHierarchy,
    }));
    setSelectedNewRole('');
  };

  const removeRoleFromHierarchy = (roleId: string) => {
    setPriorityConfig(prev => ({
      ...prev,
      eventRoleHierarchy: prev.eventRoleHierarchy.filter(r => r.roleId !== roleId),
    }));
  };

  const moveRoleHierarchyItem = (index: number, direction: 'up' | 'down') => {
    const list = [...priorityConfig.eventRoleHierarchy];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= list.length) return;

    const temp = list[index];
    list[index] = list[targetIndex];
    list[targetIndex] = temp;

    // Recalculate descending priorities to preserve visual order
    for (let i = 0; i < list.length; i++) {
      list[i].priority = Math.max(10, 100 - i * 10);
    }

    setPriorityConfig(prev => ({
      ...prev,
      eventRoleHierarchy: list,
    }));
  };

  const updateRolePriorityValue = (roleId: string, priorityVal: number) => {
    const list = priorityConfig.eventRoleHierarchy.map(r => 
      r.roleId === roleId ? { ...r, priority: priorityVal } : r
    );
    setPriorityConfig(prev => ({
      ...prev,
      eventRoleHierarchy: list,
    }));
  };

  const setQuickDate = (daysAhead: number) => {
    const target = new Date();
    target.setDate(target.getDate() + daysAhead);
    const yyyy = target.getFullYear();
    const mm = String(target.getMonth() + 1).padStart(2, '0');
    const dd = String(target.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}-${mm}-${dd}`;
    
    setForm(prev => ({
      ...prev,
      eventTime: `${dateStr}T20:00`,
      checkInTime: `${dateStr}T19:50`,
    }));
  };

  const handleEventTimeChange = (val: string) => {
    const eventDate = new Date(val);
    if (!isNaN(eventDate.getTime())) {
      const checkinDate = new Date(eventDate.getTime() - 10 * 60000);
      const yyyy = checkinDate.getFullYear();
      const mm = String(checkinDate.getMonth() + 1).padStart(2, '0');
      const dd = String(checkinDate.getDate()).padStart(2, '0');
      const hh = String(checkinDate.getHours()).padStart(2, '0');
      const min = String(checkinDate.getMinutes()).padStart(2, '0');
      setForm(prev => ({
        ...prev,
        eventTime: val,
        checkInTime: `${yyyy}-${mm}-${dd}T${hh}:${min}`,
      }));
    } else {
      setForm(prev => ({ ...prev, eventTime: val }));
    }
  };

  useEffect(() => {
    fetchData();
  }, [statusFilter]);

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setCreating(true);
      await api.post('/events', form);
      setModalOpen(false);
      modal.alert({
        title: 'Успешно',
        message: `Сбор на «${form.title}» успешно опубликован в Discord!`,
        type: 'success',
      });
      fetchData();
    } catch (err: any) {
      modal.alert({
        title: 'Ошибка',
        message: err.response?.data?.error || 'Не удалось создать мероприятие',
        type: 'error',
      });
    } finally {
      setCreating(false);
    }
  };

  const handleMoveParticipant = async (eventId: string, userId: string, targetStatus: 'CONFIRMED' | 'RESERVE') => {
    try {
      await api.post(`/events/${eventId}/participants/${userId}/move`, { targetStatus });
      fetchData();
    } catch (err: any) {
      modal.alert({
        title: 'Ошибка перемещения',
        message: err.response?.data?.error || 'Не удалось переместить участника',
        type: 'error',
      });
    }
  };

  const handleRebalance = async (eventId: string) => {
    try {
      const res = await api.post(`/events/${eventId}/rebalance`);
      modal.alert({
        title: 'Состав сбалансирован',
        message: `Состав успешно распределен по иерархии ролей!\nОснова: ${res.data.confirmedCount}, Резерв: ${res.data.reserveCount}`,
        type: 'success',
      });
      fetchData();
    } catch (err: any) {
      modal.alert({
        title: 'Ошибка',
        message: err.response?.data?.error || 'Не удалось сбалансировать состав',
        type: 'error',
      });
    }
  };

  const handleKickParticipant = async (eventId: string, userId: string, tag: string) => {
    const confirmed = await modal.confirm({
      title: 'Исключение из состава',
      message: `Исключить участника ${tag} из состава?\nЕсли в резерве есть люди, участник с наивысшим приоритетом автоматически перейдет в основу.`,
      confirmText: 'Исключить',
      type: 'danger',
    });
    if (!confirmed) return;

    try {
      await api.post(`/events/${eventId}/participants/${userId}/kick`);
      fetchData();
    } catch (err: any) {
      modal.alert({
        title: 'Ошибка',
        message: err.response?.data?.error || 'Не удалось исключить участника',
        type: 'error',
      });
    }
  };

  const handleFinishEvent = async (eventId: string) => {
    const confirmed = await modal.confirm({
      title: 'Завершение сбора',
      message: 'Завершить сбор на это мероприятие? Сообщение в Discord обновится и удалится через 30 минут.',
      confirmText: 'Завершить сбор',
      type: 'pink',
    });
    if (!confirmed) return;

    try {
      await api.post(`/events/${eventId}/status`, { status: 'FINISHED' });
      fetchData();
    } catch (err: any) {
      modal.alert({
        title: 'Ошибка',
        message: err.response?.data?.error || 'Не удалось завершить мероприятие',
        type: 'error',
      });
    }
  };

  const textChannels = channels.filter(c => c.type === 0);
  const voiceChannels = channels.filter(c => c.type === 2);

  const getMentionLabel = (targetRoleId?: string) => {
    if (!targetRoleId || targetRoleId === 'none') return 'Без пинга';
    if (targetRoleId === 'here') return '@here';
    if (targetRoleId === 'everyone') return '@everyone';
    const found = roles.find(r => r.id === targetRoleId);
    return found ? `@${found.name}` : `@${targetRoleId}`;
  };

  // Filter roles available to add into hierarchy
  const availableRolesToAdd = roles.filter(
    r => !priorityConfig.eventRoleHierarchy.some(item => item.roleId === r.id)
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
            <CalendarDays className="w-6 h-6 text-pink-500" />
            Сборы на мероприятия (Капты, ВЗЗ, МЦЛ)
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Плюсы могут оставлять любые участники • Бот формирует состав с учётом иерархии ролей семьи
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Main Mode Switcher */}
          <div className="flex bg-[#0B0E14] p-1 rounded-xl border border-[#1E232F]">
            <button
              onClick={() => setMainTab('events')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                mainTab === 'events'
                  ? 'bg-gradient-to-r from-pink-600 to-rose-500 text-white shadow-md shadow-pink-600/25'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Сборы ({events.length})
            </button>
            <button
              onClick={() => setMainTab('prioritySettings')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                mainTab === 'prioritySettings'
                  ? 'bg-gradient-to-r from-pink-600 to-rose-500 text-white shadow-md shadow-pink-600/25'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              ⚙️ Иерархия ролей & Приоритет
            </button>
          </div>

          {mainTab === 'events' && (
            <button
              onClick={() => setModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-pink-600 to-rose-500 hover:from-pink-500 hover:to-rose-400 text-white text-xs font-semibold shadow-lg shadow-pink-600/25 transition-all"
            >
              <Plus className="w-4 h-4" />
              Объявить сбор
            </button>
          )}
        </div>
      </div>

      {mainTab === 'prioritySettings' ? (
        <div className="bg-[#151921] border border-[#1E232F] rounded-2xl p-6 space-y-6 max-w-3xl">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-pink-500/10 border border-pink-500/20 flex items-center justify-center text-pink-400 shrink-0">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Иерархия ролей для сборов на мероприятия</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Плюсы могут оставлять все участники сервера. Чем выше роль в списке — тем выше приоритет попадания в основу. 
                Участники с высшей ролью автоматически вытесняют в резерв участников с меньшим приоритетом.
              </p>
            </div>
          </div>

          {/* Role Hierarchy List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Текущая иерархия ролей (по убыванию приоритета)
              </span>
              <span className="text-[11px] text-slate-500">
                Всего в иерархии: {priorityConfig.eventRoleHierarchy.length}
              </span>
            </div>

            {priorityConfig.eventRoleHierarchy.length === 0 ? (
              <div className="p-6 rounded-xl bg-[#0B0E14] border border-dashed border-[#1E232F] text-center space-y-1.5">
                <ShieldAlert className="w-8 h-8 text-slate-600 mx-auto" />
                <p className="text-xs text-slate-400 font-medium">Иерархия ролей пока не настроена</p>
                <p className="text-[11px] text-slate-500">
                  Добавьте роли семьи ниже (например: Старший состав, Капт состав, Стрелок, Основа), чтобы бот отдавал им приоритет.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {priorityConfig.eventRoleHierarchy.map((item, idx) => {
                  const roleObj = roles.find(r => r.id === item.roleId);
                  const roleName = roleObj?.name || item.roleName || item.roleId;

                  return (
                    <div
                      key={item.roleId}
                      className="flex items-center justify-between p-3 rounded-xl bg-[#0B0E14] border border-[#1E232F] hover:border-pink-500/30 transition-all gap-3"
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={`w-6 h-6 flex items-center justify-center rounded-lg text-xs font-bold ${
                            idx === 0
                              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                              : idx === 1
                              ? 'bg-slate-400/20 text-slate-300 border border-slate-400/40'
                              : idx === 2
                              ? 'bg-orange-500/20 text-orange-400 border border-orange-500/40'
                              : 'bg-[#151921] text-slate-500 border border-[#1E232F]'
                          }`}
                        >
                          #{idx + 1}
                        </span>
                        <div>
                          <span className="px-2.5 py-1 rounded-lg bg-pink-500/10 border border-pink-500/25 text-pink-300 text-xs font-semibold">
                            @{roleName}
                          </span>
                          <span className="text-[10px] text-slate-500 block font-mono mt-0.5">
                            ID: {item.roleId}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1.5 bg-[#151921] border border-[#1E232F] px-2 py-1 rounded-lg">
                          <span className="text-[10px] text-slate-400 font-medium">Очки:</span>
                          <input
                            type="number"
                            min={1}
                            max={1000}
                            value={item.priority}
                            onChange={(e) => updateRolePriorityValue(item.roleId, parseInt(e.target.value, 10) || 10)}
                            className="w-14 bg-transparent text-xs text-right font-mono font-bold text-pink-400 focus:outline-none"
                          />
                        </div>

                        {/* Move Up/Down Controls */}
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => moveRoleHierarchyItem(idx, 'up')}
                            disabled={idx === 0}
                            title="Переместить выше по приоритету"
                            className="p-1.5 rounded-lg bg-[#151921] hover:bg-[#1E232F] border border-[#1E232F] text-slate-300 disabled:opacity-20 transition-all"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => moveRoleHierarchyItem(idx, 'down')}
                            disabled={idx === priorityConfig.eventRoleHierarchy.length - 1}
                            title="Переместить ниже по приоритету"
                            className="p-1.5 rounded-lg bg-[#151921] hover:bg-[#1E232F] border border-[#1E232F] text-slate-300 disabled:opacity-20 transition-all"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => removeRoleFromHierarchy(item.roleId)}
                            title="Удалить из иерархии"
                            className="p-1.5 rounded-lg bg-[#151921] hover:bg-red-500/20 hover:text-red-400 border border-[#1E232F] text-slate-400 transition-all"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Add Role to Hierarchy */}
          <div className="p-4 rounded-xl bg-[#0B0E14] border border-[#1E232F] space-y-3">
            <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5 text-pink-400" />
              Добавить роль в иерархию приоритетов
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
              <div className="sm:col-span-7">
                <label className="block text-[11px] text-slate-400 mb-1">Выберите роль Discord</label>
                <CustomSelect
                  options={availableRolesToAdd.map(r => ({
                    value: r.id,
                    label: `@${r.name}`,
                  }))}
                  value={selectedNewRole}
                  onChange={(val) => setSelectedNewRole(val)}
                  placeholder="Выберите роль для добавления..."
                />
              </div>

              <div className="sm:col-span-3">
                <label className="block text-[11px] text-slate-400 mb-1">Очки приоритета</label>
                <input
                  type="number"
                  min={1}
                  max={1000}
                  value={selectedNewPriority}
                  onChange={(e) => setSelectedNewPriority(parseInt(e.target.value, 10) || 10)}
                  className="w-full bg-[#151921] border border-[#1E232F] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-pink-500"
                />
              </div>

              <div className="sm:col-span-2">
                <button
                  type="button"
                  onClick={addRoleToHierarchy}
                  disabled={!selectedNewRole}
                  className="w-full py-2 rounded-xl bg-pink-600 hover:bg-pink-500 text-white font-semibold text-xs shadow-md shadow-pink-600/20 disabled:opacity-40 transition-all"
                >
                  Добавить
                </button>
              </div>
            </div>
          </div>

          {/* Profile IC Rank bonus */}
          <div className="pt-2 border-t border-[#1E232F] space-y-3">
            <div>
              <label className="block text-slate-300 mb-1 font-semibold text-xs">
                Минимальный IC ранг в профиле
              </label>
              <input
                type="number"
                min={0}
                max={20}
                value={priorityConfig.eventPriorityMinRank}
                onChange={(e) => setPriorityConfig({ ...priorityConfig, eventPriorityMinRank: parseInt(e.target.value, 10) || 0 })}
                className="w-48 bg-[#0B0E14] border border-[#1E232F] rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-pink-500"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Каждый ранг в профиле бойца добавляет дополнительные очки (ранг × 10), что даёт преимущество старшим рангам при равенстве ролей.
              </p>
            </div>

            <div className="p-3 rounded-xl bg-[#0B0E14] border border-[#1E232F] flex items-start gap-2.5 text-slate-400 text-xs">
              <Info className="w-4 h-4 text-pink-400 shrink-0 mt-0.5" />
              <span>
                <strong>Удобное управление:</strong> в карточках сборов на вкладке «Сборы» организаторы могут в 1 клик переводить людей между основой и резервом (стрелочки ⬆️ / ⬇️), а также нажимать кнопку <strong>«Сбалансировать»</strong> для мгновенной пересортировки по этой иерархии!
              </span>
            </div>

            <div className="pt-2">
              <button
                onClick={handleSavePriorityConfig}
                disabled={savingPriority}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-pink-600 to-rose-500 hover:from-pink-500 hover:to-rose-400 text-white font-semibold text-xs shadow-lg shadow-pink-600/25 transition-all disabled:opacity-50"
              >
                {savingPriority ? 'Сохранение...' : 'Сохранить иерархию ролей'}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Status Filters Bar */}
          <div className="flex items-center gap-2">
            <div className="flex bg-[#0B0E14] p-1 rounded-xl border border-[#1E232F]">
              {['ACTIVE', 'FINISHED', 'ALL'].map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                    statusFilter === st
                      ? 'bg-gradient-to-r from-pink-600 to-rose-500 text-white shadow-md shadow-pink-600/25'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {st === 'ACTIVE' && '🟢 Активные сборы'}
                  {st === 'FINISHED' && '🏁 Завершенные'}
                  {st === 'ALL' && 'Все'}
                </button>
              ))}
            </div>
          </div>

          {/* Events Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {loading ? (
          <div className="col-span-full py-12 text-center text-slate-500">Загрузка мероприятий...</div>
        ) : events.length === 0 ? (
          <div className="col-span-full py-12 text-center text-slate-500">Мероприятий не найдено</div>
        ) : (
          events.map((ev) => {
            const confirmed = ev.participants ? ev.participants.filter((p: any) => p.status === 'CONFIRMED') : [];
            const reserve = ev.participants ? ev.participants.filter((p: any) => p.status === 'RESERVE') : [];
            const isLimited = ev.type === 'LIMITED';

            return (
              <div
                key={ev.id}
                className="bg-[#151921] border border-[#1E232F] hover:border-pink-500/30 rounded-2xl p-5 space-y-4 transition-all flex flex-col justify-between"
              >
                <div>
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-base font-bold text-white">{ev.title}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-pink-500/10 text-pink-400 border border-pink-500/20">
                          {isLimited ? `Лимит: ${ev.participantLimit}` : 'Без ограничений'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1">
                        Организатор: <span className="text-slate-200 font-medium">{ev.createdByTag || 'Admin'}</span> • Упоминание: <span className="text-pink-300 font-medium">{getMentionLabel(ev.targetRoleId)}</span>
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      {ev.status === 'ACTIVE' && isLimited && (
                        <button
                          onClick={() => handleRebalance(ev.id)}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#0B0E14] hover:bg-pink-600/20 text-slate-300 hover:text-pink-300 border border-[#1E232F] text-[11px] font-medium transition-all"
                          title="Автоматически распределить основу и резерв по ролям"
                        >
                          <Scale className="w-3 h-3 text-pink-400" />
                          Сбалансировать
                        </button>
                      )}
                      <span
                        className={`text-[10px] px-2.5 py-1 rounded-lg font-bold uppercase tracking-wider ${
                          ev.status === 'ACTIVE'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-slate-700/20 text-slate-400 border border-slate-700/30'
                        }`}
                      >
                        {ev.status === 'ACTIVE' ? 'Активен' : 'Завершен'}
                      </span>
                    </div>
                  </div>

                  {/* Info grid */}
                  <div className="grid grid-cols-2 gap-2 text-xs mb-4">
                    <div className="p-2.5 rounded-xl bg-[#0B0E14] border border-[#1E232F] flex items-center gap-2">
                      <Clock className="w-4 h-4 text-pink-400 flex-shrink-0" />
                      <div>
                        <p className="text-[10px] text-slate-500 uppercase font-semibold">Начало</p>
                        <p className="text-slate-200 font-medium">
                          {new Date(ev.eventTime).toLocaleString('ru-RU', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                    </div>

                    <div className="p-2.5 rounded-xl bg-[#0B0E14] border border-[#1E232F] flex items-center gap-2">
                      <Clock className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                      <div>
                        <p className="text-[10px] text-slate-500 uppercase font-semibold">Чек-ин</p>
                        <p className="text-slate-200 font-medium">
                          {new Date(ev.checkInTime).toLocaleString('ru-RU', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                    </div>

                    <div className="p-2.5 rounded-xl bg-[#0B0E14] border border-[#1E232F] flex items-center gap-2">
                      <Key className="w-4 h-4 text-amber-400 flex-shrink-0" />
                      <div>
                        <p className="text-[10px] text-slate-500 uppercase font-semibold">Код группы</p>
                        <p className="text-slate-200 font-mono font-bold">{ev.partyCode || '—'}</p>
                      </div>
                    </div>

                    <div className="p-2.5 rounded-xl bg-[#0B0E14] border border-[#1E232F] flex items-center gap-2">
                      <Mic className="w-4 h-4 text-purple-400 flex-shrink-0" />
                      <div>
                        <p className="text-[10px] text-slate-500 uppercase font-semibold">Войс-канал</p>
                        <p className="text-slate-200 font-medium truncate">
                          {channels.find(c => c.id === ev.voiceChannelId)?.name || 'Не указан'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Roster list for LIMITED */}
                  {isLimited && (
                    <div className="space-y-3 mb-4">
                      {/* Confirmed / Main */}
                      <div className="p-3 rounded-xl bg-[#0B0E14] border border-[#1E232F]">
                        <div className="flex items-center justify-between text-xs font-semibold text-slate-300 mb-2">
                          <span className="flex items-center gap-1.5">
                            <Users className="w-3.5 h-3.5 text-pink-400" />
                            Основной состав ({confirmed.length}/{ev.participantLimit})
                          </span>
                        </div>

                        {confirmed.length === 0 ? (
                          <p className="text-xs text-slate-500 italic">Пока никто не записался</p>
                        ) : (
                          <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                            {confirmed.map((p: any, idx: number) => (
                              <div
                                key={p.id}
                                className="flex items-center justify-between text-xs p-1.5 rounded-lg bg-[#151921] border border-[#1E232F] hover:border-pink-500/20 transition-all"
                              >
                                <span className="text-slate-200 truncate">
                                  <strong className="text-slate-500 mr-1.5">{idx + 1}.</strong>
                                  {p.userTag || p.userId}
                                </span>

                                {ev.status === 'ACTIVE' && (
                                  <div className="flex items-center gap-1">
                                    <button
                                      onClick={() => handleMoveParticipant(ev.id, p.userId, 'RESERVE')}
                                      title="Переместить в резерв ⬇️"
                                      className="p-1 text-slate-400 hover:text-amber-400 hover:bg-amber-500/10 rounded transition-colors flex items-center gap-0.5 text-[10px]"
                                    >
                                      <ArrowDown className="w-3 h-3 text-amber-400" />
                                      <span className="hidden sm:inline">В резерв</span>
                                    </button>
                                    <button
                                      onClick={() => handleKickParticipant(ev.id, p.userId, p.userTag || p.userId)}
                                      title="Исключить из состава"
                                      className="p-1 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
                                    >
                                      <UserMinus className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Reserve */}
                      <div className="p-3 rounded-xl bg-[#0B0E14] border border-[#1E232F]">
                        <p className="text-xs font-semibold text-amber-400 mb-2">
                          🪑 Резерв ({reserve.length})
                        </p>
                        {reserve.length === 0 ? (
                          <p className="text-xs text-slate-500 italic">Резерв пуст</p>
                        ) : (
                          <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                            {reserve.map((p: any, idx: number) => (
                              <div
                                key={p.id}
                                className="flex items-center justify-between text-xs p-1.5 rounded-lg bg-[#151921] border border-[#1E232F] hover:border-amber-500/20 transition-all"
                              >
                                <span className="text-slate-300 truncate">
                                  <strong className="text-slate-500 mr-1.5">{idx + 1}.</strong>
                                  {p.userTag || p.userId}
                                </span>

                                {ev.status === 'ACTIVE' && (
                                  <div className="flex items-center gap-1">
                                    <button
                                      onClick={() => handleMoveParticipant(ev.id, p.userId, 'CONFIRMED')}
                                      title="Переместить в основной состав ⬆️"
                                      className="p-1 text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10 rounded transition-colors flex items-center gap-0.5 text-[10px]"
                                    >
                                      <ArrowUp className="w-3 h-3 text-emerald-400" />
                                      <span className="hidden sm:inline">В основу</span>
                                    </button>
                                    <button
                                      onClick={() => handleKickParticipant(ev.id, p.userId, p.userTag || p.userId)}
                                      title="Исключить из состава"
                                      className="p-1 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
                                    >
                                      <UserMinus className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Bottom Actions */}
                {ev.status === 'ACTIVE' && (
                  <div className="pt-4 border-t border-[#1E232F] flex justify-end">
                    <button
                      onClick={() => handleFinishEvent(ev.id)}
                      className="px-3.5 py-1.5 rounded-xl bg-[#1E232F] hover:bg-red-500/20 text-slate-300 hover:text-red-300 border border-slate-700/40 text-xs font-semibold transition-all"
                    >
                      Завершить сбор
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </>
  )}

      {/* Create Event Modal */}
      {modalOpen && createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150"
          onClick={() => setModalOpen(false)}
        >
          <div
            className="relative w-full max-w-2xl max-h-[90vh] bg-[#151921] border border-[#1E232F] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <form onSubmit={handleCreateEvent} className="flex flex-col max-h-[90vh] min-h-0">
              {/* Pinned Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-[#1E232F] bg-[#151921] shrink-0">
                <h3 className="font-bold text-white text-base flex items-center gap-2">
                  <CalendarDays className="w-5 h-5 text-pink-500" />
                  Создать сбор на мероприятие
                </h3>
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#1E232F] transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Scrollable Form Body */}
              <div className="p-6 overflow-y-auto space-y-4 text-xs flex-1 custom-scrollbar">
                <div>
                  <label className="block text-slate-400 mb-1.5 font-medium">Выберите мероприятие (только лимитированные) *</label>
                  <div className="grid grid-cols-3 gap-2 mb-2">
                    {[
                      { title: 'Капт', limit: 10, icon: '⚔️' },
                      { title: 'ВЗЗ', limit: 15, icon: '🛡️' },
                      { title: 'МЦЛ', limit: 15, icon: '🏆' },
                    ].map((preset) => (
                      <button
                        key={preset.title}
                        type="button"
                        onClick={() => setForm({ ...form, title: preset.title, participantLimit: preset.limit })}
                        className={`p-2.5 rounded-xl border text-center font-semibold text-xs transition-all ${
                          form.title.startsWith(preset.title)
                            ? 'bg-pink-600/20 border-pink-500 text-pink-300 shadow-md shadow-pink-600/10'
                            : 'bg-[#0B0E14] border-[#1E232F] text-slate-400 hover:text-white hover:border-slate-700'
                        }`}
                      >
                        <span className="text-base block mb-0.5">{preset.icon}</span>
                        <span>{preset.title}</span>
                        <span className="block text-[10px] text-slate-500 font-normal">до {preset.limit} чел.</span>
                      </button>
                    ))}
                  </div>

                  <input
                    type="text"
                    required
                    placeholder="Название сбора (например: Капт vs The Families)"
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    className="w-full bg-[#0B0E14] border border-[#1E232F] rounded-xl px-3 py-2 text-slate-200"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Лимит мест в основном составе *</label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={form.participantLimit}
                    onChange={(e) => setForm({ ...form, participantLimit: parseInt(e.target.value, 10) || 10 })}
                    className="w-full bg-[#0B0E14] border border-[#1E232F] rounded-xl px-3 py-2 text-slate-200"
                  />
                  <span className="text-[10px] text-slate-500 mt-1 block">
                    Все участники сверх лимита попадают в резерв. Приоритетная роль или ранг вытесняют в резерв участников с меньшим приоритетом.
                  </span>
                </div>

                {/* Quick Date Presets */}
                <div className="p-2.5 rounded-xl bg-[#0B0E14] border border-[#1E232F] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 font-medium text-[11px]">Быстрый выбор дня проведения:</span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setQuickDate(0)}
                        className="px-2.5 py-1 rounded-lg bg-[#151921] hover:bg-pink-600/20 hover:border-pink-500/50 hover:text-pink-300 border border-slate-700/50 text-[11px] text-slate-300 font-medium transition-all"
                      >
                        Сегодня
                      </button>
                      <button
                        type="button"
                        onClick={() => setQuickDate(1)}
                        className="px-2.5 py-1 rounded-lg bg-[#151921] hover:bg-pink-600/20 hover:border-pink-500/50 hover:text-pink-300 border border-slate-700/50 text-[11px] text-slate-300 font-medium transition-all"
                      >
                        Завтра
                      </button>
                      <button
                        type="button"
                        onClick={() => setQuickDate(2)}
                        className="px-2.5 py-1 rounded-lg bg-[#151921] hover:bg-pink-600/20 hover:border-pink-500/50 hover:text-pink-300 border border-slate-700/50 text-[11px] text-slate-300 font-medium transition-all"
                      >
                        Послезавтра
                      </button>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-400 mb-1 font-medium">Время начала мероприятия *</label>
                    <input
                      type="datetime-local"
                      required
                      value={form.eventTime}
                      onChange={(e) => handleEventTimeChange(e.target.value)}
                      className="w-full bg-[#0B0E14] border border-[#1E232F] rounded-xl px-3 py-2 text-slate-200"
                    />
                    <span className="text-[10px] text-slate-500 mt-0.5 block">Чек-ин рассчитается за 10 мин</span>
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1 font-medium">Время проверки явки (чек-ин) *</label>
                    <input
                      type="datetime-local"
                      required
                      value={form.checkInTime}
                      onChange={(e) => setForm({ ...form, checkInTime: e.target.value })}
                      className="w-full bg-[#0B0E14] border border-[#1E232F] rounded-xl px-3 py-2 text-slate-200"
                    />
                    <span className="text-[10px] text-slate-500 mt-0.5 block">Авто или вручную</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-400 mb-1 font-medium">Канал для анонса в Discord *</label>
                    <ChannelSelect
                      channels={channels}
                      channelType="text"
                      value={form.channelId}
                      onChange={(val) => setForm({ ...form, channelId: val })}
                      placeholder="Выберите канал..."
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1 font-medium">Голосовой канал для сбора</label>
                    <ChannelSelect
                      channels={channels}
                      channelType="voice"
                      value={form.voiceChannelId}
                      onChange={(val) => setForm({ ...form, voiceChannelId: val })}
                      placeholder="Без голосового канала"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-400 mb-1 font-medium">Код группы в игре</label>
                    <input
                      type="text"
                      placeholder="например: 123-456"
                      value={form.partyCode}
                      onChange={(e) => setForm({ ...form, partyCode: e.target.value })}
                      className="w-full bg-[#0B0E14] border border-[#1E232F] rounded-xl px-3 py-2 text-slate-200"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1 font-medium">Роль для упоминания (пинг)</label>
                    <CustomSelect
                      options={[
                        { value: 'none', label: 'Без упоминания (тихий сбор)' },
                        { value: 'here', label: '@here (только кто онлайн)' },
                        { value: 'everyone', label: '@everyone (все участники)' },
                        ...roles.map((r) => ({
                          value: r.id,
                          label: `@${r.name}`,
                        })),
                      ]}
                      value={form.targetRoleId || 'none'}
                      onChange={(val) => setForm({ ...form, targetRoleId: val })}
                      placeholder="Выберите роль для пинга..."
                    />
                    <span className="text-[10px] text-slate-500 mt-0.5 block">
                      Бот отправит пинг выбранной роли при публикации и напоминаниях
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Примечание / Экипировка</label>
                  <textarea
                    rows={2}
                    placeholder="Броня 50%+, пулеметы, 100 бинтов..."
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    className="w-full bg-[#0B0E14] border border-[#1E232F] rounded-xl px-3 py-2 text-slate-200"
                  />
                </div>
              </div>

              {/* Pinned Footer */}
              <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#1E232F] bg-[#11141B] shrink-0">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-[#1E232F] text-slate-300 hover:text-white font-medium text-xs transition-colors"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-pink-600 to-rose-500 hover:from-pink-500 hover:to-rose-400 text-white font-semibold shadow-lg shadow-pink-600/25 disabled:opacity-50 transition-all text-xs"
                >
                  {creating ? 'Публикация...' : 'Опубликовать сбор'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default Events;
