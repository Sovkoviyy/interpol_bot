import React, { useEffect, useState } from 'react';
import { 
  Target, 
  Video, 
  CheckCircle2, 
  Clock, 
  ExternalLink, 
  FolderTree, 
  Trash2,
  Pencil,
  Ticket,
  Save,
  X,
  MessageSquare
} from 'lucide-react';
import api from '../api/client';
import { useModal } from '../context/ModalContext';
import { CustomSelect } from '../components/CustomSelect';

export const Tier: React.FC = () => {
  const modal = useModal();
  const [activeTab, setActiveTab] = useState<'submissions' | 'tickets'>('submissions');
  const [config, setConfig] = useState<any>(null);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'ALL' | 'PENDING' | 'REVIEWED'>('ALL');
  const [mpFilter, setMpFilter] = useState<string>('ALL');

  // Edit Submission Modal
  const [editingSub, setEditingSub] = useState<any | null>(null);
  const [subStatus, setSubStatus] = useState<'PENDING' | 'REVIEWED'>('PENDING');
  const [subComment, setSubComment] = useState('');
  const [savingSub, setSavingSub] = useState(false);

  // Edit Ticket Modal
  const [editingTicket, setEditingTicket] = useState<any | null>(null);
  const [ticketStatus, setTicketStatus] = useState<'OPEN' | 'CLOSED'>('OPEN');
  const [savingTicket, setSavingTicket] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [cfgRes, subRes, tktRes] = await Promise.all([
        api.get('/tier/config'),
        api.get('/tier/submissions'),
        api.get('/tier/tickets'),
      ]);
      setConfig(cfgRes.data.config);
      setSubmissions(subRes.data.submissions || []);
      setTickets(tktRes.data.tickets || []);
    } catch (err: any) {
      console.error('Failed to fetch tier data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSetup = async () => {
    const confirmed = await modal.confirm({
      title: 'Развернуть структуру сдачи откатов с МП?',
      message: 'Бот автоматически создаст категорию «ОТКАТЫ С МП», канал «сдать-откат» с интерактивной кнопкой подачи, закрытый канал «разбор-откатов» и роль «Чекер откатов».',
      confirmText: 'Развернуть структуру',
      type: 'pink',
    });
    if (!confirmed) return;

    try {
      setLoading(true);
      await api.post('/tier/setup');
      modal.alert({
        title: 'Успешно!',
        message: 'Категория, каналы и роль чекеров успешно созданы в Discord!',
        type: 'success',
      });
      fetchData();
    } catch (err: any) {
      modal.alert({
        title: 'Ошибка',
        message: err.response?.data?.error || 'Не удалось развернуть структуру',
        type: 'error',
      });
      setLoading(false);
    }
  };

  // Submissions operations
  const handleOpenEditSub = (sub: any) => {
    setEditingSub(sub);
    setSubStatus(sub.status || 'PENDING');
    setSubComment(sub.reviewerComment || '');
  };

  const handleSaveSub = async () => {
    if (!editingSub) return;
    try {
      setSavingSub(true);
      await api.put(`/tier/submissions/${editingSub.id}`, {
        status: subStatus,
        reviewerComment: subComment,
      });
      modal.alert({
        title: 'Успешно',
        message: 'Статус и разбор отката успешно обновлены!',
        type: 'success',
      });
      setEditingSub(null);
      fetchData();
    } catch (err: any) {
      modal.alert({
        title: 'Ошибка',
        message: err.response?.data?.error || 'Не удалось сохранить изменения',
        type: 'error',
      });
    } finally {
      setSavingSub(false);
    }
  };

  const handleDeleteSub = async (sub: any) => {
    const confirmed = await modal.confirm({
      title: 'Удалить этот откат?',
      message: `Вы действительно хотите удалить откат [${sub.mpType}] от пользователя ${sub.userTag || sub.userId}? Это удалит запись из базы данных.`,
      confirmText: 'Да, удалить',
      type: 'danger',
    });
    if (!confirmed) return;

    try {
      await api.delete(`/tier/submissions/${sub.id}`);
      modal.alert({
        title: 'Удалено',
        message: 'Откат успешно удален из системы.',
        type: 'success',
      });
      fetchData();
    } catch (err: any) {
      modal.alert({
        title: 'Ошибка',
        message: err.response?.data?.error || 'Не удалось удалить откат',
        type: 'error',
      });
    }
  };

  // Tickets operations
  const handleOpenEditTicket = (tkt: any) => {
    setEditingTicket(tkt);
    setTicketStatus(tkt.status || 'OPEN');
  };

  const handleSaveTicket = async () => {
    if (!editingTicket) return;
    try {
      setSavingTicket(true);
      await api.put(`/tier/tickets/${editingTicket.id}`, {
        status: ticketStatus,
      });
      modal.alert({
        title: 'Успешно',
        message: 'Статус тикета успешно обновлен!',
        type: 'success',
      });
      setEditingTicket(null);
      fetchData();
    } catch (err: any) {
      modal.alert({
        title: 'Ошибка',
        message: err.response?.data?.error || 'Не удалось обновить тикет',
        type: 'error',
      });
    } finally {
      setSavingTicket(false);
    }
  };

  const handleDeleteTicket = async (tkt: any) => {
    const confirmed = await modal.confirm({
      title: 'Удалить тикет участника?',
      message: `Вы действительно хотите удалить тикет пользователя ${tkt.userTag || tkt.userId}? Это удалит все сданные им откаты и сотрет канал в Discord.`,
      confirmText: 'Да, удалить тикет',
      type: 'danger',
    });
    if (!confirmed) return;

    try {
      await api.delete(`/tier/tickets/${tkt.id}`);
      modal.alert({
        title: 'Удалено',
        message: 'Тикет кандидата и канал успешно удалены.',
        type: 'success',
      });
      fetchData();
    } catch (err: any) {
      modal.alert({
        title: 'Ошибка',
        message: err.response?.data?.error || 'Не удалось удалить тикет',
        type: 'error',
      });
    }
  };

  const filteredSubmissions = submissions.filter((sub) => {
    if (filter === 'PENDING' && sub.status !== 'PENDING') return false;
    if (filter === 'REVIEWED' && sub.status !== 'REVIEWED') return false;
    if (mpFilter !== 'ALL' && sub.mpType !== mpFilter) return false;
    return true;
  });

  const pendingCount = submissions.filter((s) => s.status === 'PENDING').length;
  const reviewedCount = submissions.filter((s) => s.status === 'REVIEWED').length;

  return (
    <div className="space-y-6 w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-pink-500/10 border border-pink-500/20 text-pink-400">
              <Target className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                Разбор откатов с МП
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-pink-500/20 text-pink-300 font-mono font-bold border border-pink-500/30">
                  ОТКАТЫ
                </span>
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                Сдача видеозаписей с мероприятий (Капт, ВЗЗ / МЦЛ, Арена, РП), разбор ошибок опытными игроками и рекомендации
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={handleSetup}
          disabled={loading}
          className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-pink-600 to-rose-500 hover:from-pink-500 hover:to-rose-400 text-white rounded-xl text-xs font-bold shadow-lg shadow-pink-600/25 transition-all whitespace-nowrap disabled:opacity-50"
        >
          <FolderTree className="w-4 h-4" />
          <span>Развернуть структуру в Discord</span>
        </button>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-[#151921] border border-[#1E232F] rounded-2xl p-5 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-pink-500/10 text-pink-400">
            <Video className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-white">{submissions.length}</div>
            <div className="text-xs text-slate-400 font-medium">Всего сдано откатов</div>
          </div>
        </div>

        <div className="bg-[#151921] border border-[#1E232F] rounded-2xl p-5 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-amber-500/10 text-amber-400">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-amber-300">{pendingCount}</div>
            <div className="text-xs text-slate-400 font-medium">Ожидают разбора</div>
          </div>
        </div>

        <div className="bg-[#151921] border border-[#1E232F] rounded-2xl p-5 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-400">
            <Ticket className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-emerald-300">{tickets.length}</div>
            <div className="text-xs text-slate-400 font-medium">Участников / Тикетов</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[#1E232F] gap-2">
        <button
          onClick={() => setActiveTab('submissions')}
          className={`pb-3 px-4 text-xs font-semibold flex items-center gap-2 border-b-2 transition-all ${
            activeTab === 'submissions'
              ? 'border-pink-500 text-pink-400'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <Video className="w-4 h-4" />
          <span>Откаты участников ({submissions.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('tickets')}
          className={`pb-3 px-4 text-xs font-semibold flex items-center gap-2 border-b-2 transition-all ${
            activeTab === 'tickets'
              ? 'border-pink-500 text-pink-400'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <Ticket className="w-4 h-4" />
          <span>Участники и Тикеты ({tickets.length})</span>
        </button>
      </div>

      {/* Tab: Submissions */}
      {activeTab === 'submissions' && (
        <div className="bg-[#151921] border border-[#1E232F] rounded-2xl p-6 space-y-5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Video className="w-4 h-4 text-pink-400" />
                Откаты участников
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Все видеозаписи, отправленные в ветки мероприятий (Капт, ВЗЗ / МЦЛ, Арена, РП)
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex bg-[#0B0E14] border border-[#1E232F] rounded-xl p-1 text-xs">
                <button
                  onClick={() => setFilter('ALL')}
                  className={`px-3 py-1 rounded-lg font-medium transition-all ${
                    filter === 'ALL' ? 'bg-pink-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Все ({submissions.length})
                </button>
                <button
                  onClick={() => setFilter('PENDING')}
                  className={`px-3 py-1 rounded-lg font-medium transition-all ${
                    filter === 'PENDING' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Ожидают ({pendingCount})
                </button>
                <button
                  onClick={() => setFilter('REVIEWED')}
                  className={`px-3 py-1 rounded-lg font-medium transition-all ${
                    filter === 'REVIEWED' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Разобраны ({reviewedCount})
                </button>
              </div>

              <div className="w-44">
                <CustomSelect
                  value={mpFilter}
                  onChange={(val) => setMpFilter(val)}
                  searchable={false}
                  options={[
                    { value: 'ALL', label: 'Все МП' },
                    { value: 'Капт', label: 'Капт' },
                    { value: 'ВЗЗ / МЦЛ', label: 'ВЗЗ / МЦЛ' },
                    { value: 'Арена', label: 'Арена' },
                    { value: 'РП', label: 'РП' },
                  ]}
                />
              </div>
            </div>
          </div>

          {/* List of Submissions */}
          {loading ? (
            <div className="py-12 text-center text-slate-500 text-xs">Загрузка данных...</div>
          ) : filteredSubmissions.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-xs bg-[#0B0E14] rounded-xl border border-[#1E232F]">
              Откатов в данной категории пока нет
            </div>
          ) : (
            <div className="space-y-3">
              {filteredSubmissions.map((sub) => (
                <div
                  key={sub.id}
                  className="bg-[#0B0E14] border border-[#1E232F] rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-slate-700/60 transition-all"
                >
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs px-2.5 py-0.5 rounded-full bg-pink-500/10 text-pink-400 font-bold border border-pink-500/20">
                        {sub.mpType}
                      </span>
                      <span className="text-sm font-semibold text-white">
                        {sub.userTag || sub.userId}
                      </span>
                      <span
                        className={`text-[11px] px-2 py-0.5 rounded font-medium ${
                          sub.status === 'REVIEWED'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        }`}
                      >
                        {sub.status === 'REVIEWED' ? 'Разобран' : 'Ожидает разбора'}
                      </span>
                    </div>

                    {sub.comment && (
                      <p className="text-xs text-slate-300 italic">
                        «{sub.comment}»
                      </p>
                    )}

                    {sub.status === 'REVIEWED' && sub.reviewerComment && (
                      <div className="text-xs text-emerald-400 bg-emerald-500/5 border border-emerald-500/10 rounded-lg p-2 mt-1">
                        <strong>Разбор ошибок ({sub.reviewerTag || 'Проверяющий'}):</strong>{' '}
                        {sub.reviewerComment}
                      </div>
                    )}

                    <div className="text-[11px] text-slate-500">
                      Отправлено: {new Date(sub.createdAt).toLocaleString('ru-RU')}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-start md:self-center shrink-0">
                    <a
                      href={sub.clipUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1E232F] hover:bg-slate-700/60 text-slate-200 rounded-lg text-xs font-medium transition-all"
                    >
                      <ExternalLink className="w-3.5 h-3.5 text-pink-400" />
                      <span>Смотреть откат</span>
                    </a>

                    <button
                      onClick={() => handleOpenEditSub(sub)}
                      className="p-1.5 rounded-lg bg-[#1E232F] hover:bg-slate-700/60 text-slate-300 hover:text-white border border-slate-700/40 transition-colors"
                      title="Редактировать статус / разбор"
                    >
                      <Pencil className="w-3.5 h-3.5 text-slate-400" />
                    </button>

                    <button
                      onClick={() => handleDeleteSub(sub)}
                      className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 border border-rose-500/20 transition-colors"
                      title="Удалить откат (рофл/спам)"
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

      {/* Tab: Tickets */}
      {activeTab === 'tickets' && (
        <div className="bg-[#151921] border border-[#1E232F] rounded-2xl p-6 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Ticket className="w-4 h-4 text-pink-400" />
                Участники и Тикеты
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Приватные каналы участников для сдачи откатов с мероприятий
              </p>
            </div>
          </div>

          {loading ? (
            <div className="py-12 text-center text-slate-500 text-xs">Загрузка тикетов...</div>
          ) : tickets.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-xs bg-[#0B0E14] rounded-xl border border-[#1E232F]">
              Активных тикетов кандидатов пока нет
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {tickets.map((tkt) => (
                <div
                  key={tkt.id}
                  className="bg-[#0B0E14] border border-[#1E232F] rounded-2xl p-5 flex flex-col justify-between hover:border-slate-700/60 transition-all space-y-4"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-full bg-pink-500/10 text-pink-400 border border-pink-500/20">
                        Тикет #{tkt.id.slice(-6)}
                      </span>
                      <span
                        className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                          tkt.status === 'OPEN'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-slate-700/30 text-slate-400 border border-slate-700/50'
                        }`}
                      >
                        {tkt.status === 'OPEN' ? '🟢 Открыт' : '🔒 Закрыт'}
                      </span>
                    </div>

                    <h3 className="font-bold text-white text-sm">{tkt.userTag || tkt.userId}</h3>
                    <p className="text-xs text-slate-400">Канал Discord: #{tkt.channelId}</p>

                    <div className="pt-2 text-xs text-slate-300 flex items-center justify-between">
                      <span>Сдано откатов:</span>
                      <span className="font-bold text-pink-400">{tkt.submissions?.length || 0} шт.</span>
                    </div>

                    <div className="text-[10px] text-slate-500">
                      Создан: {new Date(tkt.createdAt).toLocaleString('ru-RU')}
                    </div>
                  </div>

                  <div className="pt-3 border-t border-[#1E232F] flex items-center justify-end gap-2">
                    <button
                      onClick={() => handleOpenEditTicket(tkt)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#1E232F] hover:bg-slate-700/60 text-slate-200 text-xs font-semibold border border-slate-700/40 transition-all"
                    >
                      <Pencil className="w-3.5 h-3.5 text-slate-400" />
                      <span>Изменить</span>
                    </button>

                    <button
                      onClick={() => handleDeleteTicket(tkt)}
                      className="p-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 transition-all"
                      title="Удалить тикет участника"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Edit Submission Modal */}
      {editingSub && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#151921] border border-[#1E232F] rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#1E232F] pb-3">
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                <Pencil className="w-4 h-4 text-pink-400" />
                Редактировать разбор отката
              </h3>
              <button
                onClick={() => setEditingSub(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Участник / МП</label>
                <div className="p-2.5 rounded-xl bg-[#0B0E14] border border-[#1E232F] text-slate-200 font-semibold flex items-center justify-between">
                  <span>{editingSub.userTag || editingSub.userId}</span>
                  <span className="text-pink-400">{editingSub.mpType}</span>
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Статус разбора</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setSubStatus('PENDING')}
                    className={`p-2.5 rounded-xl border text-center font-semibold transition-all ${
                      subStatus === 'PENDING'
                        ? 'bg-amber-600/20 border-amber-500 text-amber-300'
                        : 'bg-[#0B0E14] border-[#1E232F] text-slate-400'
                    }`}
                  >
                    ⏳ Ожидает разбора
                  </button>
                  <button
                    type="button"
                    onClick={() => setSubStatus('REVIEWED')}
                    className={`p-2.5 rounded-xl border text-center font-semibold transition-all ${
                      subStatus === 'REVIEWED'
                        ? 'bg-emerald-600/20 border-emerald-500 text-emerald-300'
                        : 'bg-[#0B0E14] border-[#1E232F] text-slate-400'
                    }`}
                  >
                    ✅ Разобран
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Разбор ошибок и рекомендации проверяющего</label>
                <textarea
                  rows={4}
                  value={subComment}
                  onChange={(e) => setSubComment(e.target.value)}
                  placeholder="например: Хороший аим, но на 1:20 не заходи в упор без укрытия..."
                  className="w-full bg-[#0B0E14] border border-[#1E232F] rounded-xl p-3 text-white placeholder-slate-600 focus:outline-none focus:border-pink-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#1E232F]">
              <button
                type="button"
                onClick={() => setEditingSub(null)}
                className="px-4 py-2 rounded-xl bg-[#1E232F] hover:bg-slate-700/60 text-slate-300 text-xs font-semibold transition-all"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={handleSaveSub}
                disabled={savingSub}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-pink-600 hover:bg-pink-500 text-white text-xs font-semibold shadow-lg shadow-pink-600/20 transition-all"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{savingSub ? 'Сохранение...' : 'Сохранить'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Ticket Modal */}
      {editingTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#151921] border border-[#1E232F] rounded-2xl p-6 w-full max-w-sm shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#1E232F] pb-3">
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                <Ticket className="w-4 h-4 text-pink-400" />
                Статус тикета участника
              </h3>
              <button
                onClick={() => setEditingTicket(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <p className="text-slate-300">
                Участник: <strong>{editingTicket.userTag || editingTicket.userId}</strong>
              </p>

              <div>
                <label className="block text-slate-400 mb-1">Статус тикета</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setTicketStatus('OPEN')}
                    className={`p-2.5 rounded-xl border text-center font-semibold transition-all ${
                      ticketStatus === 'OPEN'
                        ? 'bg-emerald-600/20 border-emerald-500 text-emerald-300'
                        : 'bg-[#0B0E14] border-[#1E232F] text-slate-400'
                    }`}
                  >
                    🟢 Открыт
                  </button>
                  <button
                    type="button"
                    onClick={() => setTicketStatus('CLOSED')}
                    className={`p-2.5 rounded-xl border text-center font-semibold transition-all ${
                      ticketStatus === 'CLOSED'
                        ? 'bg-rose-600/20 border-rose-500 text-rose-300'
                        : 'bg-[#0B0E14] border-[#1E232F] text-slate-400'
                    }`}
                  >
                    🔒 Закрыт
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#1E232F]">
              <button
                type="button"
                onClick={() => setEditingTicket(null)}
                className="px-4 py-2 rounded-xl bg-[#1E232F] hover:bg-slate-700/60 text-slate-300 text-xs font-semibold transition-all"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={handleSaveTicket}
                disabled={savingTicket}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-pink-600 hover:bg-pink-500 text-white text-xs font-semibold shadow-lg shadow-pink-600/20 transition-all"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{savingTicket ? 'Сохранение...' : 'Сохранить'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Tier;
