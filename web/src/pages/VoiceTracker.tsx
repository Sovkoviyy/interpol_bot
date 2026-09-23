import React, { useEffect, useState } from 'react';
import { 
  Mic, 
  Play, 
  Square, 
  Users, 
  Clock, 
  Settings2, 
  Save, 
  Wand2, 
  ChevronDown, 
  ChevronRight,
  AlertTriangle,
  History,
  Plus,
  Trash2,
  Edit3,
  ListPlus,
  Layers
} from 'lucide-react';
import api from '../api/client';
import { useModal } from '../context/ModalContext';

export interface MpType {
  id: string;
  name: string;
  description?: string;
  emoji?: string;
}

export const VoiceTracker: React.FC = () => {
  const modal = useModal();
  const [tab, setTab] = useState<'live' | 'history' | 'mp-types' | 'settings'>('live');
  const [config, setConfig] = useState<any>(null);
  const [sessions, setSessions] = useState<any[]>([]);
  const [channels, setChannels] = useState<any[]>([]);
  const [availableMpTypes, setAvailableMpTypes] = useState<MpType[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null);

  // MP Types Modal
  const [mpModalOpen, setMpModalOpen] = useState(false);
  const [editingMpId, setEditingMpId] = useState<string | null>(null);
  const [mpForm, setMpForm] = useState<{ name: string; description: string; emoji: string }>({
    name: '',
    description: '',
    emoji: '⚔️',
  });

  // Start MP Form
  const [startMpModalOpen, setStartMpModalOpen] = useState(false);
  const [selectedMpName, setSelectedMpName] = useState('Дроп [16:00]');
  const [customMpName, setCustomMpName] = useState('');

  const fetchData = async () => {
    try {
      setLoading(true);
      const [cfgRes, sessRes, chRes] = await Promise.all([
        api.get('/voice-tracker/config'),
        api.get('/voice-tracker/sessions'),
        api.get('/guild/channels'),
      ]);
      setConfig(cfgRes.data.config);
      setAvailableMpTypes(cfgRes.data.availableMpTypes || []);
      if (cfgRes.data.availableMpTypes && cfgRes.data.availableMpTypes.length > 0) {
        setSelectedMpName(cfgRes.data.availableMpTypes[0].name);
      }
      setSessions(sessRes.data.sessions || []);
      setChannels(chRes.data.channels || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleOpenAddMp = () => {
    setEditingMpId(null);
    setMpForm({ name: '', description: '', emoji: '⚔️' });
    setMpModalOpen(true);
  };

  const handleOpenEditMp = (mp: MpType) => {
    setEditingMpId(mp.id);
    setMpForm({
      name: mp.name,
      description: mp.description || '',
      emoji: mp.emoji || '⚔️',
    });
    setMpModalOpen(true);
  };

  const handleSaveMp = async () => {
    const name = mpForm.name.trim();
    if (!name) {
      modal.alert({ title: 'Ошибка', message: 'Введите название мероприятия', type: 'error' });
      return;
    }

    let updatedList: MpType[];
    if (editingMpId) {
      updatedList = availableMpTypes.map((m) =>
        m.id === editingMpId
          ? { ...m, name, description: mpForm.description.trim(), emoji: mpForm.emoji.trim() || '⚔️' }
          : m
      );
    } else {
      const newMp: MpType = {
        id: `mp_${Date.now()}`,
        name,
        description: mpForm.description.trim(),
        emoji: mpForm.emoji.trim() || '⚔️',
      };
      updatedList = [...availableMpTypes, newMp];
    }

    try {
      setSaving(true);
      const res = await api.post('/voice-tracker/config', {
        ...config,
        availableMpTypes: updatedList,
      });
      setAvailableMpTypes(res.data.availableMpTypes || updatedList);
      setMpModalOpen(false);
      modal.alert({
        title: 'Успешно сохранено',
        message: 'Список типов МП сохранен! Пульт управления в Discord автоматически обновлен.',
        type: 'success',
      });
    } catch (err: any) {
      modal.alert({
        title: 'Ошибка',
        message: err.response?.data?.error || 'Не удалось сохранить тип МП',
        type: 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteMp = async (mp: MpType) => {
    const confirmed = await modal.confirm({
      title: 'Удалить тип МП',
      message: `Вы уверены, что хотите удалить «${mp.name}» из списка доступных мероприятий?`,
      confirmText: 'Удалить',
      type: 'danger',
    });
    if (!confirmed) return;

    const updatedList = availableMpTypes.filter((m) => m.id !== mp.id);
    try {
      setSaving(true);
      const res = await api.post('/voice-tracker/config', {
        ...config,
        availableMpTypes: updatedList,
      });
      setAvailableMpTypes(res.data.availableMpTypes || updatedList);
      modal.alert({
        title: 'Удалено',
        message: `Мероприятие «${mp.name}» удалено. Пульт в Discord синхронизирован.`,
        type: 'success',
      });
    } catch (err: any) {
      modal.alert({
        title: 'Ошибка',
        message: err.response?.data?.error || 'Не удалось удалить тип МП',
        type: 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  const activeSession = sessions.find((s) => s.status === 'ACTIVE');

  const handleStartMp = async () => {
    const eventName = customMpName.trim() || selectedMpName;
    try {
      await api.post('/voice-tracker/start', { eventName });
      modal.alert({
        title: 'Мероприятие запущено',
        message: `Сбор на «${eventName}» запущен! Войс переименован, бот отслеживает явку.`,
        type: 'success',
      });
      setStartMpModalOpen(false);
      fetchData();
    } catch (err: any) {
      modal.alert({
        title: 'Ошибка',
        message: err.response?.data?.error || 'Не удалось запустить сбор',
        type: 'error',
      });
    }
  };

  const handleEndMp = async () => {
    const confirmed = await modal.confirm({
      title: 'Завершение МП',
      message: 'Завершить текущий сбор в войсе? Бот вернет прежнее название канала и отправит лог со временем всех участников.',
      confirmText: 'Завершить',
      type: 'danger',
    });
    if (!confirmed) return;

    try {
      await api.post('/voice-tracker/end');
      modal.alert({
        title: 'Мероприятие завершено',
        message: 'Статистика участников сохранена в профили и отправлена в канал логов.',
        type: 'success',
      });
      fetchData();
    } catch (err: any) {
      modal.alert({
        title: 'Ошибка',
        message: err.response?.data?.error || 'Не удалось завершить сбор',
        type: 'error',
      });
    }
  };

  const handleDeployPanel = async () => {
    if (!config?.controlChannelId) {
      modal.alert({
        title: 'Внимание',
        message: 'Сначала выберите канал для пульта управления в настройках и сохраните!',
        type: 'info',
      });
      return;
    }

    try {
      await api.post('/voice-tracker/deploy-panel', { channelId: config.controlChannelId });
      modal.alert({
        title: 'Пульт развернут',
        message: 'Интерактивный пульт управления МП успешно отправлен в канал Discord!',
        type: 'success',
      });
    } catch (err: any) {
      modal.alert({
        title: 'Ошибка',
        message: err.response?.data?.error || 'Ошибка развертывания пульта',
        type: 'error',
      });
    }
  };

  const handleSaveConfig = async () => {
    try {
      setSaving(true);
      await api.post('/voice-tracker/config', config);
      modal.alert({
        title: 'Успешно',
        message: 'Настройки голосового трекера сохранены!',
        type: 'success',
      });
    } catch (err: any) {
      modal.alert({
        title: 'Ошибка',
        message: err.response?.data?.error || 'Не удалось сохранить настройки',
        type: 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  const voiceChannels = channels.filter((c) => c.type === 2);
  const textChannels = channels.filter((c) => c.type === 0);

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
            <Mic className="w-6 h-6 text-pink-500" />
            Авто-подсчет людей на МП (Динамический войс)
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Автоматическая смена названия войс-канала под текущее МП, фиксация времени, опоздавших и ранних выходов
          </p>
        </div>

        {/* Tab switchers */}
        <div className="flex bg-[#0B0E14] p-1 rounded-xl border border-[#1E232F]">
          <button
            onClick={() => setTab('live')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              tab === 'live'
                ? 'bg-gradient-to-r from-pink-600 to-rose-500 text-white shadow-md shadow-pink-600/25'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Текущий сбор
          </button>
          <button
            onClick={() => setTab('history')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              tab === 'history'
                ? 'bg-gradient-to-r from-pink-600 to-rose-500 text-white shadow-md shadow-pink-600/25'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            История сессий ({sessions.length})
          </button>
          <button
            onClick={() => setTab('mp-types')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              tab === 'mp-types'
                ? 'bg-gradient-to-r from-pink-600 to-rose-500 text-white shadow-md shadow-pink-600/25'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            📋 Доступные МП ({availableMpTypes.length})
          </button>
          <button
            onClick={() => setTab('settings')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              tab === 'settings'
                ? 'bg-gradient-to-r from-pink-600 to-rose-500 text-white shadow-md shadow-pink-600/25'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Настройки
          </button>
        </div>
      </div>

      {tab === 'live' && (
        <div className="space-y-6">
          {/* Active Banner */}
          {activeSession ? (
            <div className="bg-gradient-to-r from-pink-950/40 via-[#151921] to-[#0B0E14] border border-pink-500/40 rounded-2xl p-6 shadow-xl relative overflow-hidden">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 mb-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    МП идет прямо сейчас
                  </span>
                  <h2 className="text-2xl font-bold text-white mb-1">{activeSession.eventName}</h2>
                  <p className="text-xs text-slate-300">
                    Старт: {new Date(activeSession.startedAt).toLocaleTimeString('ru-RU')} • Организатор: @{activeSession.startedByTag}
                  </p>
                </div>

                <button
                  onClick={handleEndMp}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-lg shadow-rose-600/25 transition-all"
                >
                  <Square className="w-4 h-4" />
                  Завершить мероприятие
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-[#151921] border border-[#1E232F] rounded-2xl p-8 text-center space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-pink-500/10 text-pink-400 flex items-center justify-center mx-auto">
                <Mic className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Сейчас нет активного сбора в войсе</h3>
                <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                  Запустите сбор, чтобы бот переименовал войс-канал и автоматически зафиксировал явку всех участников.
                </p>
              </div>
              <button
                onClick={() => setStartMpModalOpen(true)}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-pink-600 to-rose-500 hover:from-pink-500 hover:to-rose-400 text-white text-xs font-semibold shadow-lg shadow-pink-600/25 transition-all"
              >
                <Play className="w-4 h-4" />
                Запустить сбор на МП
              </button>
            </div>
          )}
        </div>
      )}

      {tab === 'history' && (
        <div className="space-y-4">
          <div className="bg-[#151921] border border-[#1E232F] rounded-2xl overflow-hidden shadow-xl">
            {sessions.length === 0 ? (
              <div className="py-12 text-center text-slate-500 text-xs">История сессий пуста</div>
            ) : (
              <div className="divide-y divide-[#1E232F]">
                {sessions.map((s) => {
                  let attendees: any[] = [];
                  try {
                    attendees = JSON.parse(s.attendanceJson || '[]');
                  } catch {}

                  const isExpanded = expandedSessionId === s.id;

                  return (
                    <div key={s.id} className="p-4 hover:bg-[#1A1F2B]/40 transition-colors">
                      <div
                        onClick={() => setExpandedSessionId(isExpanded ? null : s.id)}
                        className="flex items-center justify-between cursor-pointer"
                      >
                        <div className="flex items-center gap-3">
                          {isExpanded ? <ChevronDown className="w-4 h-4 text-pink-400" /> : <ChevronRight className="w-4 h-4 text-slate-500" />}
                          <div>
                            <h4 className="text-sm font-bold text-white">{s.eventName}</h4>
                            <p className="text-[11px] text-slate-400 mt-0.5">
                              {new Date(s.startedAt).toLocaleString('ru-RU')} • Организатор: @{s.startedByTag}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-4 text-xs">
                          <span className="font-semibold text-slate-300">
                            👥 <strong className="text-white">{s.totalAttendees}</strong> чел.
                          </span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            s.status === 'ACTIVE' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-700/40 text-slate-300'
                          }`}>
                            {s.status === 'ACTIVE' ? 'Идет' : 'Завершено'}
                          </span>
                        </div>
                      </div>

                      {/* Expanded attendance list */}
                      {isExpanded && (
                        <div className="mt-4 pt-4 border-t border-[#1E232F] space-y-2">
                          <h5 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                            Список участников мероприятия ({attendees.length}):
                          </h5>
                          {attendees.length === 0 ? (
                            <p className="text-xs text-slate-500 italic">Нет зафиксированных участников</p>
                          ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-60 overflow-y-auto pr-1">
                              {attendees.map((a: any, i: number) => (
                                <div key={i} className="p-2 rounded-xl bg-[#0B0E14] border border-[#1E232F] flex items-center justify-between text-xs">
                                  <span className="font-medium text-slate-200">
                                    <strong className="text-slate-500 mr-1.5">{i + 1}.</strong>
                                    {a.userTag}
                                  </span>
                                  <div className="flex items-center gap-2">
                                    {a.isLate && <span className="text-[10px] text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">Опоздал</span>}
                                    {a.leftEarly && <span className="text-[10px] text-rose-400 bg-rose-500/10 px-1.5 py-0.5 rounded">Ушел раньше</span>}
                                    <span className="font-mono text-pink-400 font-bold">{a.durationMinutes} мин</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'mp-types' && (
        <div className="bg-[#151921] border border-[#1E232F] rounded-2xl p-6 space-y-5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-[#1E232F] pb-4">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <ListPlus className="w-5 h-5 text-pink-500" />
                Доступные мероприятия (МП)
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Этот список отображается в пульте управления в Discord и в быстром запуске сборов на сайте.
              </p>
            </div>
            <button
              onClick={handleOpenAddMp}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-pink-600 to-rose-500 hover:from-pink-500 hover:to-rose-400 text-white font-semibold text-xs shadow-md shadow-pink-600/25 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Добавить тип МП</span>
            </button>
          </div>

          {availableMpTypes.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs">
              Список мероприятий пуст. Нажмите «Добавить тип МП», чтобы создать первое.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {availableMpTypes.map((mp, idx) => (
                <div
                  key={mp.id || idx}
                  className="bg-[#0B0E14] border border-[#1E232F] hover:border-pink-500/40 rounded-xl p-4 flex flex-col justify-between transition-all group"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2.5">
                      <span className="text-2xl p-2 rounded-lg bg-pink-500/10 border border-pink-500/20">
                        {mp.emoji || '⚔️'}
                      </span>
                      <div>
                        <h3 className="font-bold text-white text-sm group-hover:text-pink-400 transition-colors">
                          {mp.name}
                        </h3>
                        <p className="text-[11px] text-slate-400 line-clamp-2 mt-0.5">
                          {mp.description || 'Без описания'}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-1.5 pt-2 border-t border-[#1E232F]/60">
                    <button
                      onClick={() => handleOpenEditMp(mp)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#1E232F] transition-colors"
                      title="Редактировать"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteMp(mp)}
                      className="p-1.5 rounded-lg text-rose-400/80 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                      title="Удалить"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'settings' && (
        <div className="bg-[#151921] border border-[#1E232F] rounded-2xl p-6 space-y-4 max-w-3xl">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <Settings2 className="w-4 h-4 text-pink-500" />
            Настройки умного голосового канала
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block text-slate-400 mb-1 font-medium">Отслеживаемый голосовой канал</label>
              <select
                value={config?.voiceChannelId || ''}
                onChange={(e) => setConfig({ ...config, voiceChannelId: e.target.value })}
                className="w-full bg-[#0B0E14] border border-[#1E232F] rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-pink-500"
              >
                <option value="">Выберите войс-канал...</option>
                {voiceChannels.map((c) => (
                  <option key={c.id} value={c.id}>🔊 {c.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-400 mb-1 font-medium">Дефолтное название войса (когда нет МП)</label>
              <input
                type="text"
                value={config?.defaultVoiceName || 'Ожидание МП'}
                onChange={(e) => setConfig({ ...config, defaultVoiceName: e.target.value })}
                className="w-full bg-[#0B0E14] border border-[#1E232F] rounded-xl px-3 py-2 text-slate-200"
              />
            </div>

            <div>
              <label className="block text-slate-400 mb-1 font-medium">Канал для пульта управления в Discord</label>
              <select
                value={config?.controlChannelId || ''}
                onChange={(e) => setConfig({ ...config, controlChannelId: e.target.value })}
                className="w-full bg-[#0B0E14] border border-[#1E232F] rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-pink-500"
              >
                <option value="">Выберите текстовый канал...</option>
                {textChannels.map((c) => (
                  <option key={c.id} value={c.id}>#{c.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-400 mb-1 font-medium">Канал для отчетов явки (логи сборов)</label>
              <select
                value={config?.logChannelId || ''}
                onChange={(e) => setConfig({ ...config, logChannelId: e.target.value })}
                className="w-full bg-[#0B0E14] border border-[#1E232F] rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-pink-500"
              >
                <option value="">Выберите текстовый канал...</option>
                {textChannels.map((c) => (
                  <option key={c.id} value={c.id}>#{c.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="pt-2 flex items-center gap-3">
            <button
              onClick={handleSaveConfig}
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-pink-600 to-rose-500 hover:from-pink-500 hover:to-rose-400 text-white font-semibold text-xs shadow-lg shadow-pink-600/25 transition-all disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>Сохранить настройки</span>
            </button>

            <button
              onClick={handleDeployPanel}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#1E232F] hover:bg-pink-600/20 text-slate-200 hover:text-pink-300 font-semibold text-xs border border-slate-700/50 hover:border-pink-500/30 transition-all"
            >
              <Wand2 className="w-4 h-4 text-pink-400" />
              <span>Развернуть пульт в Discord</span>
            </button>
          </div>
        </div>
      )}

      {/* Start MP Modal */}
      {startMpModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-[#151921] border border-[#1E232F] rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#1E232F] pb-3">
              <h3 className="font-bold text-white text-base">Запуск сбора в голосовом канале</h3>
              <button
                onClick={() => setStartMpModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1 font-medium">Выберите тип МП</label>
                <select
                  value={selectedMpName}
                  onChange={(e) => setSelectedMpName(e.target.value)}
                  className="w-full bg-[#0B0E14] border border-[#1E232F] rounded-xl px-3 py-2 text-slate-200"
                >
                  {availableMpTypes.map((mp) => (
                    <option key={mp.id} value={mp.name}>
                      {mp.emoji || '⚔️'} {mp.name}
                    </option>
                  ))}
                  {availableMpTypes.length === 0 && (
                    <option value="Мероприятие">⚔️ Мероприятие</option>
                  )}
                </select>
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">Или введите кастомное название</label>
                <input
                  type="text"
                  placeholder="например: Тренировка стрельбы"
                  value={customMpName}
                  onChange={(e) => setCustomMpName(e.target.value)}
                  className="w-full bg-[#0B0E14] border border-[#1E232F] rounded-xl px-3 py-2 text-slate-200"
                />
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                onClick={() => setStartMpModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-[#1E232F] text-slate-300 hover:text-white text-xs"
              >
                Отмена
              </button>
              <button
                onClick={handleStartMp}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-pink-600 to-rose-500 hover:from-pink-500 hover:to-rose-400 text-white font-semibold text-xs shadow-md shadow-pink-600/25"
              >
                Запустить
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit MP Type Modal */}
      {mpModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-[#151921] border border-[#1E232F] rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#1E232F] pb-3">
              <h3 className="font-bold text-white text-base">
                {editingMpId ? 'Редактировать тип МП' : 'Добавить новое мероприятие'}
              </h3>
              <button
                onClick={() => setMpModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div className="grid grid-cols-4 gap-3">
                <div className="col-span-1">
                  <label className="block text-slate-400 mb-1 font-medium">Эмодзи</label>
                  <input
                    type="text"
                    value={mpForm.emoji}
                    onChange={(e) => setMpForm({ ...mpForm, emoji: e.target.value })}
                    placeholder="⚔️"
                    className="w-full text-center bg-[#0B0E14] border border-[#1E232F] rounded-xl px-2 py-2 text-slate-200 text-base"
                  />
                </div>
                <div className="col-span-3">
                  <label className="block text-slate-400 mb-1 font-medium">Название мероприятия *</label>
                  <input
                    type="text"
                    value={mpForm.name}
                    onChange={(e) => setMpForm({ ...mpForm, name: e.target.value })}
                    placeholder="например: Остров, Цех, Поезд"
                    className="w-full bg-[#0B0E14] border border-[#1E232F] rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-pink-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">Краткое описание (для пульта в Discord)</label>
                <input
                  type="text"
                  value={mpForm.description}
                  onChange={(e) => setMpForm({ ...mpForm, description: e.target.value })}
                  placeholder="например: Вечерний сбор на поезд"
                  className="w-full bg-[#0B0E14] border border-[#1E232F] rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-pink-500"
                />
              </div>

              <div className="p-3 bg-pink-500/10 border border-pink-500/20 rounded-xl text-pink-300 text-[11px] leading-relaxed">
                💡 <b>Синхронизация с Discord:</b> после сохранения это МП автоматически появится в выпадающем списке пульта управления в Discord!
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                onClick={() => setMpModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-[#1E232F] text-slate-300 hover:text-white text-xs"
              >
                Отмена
              </button>
              <button
                onClick={handleSaveMp}
                disabled={saving}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-pink-600 to-rose-500 hover:from-pink-500 hover:to-rose-400 text-white font-semibold text-xs shadow-md shadow-pink-600/25 disabled:opacity-50"
              >
                {saving ? 'Сохранение...' : 'Сохранить'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VoiceTracker;
