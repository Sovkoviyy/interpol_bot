import React, { useEffect, useState } from 'react';
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
  AlertTriangle
} from 'lucide-react';
import api from '../api/client';

export const Events: React.FC = () => {
  const [events, setEvents] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [channels, setChannels] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState('ACTIVE');
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  // New Event Form State
  const [form, setForm] = useState({
    title: '',
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

  const fetchData = async () => {
    try {
      setLoading(true);
      const [eventsRes, rolesRes, channelsRes] = await Promise.all([
        api.get(`/events?status=${statusFilter}`),
        api.get('/guild/roles'),
        api.get('/guild/channels'),
      ]);
      setEvents(eventsRes.data.events);
      setRoles(rolesRes.data.roles);
      setChannels(channelsRes.data.channels);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
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
      alert('Сбор на мероприятие успешно создан и опубликован в Discord!');
      setModalOpen(false);
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Ошибка при создании сбора');
    } finally {
      setCreating(false);
    }
  };

  const handleKickParticipant = async (eventId: string, userId: string, tag: string) => {
    if (!confirm(`Исключить участника ${tag} из состава? (Если есть резерв, он автоматически займет его место)`)) return;
    try {
      await api.post(`/events/${eventId}/participants/${userId}/kick`);
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Ошибка');
    }
  };

  const handleFinishEvent = async (eventId: string) => {
    if (!confirm('Завершить сбор на это мероприятие?')) return;
    try {
      await api.post(`/events/${eventId}/status`, { status: 'FINISHED' });
      fetchData();
    } catch (err) {
      alert('Ошибка');
    }
  };

  const textChannels = channels.filter(c => c.type === 0);
  const voiceChannels = channels.filter(c => c.type === 2);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
            <CalendarDays className="w-6 h-6 text-emerald-400" />
            Сборы на мероприятия
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Дропы, цеха, ВЗМ, МЦЛ, капты с умными напоминаниями и управлением составом
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex bg-[#151921] p-1 rounded-xl border border-[#1E232F]">
            {['ACTIVE', 'FINISHED', 'ALL'].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  statusFilter === st
                    ? 'bg-emerald-600 text-white shadow-lg'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {st === 'ACTIVE' && '🟢 Активные'}
                {st === 'FINISHED' && '🏁 Завершенные'}
                {st === 'ALL' && 'Все'}
              </button>
            ))}
          </div>

          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition-all shadow-lg shadow-emerald-600/20"
          >
            <Plus className="w-4 h-4" />
            <span>Создать сбор</span>
          </button>
        </div>
      </div>

      {/* Events Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {events.length === 0 ? (
          <div className="col-span-full py-12 text-center text-slate-500 bg-[#151921] border border-[#1E232F] rounded-2xl">
            Сборов с выбранным статусом нет
          </div>
        ) : (
          events.map((ev) => {
            const confirmed = ev.participants?.filter((p: any) => p.status === 'CONFIRMED') || [];
            const reserve = ev.participants?.filter((p: any) => p.status === 'RESERVE') || [];
            const isLimited = ev.type === 'LIMITED';

            return (
              <div
                key={ev.id}
                className="bg-[#151921] border border-[#1E232F] rounded-2xl p-6 shadow-xl relative overflow-hidden flex flex-col justify-between"
              >
                <div>
                  {/* Status badge & title */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span
                      className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        ev.status === 'ACTIVE'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-slate-500/10 text-slate-400 border border-slate-500/20'
                      }`}
                    >
                      {ev.status === 'ACTIVE' ? '🟢 Активен' : '🏁 Завершен'}
                    </span>

                    <span className="text-xs text-slate-400 font-medium">
                      Организатор: @{ev.createdByTag || 'Организатор'}
                    </span>
                  </div>

                  <h3 className="text-lg font-bold text-white mb-2">{ev.title}</h3>
                  {ev.description && (
                    <p className="text-xs text-slate-400 mb-4 leading-relaxed italic">{ev.description}</p>
                  )}

                  {/* Metadata cards */}
                  <div className="grid grid-cols-2 gap-2 text-xs mb-4">
                    <div className="p-2.5 rounded-xl bg-[#0B0E14] border border-[#1E232F] flex items-center gap-2">
                      <Clock className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                      <div>
                        <p className="text-[10px] text-slate-500 uppercase font-semibold">Чек-ин явки</p>
                        <p className="text-slate-200 font-medium">
                          {new Date(ev.checkInTime).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>

                    <div className="p-2.5 rounded-xl bg-[#0B0E14] border border-[#1E232F] flex items-center gap-2">
                      <Clock className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                      <div>
                        <p className="text-[10px] text-slate-500 uppercase font-semibold">Старт МП</p>
                        <p className="text-slate-200 font-medium">
                          {new Date(ev.eventTime).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
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
                      {/* Confirmed */}
                      <div className="p-3 rounded-xl bg-[#0B0E14] border border-[#1E232F]">
                        <div className="flex items-center justify-between text-xs font-semibold text-slate-300 mb-2">
                          <span className="flex items-center gap-1.5">
                            <Users className="w-3.5 h-3.5 text-indigo-400" />
                            Основной состав ({confirmed.length}/{ev.participantLimit})
                          </span>
                        </div>

                        {confirmed.length === 0 ? (
                          <p className="text-xs text-slate-500 italic">Пока никто не записался</p>
                        ) : (
                          <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                            {confirmed.map((p: any, idx: number) => (
                              <div
                                key={p.id}
                                className="flex items-center justify-between text-xs p-1.5 rounded-lg bg-[#151921] border border-[#1E232F]"
                              >
                                <span className="text-slate-200">
                                  <strong className="text-slate-500 mr-1.5">{idx + 1}.</strong>
                                  {p.userTag || p.userId}
                                </span>
                                {ev.status === 'ACTIVE' && (
                                  <button
                                    onClick={() => handleKickParticipant(ev.id, p.userId, p.userTag || p.userId)}
                                    title="Исключить из состава"
                                    className="p-1 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
                                  >
                                    <UserMinus className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Reserve */}
                      {reserve.length > 0 && (
                        <div className="p-3 rounded-xl bg-[#0B0E14] border border-[#1E232F]">
                          <p className="text-xs font-semibold text-amber-400 mb-2">
                            🪑 Резерв ({reserve.length})
                          </p>
                          <div className="space-y-1.5 max-h-28 overflow-y-auto pr-1">
                            {reserve.map((p: any, idx: number) => (
                              <div
                                key={p.id}
                                className="flex items-center justify-between text-xs p-1.5 rounded-lg bg-[#151921] border border-[#1E232F]"
                              >
                                <span className="text-slate-300">
                                  <strong className="text-slate-500 mr-1.5">{idx + 1}.</strong>
                                  {p.userTag || p.userId}
                                </span>
                                {ev.status === 'ACTIVE' && (
                                  <button
                                    onClick={() => handleKickParticipant(ev.id, p.userId, p.userTag || p.userId)}
                                    className="p-1 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
                                  >
                                    <UserMinus className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
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

      {/* Create Event Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-lg bg-[#151921] border border-[#1E232F] rounded-2xl p-6 shadow-2xl space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-[#1E232F] pb-3">
              <h3 className="font-bold text-white text-base flex items-center gap-2">
                <CalendarDays className="w-5 h-5 text-emerald-400" />
                Создать сбор на мероприятие
              </h3>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-[#1E232F]"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateEvent} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-400 mb-1 font-medium">Название / Тип МП *</label>
                <input
                  type="text"
                  required
                  placeholder="например: Дроп 20:00, Цех, ВЗМ, МЦЛ, Капт"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full bg-[#0B0E14] border border-[#1E232F] rounded-xl px-3 py-2 text-slate-200"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Тип сбора *</label>
                  <select
                    value={form.type}
                    onChange={(e) => setForm({ ...form, type: e.target.value })}
                    className="w-full bg-[#0B0E14] border border-[#1E232F] rounded-xl px-3 py-2 text-slate-200"
                  >
                    <option value="LIMITED">С ограничением мест (ВЗМ, Капт)</option>
                    <option value="UNLIMITED">Без ограничений (Массовый)</option>
                  </select>
                </div>

                {form.type === 'LIMITED' && (
                  <div>
                    <label className="block text-slate-400 mb-1 font-medium">Лимит мест *</label>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={form.participantLimit}
                      onChange={(e) => setForm({ ...form, participantLimit: parseInt(e.target.value, 10) || 10 })}
                      className="w-full bg-[#0B0E14] border border-[#1E232F] rounded-xl px-3 py-2 text-slate-200"
                    />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Время проверки явки (чек-ин) *</label>
                  <input
                    type="datetime-local"
                    required
                    value={form.checkInTime}
                    onChange={(e) => setForm({ ...form, checkInTime: e.target.value })}
                    className="w-full bg-[#0B0E14] border border-[#1E232F] rounded-xl px-3 py-2 text-slate-200"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Время начала мероприятия *</label>
                  <input
                    type="datetime-local"
                    required
                    value={form.eventTime}
                    onChange={(e) => setForm({ ...form, eventTime: e.target.value })}
                    className="w-full bg-[#0B0E14] border border-[#1E232F] rounded-xl px-3 py-2 text-slate-200"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Канал для анонса в Discord *</label>
                  <select
                    required
                    value={form.channelId}
                    onChange={(e) => setForm({ ...form, channelId: e.target.value })}
                    className="w-full bg-[#0B0E14] border border-[#1E232F] rounded-xl px-3 py-2 text-slate-200"
                  >
                    <option value="">Выберите канал...</option>
                    {textChannels.map((c) => (
                      <option key={c.id} value={c.id}>#{c.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Голосовой канал для сбора</label>
                  <select
                    value={form.voiceChannelId}
                    onChange={(e) => setForm({ ...form, voiceChannelId: e.target.value })}
                    className="w-full bg-[#0B0E14] border border-[#1E232F] rounded-xl px-3 py-2 text-slate-200"
                  >
                    <option value="">Без голосового канала</option>
                    {voiceChannels.map((c) => (
                      <option key={c.id} value={c.id}>🔊 {c.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
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
                  <label className="block text-slate-400 mb-1 font-medium">Роль для пинга</label>
                  <select
                    value={form.targetRoleId}
                    onChange={(e) => setForm({ ...form, targetRoleId: e.target.value })}
                    className="w-full bg-[#0B0E14] border border-[#1E232F] rounded-xl px-3 py-2 text-slate-200"
                  >
                    <option value="">@everyone / @here</option>
                    {roles.map((r) => (
                      <option key={r.id} value={r.id}>@{r.name}</option>
                    ))}
                  </select>
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

              <div className="pt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-[#1E232F] text-slate-300 hover:text-white"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold shadow-lg shadow-emerald-600/20 disabled:opacity-50"
                >
                  {creating ? 'Публикация...' : 'Опубликовать сбор'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Events;
