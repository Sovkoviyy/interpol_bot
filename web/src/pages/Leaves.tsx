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
  Filter
} from 'lucide-react';
import api from '../api/client';
import { useModal } from '../context/ModalContext';

export const Leaves: React.FC = () => {
  const modal = useModal();
  const [requests, setRequests] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [loading, setLoading] = useState(true);

  const fetchLeaves = async () => {
    try {
      setLoading(true);
      const query = statusFilter !== 'ALL' ? `?status=${statusFilter}` : '';
      const res = await api.get(`/leave${query}`);
      setRequests(res.data.requests || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaves();
  }, [statusFilter]);

  const handleRequestLeave = () => {
    const today = new Date().toISOString().split('T')[0];
    const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];

    modal.form({
      title: 'Подать заявку на отпуск / неактив',
      message: 'Укажите даты начала и окончания отпуска, а также причину. При одобрении статус в профиле изменится на «В отпуске».',
      fields: [
        {
          name: 'startDate',
          label: 'Дата начала (ГГГГ-ММ-ДД)',
          placeholder: today,
          defaultValue: today,
          required: true,
        },
        {
          name: 'endDate',
          label: 'Дата окончания (ГГГГ-ММ-ДД)',
          placeholder: nextWeek,
          defaultValue: nextWeek,
          required: true,
        },
        {
          name: 'reason',
          label: 'Причина отпуска',
          placeholder: 'Сессия, командировка, отъезд из города...',
          required: true,
        },
      ],
      submitText: 'Отправить заявку',
      onSubmit: async (values) => {
        try {
          await api.post('/leave', values);
          modal.alert({
            title: 'Заявка отправлена',
            message: 'Заявка на отпуск зарегистрирована и ожидает проверки руководством.',
            type: 'success',
          });
          fetchLeaves();
        } catch (err: any) {
          modal.alert({
            title: 'Ошибка',
            message: err.response?.data?.error || 'Не удалось отправить заявку',
            type: 'error',
          });
        }
      },
    });
  };

  const handleApprove = (leave: any) => {
    modal.confirm({
      title: 'Одобрить отпуск?',
      message: `Одобрить отпуск для ${leave.userTag} с ${new Date(leave.startDate).toLocaleDateString('ru-RU')} по ${new Date(leave.endDate).toLocaleDateString('ru-RU')}?`,
      type: 'warning',
      confirmText: 'Да, одобрить',
      onConfirm: async () => {
        try {
          await api.post(`/leave/${leave.id}/review`, { approved: true });
          modal.alert({
            title: 'Одобрено',
            message: `Отпуск для ${leave.userTag} одобрен. Статус профиля переведен в неактив.`,
            type: 'success',
          });
          fetchLeaves();
        } catch (err: any) {
          modal.alert({
            title: 'Ошибка',
            message: err.response?.data?.error || 'Не удалось одобрить отпуск',
            type: 'error',
          });
        }
      },
    });
  };

  const handleReject = (leave: any) => {
    modal.form({
      title: 'Отклонить заявку на отпуск',
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
          fetchLeaves();
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Одобрен
          </span>
        );
      case 'REJECTED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-500/10 text-red-400 border border-red-500/20">
            <XCircle className="w-3.5 h-3.5" />
            Отклонен
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Clock className="w-3.5 h-3.5" />
            На рассмотрении
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
            <CalendarOff className="w-6 h-6 text-pink-500" />
            Отпуска и Неактив состава
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Контроль отсутствия бойцов, одобрение уважительных причин и заморозка активности
          </p>
        </div>
        <button
          onClick={handleRequestLeave}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-pink-600 to-pink-500 hover:from-pink-500 hover:to-pink-400 text-white rounded-xl text-sm font-semibold transition-all shadow-lg shadow-pink-500/20"
        >
          <Plus className="w-4 h-4" />
          Подать на отпуск
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 border-b border-dark-800 pb-3">
        <Filter className="w-4 h-4 text-gray-400 mr-2" />
        {['ALL', 'PENDING', 'APPROVED', 'REJECTED'].map((st) => (
          <button
            key={st}
            onClick={() => setStatusFilter(st)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              statusFilter === st
                ? 'bg-pink-600 text-white'
                : 'bg-dark-800/60 text-gray-400 hover:text-white hover:bg-dark-800'
            }`}
          >
            {st === 'ALL' && 'Все заявки'}
            {st === 'PENDING' && 'Ожидают проверки'}
            {st === 'APPROVED' && 'Одобренные'}
            {st === 'REJECTED' && 'Отклоненные'}
          </button>
        ))}
      </div>

      {/* Leaves List */}
      <div className="bg-dark-900/60 border border-dark-800 rounded-2xl p-6 backdrop-blur-sm">
        {loading ? (
          <div className="text-center py-10 text-gray-500 text-sm">Загрузка заявок...</div>
        ) : requests.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-dark-800 rounded-xl">
            <CalendarOff className="w-10 h-10 text-gray-600 mx-auto mb-3" />
            <p className="text-sm text-gray-400">Заявок на отпуск не найдено</p>
            <p className="text-xs text-gray-500 mt-1">Все участники находятся на службе</p>
          </div>
        ) : (
          <div className="space-y-4">
            {requests.map((leave) => {
              const start = new Date(leave.startDate);
              const end = new Date(leave.endDate);
              const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));

              return (
                <div
                  key={leave.id}
                  className="p-5 bg-dark-800/40 rounded-xl border border-dark-800 hover:border-pink-500/30 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-3">
                      <span className="font-semibold text-white text-base">{leave.userTag}</span>
                      <span className="font-mono text-xs text-gray-500">ID: {leave.userId}</span>
                      {getStatusBadge(leave.status)}
                    </div>

                    <div className="flex items-center gap-4 text-xs text-gray-300">
                      <div className="flex items-center gap-1.5 text-pink-400 font-medium">
                        <Calendar className="w-4 h-4" />
                        {start.toLocaleDateString('ru-RU')} — {end.toLocaleDateString('ru-RU')}
                        <span className="text-gray-400 font-normal">({days} дн.)</span>
                      </div>
                      <span className="text-gray-500">•</span>
                      <div className="text-gray-400">
                        Подано: {new Date(leave.createdAt).toLocaleString('ru-RU')}
                      </div>
                    </div>

                    <p className="text-sm text-gray-300 bg-dark-900/60 p-3 rounded-lg border border-dark-800/80">
                      <span className="text-xs text-gray-500 block mb-1">Причина отпуска:</span>
                      {leave.reason}
                    </p>

                    {leave.status === 'REJECTED' && leave.rejectionReason && (
                      <p className="text-xs text-red-400/90 bg-red-500/10 p-2.5 rounded-lg border border-red-500/20">
                        <strong>Причина отказа ({leave.reviewedByTag || 'Руководство'}):</strong>{' '}
                        {leave.rejectionReason}
                      </p>
                    )}

                    {leave.status === 'APPROVED' && leave.reviewedByTag && (
                      <p className="text-xs text-emerald-400/90">
                        ✓ Одобрено администратором <span className="font-medium text-white">{leave.reviewedByTag}</span>
                      </p>
                    )}
                  </div>

                  {leave.status === 'PENDING' && (
                    <div className="flex items-center gap-2 md:flex-col sm:flex-row shrink-0 justify-end">
                      <button
                        onClick={() => handleApprove(leave)}
                        className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600/90 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold transition-all shadow-md shadow-emerald-600/20"
                      >
                        <Check className="w-4 h-4" />
                        Одобрить
                      </button>
                      <button
                        onClick={() => handleReject(leave)}
                        className="flex items-center gap-1.5 px-3.5 py-2 bg-red-600/80 hover:bg-red-500 text-white rounded-xl text-xs font-semibold transition-all shadow-md shadow-red-600/20"
                      >
                        <X className="w-4 h-4" />
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
  );
};

export default Leaves;
