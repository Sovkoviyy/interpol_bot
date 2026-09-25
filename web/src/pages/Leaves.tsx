import React, { useEffect, useState } from 'react';
import { 
  CalendarOff, 
  Check, 
  X, 
  Plus, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  AlertCircle,
  Calendar,
  Filter,
  Send,
  Timer,
  UserCheck,
  History,
  ShieldCheck,
  User,
  Sparkles
} from 'lucide-react';
import api from '../api/client';
import { useModal } from '../context/ModalContext';

export const Leaves: React.FC = () => {
  const modal = useModal();
  const [tab, setTab] = useState<'active' | 'requests' | 'logs' | 'panel'>('active');
  const [activeLeaves, setActiveLeaves] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [channels, setChannels] = useState<any[]>([]);
  const [deployChannelId, setDeployChannelId] = useState('');
  const [deploying, setDeploying] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('PENDING');
  const [loading, setLoading] = useState(true);

  // Modal form for creating leave/timeoff
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createType, setCreateType] = useState<'VACATION' | 'TIMEOFF'>('VACATION');
  const [vacStart, setVacStart] = useState(new Date().toISOString().split('T')[0]);
  const [vacEnd, setVacEnd] = useState(new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]);
  const [timeoffDurationHours, setTimeoffDurationHours] = useState('2');
  const [timeoffDurationMinutes, setTimeoffDurationMinutes] = useState('0');
  const [leaveReason, setLeaveReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchActive = async () => {
    try {
      const res = await api.get('/leave/active');
      setActiveLeaves(res.data.active || []);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchRequests = async () => {
    try {
      const query = statusFilter !== 'ALL' ? `?status=${statusFilter}` : '';
      const res = await api.get(`/leave${query}`);
      setRequests(res.data.requests || []);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchLogs = async () => {
    try {
      const res = await api.get('/leave/logs');
      setLogs(res.data.logs || []);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchChannels = async () => {
    try {
      const res = await api.get('/guild/channels');
      const textChannels = (res.data?.channels || []).filter(
        (c: any) => c.type === 0 || c.type === 'GUILD_TEXT'
      );
      setChannels(textChannels);
      if (textChannels.length > 0 && !deployChannelId) {
        setDeployChannelId(textChannels[0].id);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const loadData = async () => {
    setLoading(true);
    await Promise.all([fetchActive(), fetchRequests(), fetchLogs(), fetchChannels()]);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (tab === 'requests') {
      fetchRequests();
    }
  }, [statusFilter]);

  const handleDeployPanel = async () => {
    if (!deployChannelId) {
      modal.alert({ title: 'Ошибка', message: 'Выберите текстовый канал для отправки панели.', type: 'warning' });
      return;
    }

    const selectedCh = channels.find(c => c.id === deployChannelId);
    const chName = selectedCh ? `#${selectedCh.name}` : deployChannelId;

    modal.confirm({
      title: 'Отправить панель отпусков и отгулов?',
      message: `Бот отправит интерактивное сообщение с кнопками «🏖️ Отпуск (1-14 дней)» и «⏱️ Отгул (5 мин - 24 ч)» в канал ${chName}.`,
      type: 'pink',
      confirmText: 'Отправить панель',
      onConfirm: async () => {
        try {
          setDeploying(true);
          await api.post('/leave/deploy-panel', { channelId: deployChannelId });
          modal.alert({
            title: 'Панель успешно отправлена',
            message: `Интерактивная панель отпусков и отгулов успешно опубликована в канале ${chName}!`,
            type: 'success',
          });
        } catch (err: any) {
          modal.alert({
            title: 'Ошибка отправки',
            message: err.response?.data?.error || 'Не удалось отправить панель в канал',
            type: 'error',
          });
        } finally {
          setDeploying(false);
        }
      },
    });
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leaveReason.trim()) {
      modal.alert({ title: 'Ошибка', message: 'Укажите причину отсутствия', type: 'error' });
      return;
    }

    let startDate: string;
    let endDate: string;

    if (createType === 'VACATION') {
      const s = new Date(vacStart);
      const eDate = new Date(vacEnd);
      const diffDays = Math.ceil((eDate.getTime() - s.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays < 1 || diffDays > 14) {
        modal.alert({
          title: 'Некорректный срок',
          message: 'Продолжительность отпуска должна составлять от 1 до 14 дней (2 недели).',
          type: 'error',
        });
        return;
      }
      startDate = s.toISOString();
      endDate = eDate.toISOString();
    } else {
      const h = parseInt(timeoffDurationHours || '0', 10);
      const m = parseInt(timeoffDurationMinutes || '0', 10);
      const totalMins = h * 60 + m;
      if (totalMins < 5 || totalMins > 1440) {
        modal.alert({
          title: 'Некорректный срок',
          message: 'Отгул может составлять от 5 минут до 24 часов.',
          type: 'error',
        });
        return;
      }
      const now = new Date();
      startDate = now.toISOString();
      endDate = new Date(now.getTime() + totalMins * 60 * 1000).toISOString();
    }

    try {
      setSubmitting(true);
      await api.post('/leave', {
        startDate,
        endDate,
        reason: leaveReason,
        type: createType,
      });

      modal.alert({
        title: 'Заявка отправлена',
        message: `Заявка на ${createType === 'VACATION' ? 'отпуск' : 'отгул'} успешно зарегистрирована!`,
        type: 'success',
      });
      setShowCreateModal(false);
      setLeaveReason('');
      loadData();
    } catch (err: any) {
      modal.alert({
        title: 'Ошибка',
        message: err.response?.data?.error || 'Не удалось отправить заявку',
        type: 'error',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleApprove = (leave: any) => {
    modal.confirm({
      title: `Одобрить ${leave.type === 'VACATION' ? 'отпуск' : 'отгул'}?`,
      message: `Одобрить отсутствие для ${leave.userTag} с ${new Date(leave.startDate).toLocaleString('ru-RU')} по ${new Date(leave.endDate).toLocaleString('ru-RU')}?`,
      type: 'warning',
      confirmText: 'Да, одобрить',
      onConfirm: async () => {
        try {
          await api.post(`/leave/${leave.id}/review`, { approved: true });
          modal.alert({
            title: 'Одобрено',
            message: `Отсутствие для ${leave.userTag} одобрено. Статус профиля переведен в «В отпуске».`,
            type: 'success',
          });
          loadData();
        } catch (err: any) {
          modal.alert({
            title: 'Ошибка',
            message: err.response?.data?.error || 'Не удалось одобрить',
            type: 'error',
          });
        }
      },
    });
  };

  const handleReject = (leave: any) => {
    modal.form({
      title: `Отклонить заявку на ${leave.type === 'VACATION' ? 'отпуск' : 'отгул'}`,
      message: `Укажите причину отказа для ${leave.userTag}:`,
      fields: [
        {
          name: 'rejectionReason',
          label: 'Причина отказа',
          placeholder: 'Высокая загруженность, мало отыграно МП перед отпуском...',
          required: true,
        },
      ],
      submitText: 'Отклонить заявку',
      onSubmit: async (values) => {
        try {
          await api.post(`/leave/${leave.id}/review`, {
            approved: false,
            rejectionReason: values.rejectionReason,
          });
          modal.alert({
            title: 'Отклонено',
            message: 'Заявка отклонена с указанием причины.',
            type: 'info',
          });
          loadData();
        } catch (err: any) {
          modal.alert({
            title: 'Ошибка',
            message: err.response?.data?.error || 'Не удалось отклонить заявку',
            type: 'error',
          });
        }
      },
    });
  };

  return (
    <div className="space-y-6 w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
            <CalendarOff className="w-6 h-6 text-pink-500" />
            Отпуска и Отгулы состава
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Контроль отсутствия: обычный отпуск (1 - 14 дней) и отгул (5 мин - 24 ч) с таймером оставшегося времени
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-pink-600 to-rose-500 hover:from-pink-500 hover:to-rose-400 text-white rounded-xl text-xs font-semibold transition-all shadow-md shadow-pink-600/20"
          >
            <Plus className="w-4 h-4" />
            Оформить заявку
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-[#1E232F] pb-3">
        <button
          onClick={() => setTab('active')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
            tab === 'active'
              ? 'bg-gradient-to-r from-pink-600 to-rose-500 text-white shadow-md shadow-pink-600/20'
              : 'bg-[#151921] text-slate-400 hover:text-white border border-[#1E232F]'
          }`}
        >
          <Timer className="w-4 h-4 text-emerald-400" />
          <span>Сейчас в отпуске / отгуле</span>
          <span className="px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">
            {activeLeaves.length}
          </span>
        </button>

        <button
          onClick={() => setTab('requests')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
            tab === 'requests'
              ? 'bg-gradient-to-r from-pink-600 to-rose-500 text-white shadow-md shadow-pink-600/20'
              : 'bg-[#151921] text-slate-400 hover:text-white border border-[#1E232F]'
          }`}
        >
          <Clock className="w-4 h-4 text-amber-400" />
          <span>Заявки на рассмотрении</span>
          <span className="px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-bold">
            {requests.filter(r => r.status === 'PENDING').length}
          </span>
        </button>

        <button
          onClick={() => setTab('logs')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
            tab === 'logs'
              ? 'bg-gradient-to-r from-pink-600 to-rose-500 text-white shadow-md shadow-pink-600/20'
              : 'bg-[#151921] text-slate-400 hover:text-white border border-[#1E232F]'
          }`}
        >
          <History className="w-4 h-4 text-blue-400" />
          <span>Логи отпусков ({logs.length})</span>
        </button>

        <button
          onClick={() => setTab('panel')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
            tab === 'panel'
              ? 'bg-gradient-to-r from-pink-600 to-rose-500 text-white shadow-md shadow-pink-600/20'
              : 'bg-[#151921] text-slate-400 hover:text-white border border-[#1E232F]'
          }`}
        >
          <Send className="w-4 h-4 text-purple-400" />
          <span>Панель в Discord</span>
        </button>
      </div>

      {/* Tab 1: ACTIVE LEAVES & COUNTDOWN */}
      {tab === 'active' && (
        <div className="space-y-4">
          {loading ? (
            <div className="py-12 text-center text-slate-500 text-sm">Загрузка активных отсутствий...</div>
          ) : activeLeaves.length === 0 ? (
            <div className="bg-[#151921] border border-[#1E232F] rounded-2xl p-12 text-center">
              <UserCheck className="w-12 h-12 text-emerald-500/40 mx-auto mb-3" />
              <h3 className="text-white font-semibold text-sm">Все участники в строю!</h3>
              <p className="text-slate-400 text-xs mt-1">В данный момент ни у кого нет активного отпуска или отгула</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {activeLeaves.map((leave) => {
                const isVacation = leave.type !== 'TIMEOFF';
                const mainChar = leave.profile?.characters?.find((c: any) => c.isMain);
                const staticId = mainChar?.staticId || leave.profile?.staticId || '—';
                const charName = mainChar?.characterName || leave.profile?.characterName || '—';

                return (
                  <div
                    key={leave.id}
                    className="bg-[#151921] border border-[#1E232F] hover:border-pink-500/40 rounded-2xl p-5 flex flex-col justify-between transition-all shadow-lg"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                          isVacation 
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' 
                            : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                        }`}>
                          {isVacation ? '🏖️ Отпуск' : '⏱️ Отгул'}
                        </span>
                        <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-pink-500/10 text-pink-400 border border-pink-500/20">
                          ID: {staticId}
                        </span>
                      </div>

                      <h3 className="font-bold text-white text-sm">{leave.userTag}</h3>
                      <p className="text-[11px] text-slate-400 mb-3">
                        Персонаж: <span className="text-slate-200">{charName}</span>
                      </p>

                      {/* Countdown badge */}
                      <div className="p-3 rounded-xl bg-[#0B0E14] border border-[#1E232F] mb-3 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Timer className="w-4 h-4 text-pink-400 animate-pulse" />
                          <span className="text-xs text-slate-400">Осталось:</span>
                        </div>
                        <span className="text-sm font-bold text-white font-mono">
                          {leave.remainingText}
                        </span>
                      </div>

                      <div className="text-[11px] space-y-1 text-slate-400">
                        <div className="flex justify-between">
                          <span>Начало:</span>
                          <span className="text-slate-200">{new Date(leave.startDate).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' })}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Окончание:</span>
                          <span className="text-slate-200">{new Date(leave.endDate).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' })}</span>
                        </div>
                      </div>

                      <div className="mt-3 p-2.5 rounded-lg bg-[#0B0E14] text-[11px] text-slate-300 border border-[#1E232F]">
                        <span className="text-slate-500 block text-[10px] mb-0.5">Причина:</span>
                        {leave.reason}
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-[#1E232F] flex items-center justify-between text-[10px] text-slate-500">
                      <span>Одобрил: @{leave.reviewerTag || 'Руководство'}</span>
                      <span className="text-emerald-400 font-semibold">● Активен</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: REQUESTS ON REVIEW */}
      {tab === 'requests' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400 mr-2" />
            {['PENDING', 'APPROVED', 'REJECTED', 'ALL'].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  statusFilter === st
                    ? 'bg-pink-600 text-white'
                    : 'bg-[#151921] text-slate-400 hover:text-white border border-[#1E232F]'
                }`}
              >
                {st === 'PENDING' && '⏳ Ожидают проверки'}
                {st === 'APPROVED' && '✅ Одобренные'}
                {st === 'REJECTED' && '❌ Отклоненные'}
                {st === 'ALL' && 'Все заявки'}
              </button>
            ))}
          </div>

          <div className="bg-[#151921] border border-[#1E232F] rounded-2xl p-5">
            {loading ? (
              <div className="text-center py-10 text-slate-500 text-xs">Загрузка заявок...</div>
            ) : requests.length === 0 ? (
              <div className="text-center py-12">
                <CalendarOff className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                <p className="text-xs text-slate-400">Заявок по заданному фильтру не найдено</p>
              </div>
            ) : (
              <div className="space-y-3">
                {requests.map((leave) => {
                  const isVac = leave.type !== 'TIMEOFF';
                  const mainChar = leave.profile?.characters?.find((c: any) => c.isMain);
                  const staticId = mainChar?.staticId || leave.profile?.staticId;

                  return (
                    <div
                      key={leave.id}
                      className="p-4 bg-[#0B0E14] rounded-xl border border-[#1E232F] flex flex-col md:flex-row md:items-center justify-between gap-4"
                    >
                      <div className="space-y-1.5 flex-1">
                        <div className="flex items-center gap-2.5">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            isVac ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                          }`}>
                            {isVac ? '🏖️ Отпуск' : '⏱️ Отгул'}
                          </span>
                          <span className="font-bold text-white text-xs">{leave.userTag}</span>
                          {staticId && (
                            <span className="font-mono text-[11px] text-pink-400">[{staticId}]</span>
                          )}
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                            leave.status === 'APPROVED' ? 'bg-emerald-500/10 text-emerald-400' :
                            leave.status === 'REJECTED' ? 'bg-rose-500/10 text-rose-400' :
                            'bg-amber-500/10 text-amber-400'
                          }`}>
                            {leave.status === 'APPROVED' ? 'Одобрен' : leave.status === 'REJECTED' ? 'Отклонен' : 'На рассмотрении'}
                          </span>
                        </div>

                        <div className="text-xs text-slate-300 flex items-center gap-2">
                          <Calendar className="w-3.5 h-3.5 text-pink-400" />
                          <span>
                            {new Date(leave.startDate).toLocaleString('ru-RU')} — {new Date(leave.endDate).toLocaleString('ru-RU')}
                          </span>
                        </div>

                        <p className="text-xs text-slate-400 pt-1">
                          <strong className="text-slate-300">Причина:</strong> {leave.reason}
                        </p>

                        {leave.status === 'REJECTED' && leave.rejectionReason && (
                          <p className="text-xs text-rose-400/90 bg-rose-500/10 p-2 rounded border border-rose-500/20">
                            <strong>Причина отказа:</strong> {leave.rejectionReason}
                          </p>
                        )}
                      </div>

                      {leave.status === 'PENDING' && (
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => handleApprove(leave)}
                            className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 rounded-xl text-xs font-semibold transition-all"
                          >
                            <Check className="w-3.5 h-3.5" />
                            Одобрить
                          </button>
                          <button
                            onClick={() => handleReject(leave)}
                            className="flex items-center gap-1 px-3 py-1.5 bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 rounded-xl text-xs font-semibold transition-all"
                          >
                            <X className="w-3.5 h-3.5" />
                            Отклонить
                          </button>
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

      {/* Tab 3: LEAVE AUDIT LOGS */}
      {tab === 'logs' && (
        <div className="bg-[#151921] border border-[#1E232F] rounded-2xl overflow-hidden shadow-xl">
          <div className="p-4 border-b border-[#1E232F] bg-[#1A1F2B]/40 flex items-center justify-between">
            <h3 className="font-bold text-white text-xs flex items-center gap-2">
              <History className="w-4 h-4 text-pink-500" />
              Журнал решений руководства по отпускам и отгулам
            </h3>
            <span className="text-[11px] text-slate-400">Всего записей: {logs.length}</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#0B0E14] text-slate-400 uppercase font-semibold border-b border-[#1E232F]">
                <tr>
                  <th className="px-5 py-3.5">Боец</th>
                  <th className="px-5 py-3.5">Статик</th>
                  <th className="px-5 py-3.5">Тип</th>
                  <th className="px-5 py-3.5">Период</th>
                  <th className="px-5 py-3.5">Причина бойца</th>
                  <th className="px-5 py-3.5">Решение</th>
                  <th className="px-5 py-3.5">Проверил</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1E232F]">
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-8 text-center text-slate-500">
                      Журнал решений пуст
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => {
                    const isVac = log.type !== 'TIMEOFF';
                    const mainChar = log.profile?.characters?.find((c: any) => c.isMain);
                    const staticId = mainChar?.staticId || log.profile?.staticId || '—';

                    return (
                      <tr key={log.id} className="hover:bg-[#1E232F]/30 transition-colors">
                        <td className="px-5 py-3.5 font-bold text-white">{log.userTag}</td>
                        <td className="px-5 py-3.5 font-mono text-pink-400 font-semibold">{staticId}</td>
                        <td className="px-5 py-3.5">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            isVac ? 'bg-amber-500/10 text-amber-400' : 'bg-blue-500/10 text-blue-400'
                          }`}>
                            {isVac ? '🏖️ Отпуск' : '⏱️ Отгул'}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-slate-300">
                          {new Date(log.startDate).toLocaleDateString('ru-RU')} — {new Date(log.endDate).toLocaleDateString('ru-RU')}
                        </td>
                        <td className="px-5 py-3.5 text-slate-300 max-w-xs truncate" title={log.reason}>
                          {log.reason}
                        </td>
                        <td className="px-5 py-3.5">
                          {log.status === 'APPROVED' ? (
                            <span className="text-emerald-400 font-bold">✅ Одобрено</span>
                          ) : (
                            <span className="text-rose-400 font-bold" title={log.rejectionReason}>
                              ❌ Отказано
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-slate-400">
                          @{log.reviewerTag || 'Руководство'}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 4: DEPLOY DISCORD PANEL */}
      {tab === 'panel' && (
        <div className="bg-[#151921] border border-[#1E232F] rounded-2xl p-6 space-y-4 max-w-2xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-pink-500/10 border border-pink-500/20 flex items-center justify-center text-pink-400 shrink-0">
              <Send className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Интерактивная панель отпусков и отгулов</h3>
              <p className="text-xs text-slate-400">
                Отправьте в канал сообщение с двумя кнопками: «🏖️ Отпуск» и «⏱️ Отгул»
              </p>
            </div>
          </div>

          <div className="space-y-3 pt-2">
            <div>
              <label className="block text-xs text-slate-400 mb-1 font-medium">Канал для публикации панели:</label>
              <select
                value={deployChannelId}
                onChange={(e) => setDeployChannelId(e.target.value)}
                className="w-full bg-[#0B0E14] border border-[#1E232F] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-pink-500"
              >
                <option value="">Выберите канал...</option>
                {channels.map((ch) => (
                  <option key={ch.id} value={ch.id}>
                    #{ch.name}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={handleDeployPanel}
              disabled={deploying || !deployChannelId}
              className="flex items-center justify-center gap-2 px-5 py-2.5 bg-gradient-to-r from-pink-600 to-rose-500 hover:from-pink-500 hover:to-rose-400 text-white rounded-xl text-xs font-semibold shadow-lg shadow-pink-600/20 transition-all disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              <span>{deploying ? 'Отправка...' : 'Опубликовать панель в канал'}</span>
            </button>
          </div>
        </div>
      )}

      {/* CREATE LEAVE / TIMEOFF MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#151921] border border-[#1E232F] rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-[#1E232F] bg-[#1A1F2B]/50">
              <div className="flex items-center gap-2">
                <CalendarOff className="w-5 h-5 text-pink-500" />
                <h3 className="font-bold text-white text-sm">Оформить заявку на отсутствие</h3>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-1 rounded-lg hover:bg-[#1E232F] text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="p-5 space-y-4">
              {/* Type Switcher */}
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Тип отсутствия</label>
                <div className="grid grid-cols-2 gap-2 bg-[#0B0E14] p-1 rounded-xl border border-[#1E232F]">
                  <button
                    type="button"
                    onClick={() => setCreateType('VACATION')}
                    className={`py-2 px-3 rounded-lg text-xs font-semibold transition-all ${
                      createType === 'VACATION'
                        ? 'bg-gradient-to-r from-pink-600 to-rose-500 text-white shadow'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    🏖️ Отпуск (1 - 14 дн.)
                  </button>
                  <button
                    type="button"
                    onClick={() => setCreateType('TIMEOFF')}
                    className={`py-2 px-3 rounded-lg text-xs font-semibold transition-all ${
                      createType === 'TIMEOFF'
                        ? 'bg-gradient-to-r from-blue-600 to-indigo-500 text-white shadow'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    ⏱️ Отгул (5 мин - 24 ч)
                  </button>
                </div>
              </div>

              {/* Vacation Dates */}
              {createType === 'VACATION' ? (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Дата начала</label>
                    <input
                      type="date"
                      value={vacStart}
                      onChange={(e) => setVacStart(e.target.value)}
                      required
                      className="w-full bg-[#0B0E14] border border-[#1E232F] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-pink-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Дата окончания</label>
                    <input
                      type="date"
                      value={vacEnd}
                      onChange={(e) => setVacEnd(e.target.value)}
                      required
                      className="w-full bg-[#0B0E14] border border-[#1E232F] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-pink-500"
                    />
                  </div>
                </div>
              ) : (
                /* Time-off Duration */
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Часов (0-24)</label>
                    <input
                      type="number"
                      min="0"
                      max="24"
                      value={timeoffDurationHours}
                      onChange={(e) => setTimeoffDurationHours(e.target.value)}
                      required
                      className="w-full bg-[#0B0E14] border border-[#1E232F] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-pink-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Минут (0-59)</label>
                    <input
                      type="number"
                      min="0"
                      max="59"
                      value={timeoffDurationMinutes}
                      onChange={(e) => setTimeoffDurationMinutes(e.target.value)}
                      required
                      className="w-full bg-[#0B0E14] border border-[#1E232F] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-pink-500"
                    />
                  </div>
                </div>
              )}

              {/* Reason */}
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Причина отсутствия</label>
                <textarea
                  rows={3}
                  value={leaveReason}
                  onChange={(e) => setLeaveReason(e.target.value)}
                  placeholder="Сессия, работа, ремонт компьютера, личные дела..."
                  required
                  className="w-full bg-[#0B0E14] border border-[#1E232F] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-pink-500 resize-none"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl bg-[#1E232F] hover:bg-[#252B3B] text-slate-300 text-xs font-semibold"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-pink-600 to-rose-500 hover:from-pink-500 hover:to-rose-400 text-white text-xs font-semibold shadow-md shadow-pink-600/25 disabled:opacity-50"
                >
                  {submitting ? 'Отправка...' : 'Отправить заявку'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Leaves;
