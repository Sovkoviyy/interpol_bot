import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { 
  UserPlus, 
  Send, 
  Save, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Plus, 
  Trash2, 
  Settings2, 
  FileText,
  Eye
} from 'lucide-react';
import api from '../api/client';
import { useModal } from '../context/ModalContext';
import { ChannelSelect } from '../components/ChannelSelect';
import { CustomSelect } from '../components/CustomSelect';

export const Recruitment: React.FC = () => {
  const modal = useModal();
  const [tab, setTab] = useState<'applications' | 'settings'>('applications');
  const [config, setConfig] = useState<any>(null);
  const [applications, setApplications] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [channels, setChannels] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedApp, setSelectedApp] = useState<any | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [configRes, appsRes, rolesRes, channelsRes] = await Promise.all([
        api.get('/recruitment/config'),
        api.get(`/recruitment/applications?status=${statusFilter}`),
        api.get('/guild/roles'),
        api.get('/guild/channels'),
      ]);
      setConfig(configRes.data.config);
      setApplications(appsRes.data.applications);
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

  const handleDeleteApp = async (app: any) => {
    const confirmed = await modal.confirm({
      title: 'Удаление заявки',
      message: `Вы действительно хотите удалить заявку кандидата ${app.userTag || app.userId}? Она будет безвозвратно удалена из базы данных и статистики рекрутера.`,
      confirmText: 'Удалить',
      type: 'danger',
    });
    if (!confirmed) return;

    try {
      await api.delete(`/recruitment/applications/${app.id}`);
      modal.alert({
        title: 'Успешно',
        message: 'Заявка успешно удалена!',
        type: 'success',
      });
      if (selectedApp?.id === app.id) setSelectedApp(null);
      fetchData();
    } catch (err: any) {
      modal.alert({
        title: 'Ошибка',
        message: err.response?.data?.error || 'Не удалось удалить заявку',
        type: 'error',
      });
    }
  };

  const handleBulkDelete = async (status: string) => {
    const statusLabel = status === 'ACCEPTED' ? 'одобренные' : status === 'REJECTED' ? 'отклоненные' : status;
    const confirmed = await modal.confirm({
      title: `Удаление всех заявок (${statusLabel})`,
      message: `Вы действительно хотите удалить ВСЕ ${statusLabel} заявки? Они будут удалены из базы данных и статистики.`,
      confirmText: 'Удалить все',
      type: 'danger',
    });
    if (!confirmed) return;

    try {
      const res = await api.post('/recruitment/applications/bulk-delete', { status });
      modal.alert({
        title: 'Успешно',
        message: `Удалено заявок: ${res.data.count || 0}`,
        type: 'success',
      });
      fetchData();
    } catch (err: any) {
      modal.alert({
        title: 'Ошибка',
        message: err.response?.data?.error || 'Не удалось удалить заявки',
        type: 'error',
      });
    }
  };

  const handleSaveConfig = async () => {
    try {
      setSaving(true);
      await api.post('/recruitment/config', config);
      modal.alert({
        title: 'Успешно',
        message: 'Настройки рекрутинга успешно сохранены!',
        type: 'success',
      });
    } catch (err) {
      modal.alert({
        title: 'Ошибка',
        message: 'Ошибка при сохранении настроек',
        type: 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  const handlePostPanel = async () => {
    if (!config?.channelId) {
      modal.alert({
        title: 'Внимание',
        message: 'Сначала выберите канал для публикации формы и сохраните настройки!',
        type: 'info',
      });
      return;
    }
    const confirmed = await modal.confirm({
      title: 'Публикация анкеты',
      message: 'Опубликовать сообщение с кнопкой «Подать заявку» в Discord?',
      confirmText: 'Опубликовать',
      type: 'pink',
    });
    if (!confirmed) return;

    try {
      setSaving(true);
      await api.post('/recruitment/post-panel');
      modal.alert({
        title: 'Успешно',
        message: 'Объявление о наборе успешно опубликовано в канале Discord!',
        type: 'success',
      });
    } catch (err: any) {
      modal.alert({
        title: 'Ошибка',
        message: err.response?.data?.error || 'Ошибка публикации',
        type: 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleAddQuestion = () => {
    if (!config.questions) config.questions = [];
    if (config.questions.length >= 5) {
      modal.alert({
        title: 'Лимит полей',
        message: 'В Discord можно добавить максимум 5 полей в модальное окно!',
        type: 'info',
      });
      return;
    }
    const newQ = {
      id: `q_${Date.now()}`,
      label: 'Новый вопрос',
      placeholder: '',
      required: true,
      style: 'SHORT',
      maxLength: 100,
    };
    setConfig({ ...config, questions: [...config.questions, newQ] });
  };

  const handleRemoveQuestion = (index: number) => {
    const updated = [...config.questions];
    updated.splice(index, 1);
    setConfig({ ...config, questions: updated });
  };

  const categories = channels.filter(c => c.type === 4); // GuildCategory
  const textChannels = channels.filter(c => c.type === 0); // GuildText

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
            <UserPlus className="w-6 h-6 text-pink-500" />
            Заявки в семью
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Управление процессом рекрутинга, просмотр анкет и настройка формы
          </p>
        </div>

        {/* Tab switcher */}
        <div className="flex bg-[#0B0E14] p-1 rounded-xl border border-[#1E232F]">
          <button
            onClick={() => setTab('applications')}
            className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all ${
              tab === 'applications'
                ? 'bg-gradient-to-r from-pink-600 to-rose-500 text-white shadow-md shadow-pink-600/25'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Список заявок ({applications.length})
          </button>
          <button
            onClick={() => setTab('settings')}
            className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all ${
              tab === 'settings'
                ? 'bg-gradient-to-r from-pink-600 to-rose-500 text-white shadow-md shadow-pink-600/25'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Настройки & Вопросы
          </button>
        </div>
      </div>

      {tab === 'applications' ? (
        /* Applications Tab */
        <div className="space-y-4">
          {/* Status filters */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex gap-2 flex-wrap">
              {['ALL', 'PENDING', 'UNDER_REVIEW', 'ACCEPTED', 'REJECTED'].map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                    statusFilter === st
                      ? 'bg-pink-600/20 text-pink-300 border-pink-500/40'
                      : 'bg-[#151921] text-slate-400 border-[#1E232F] hover:text-white'
                  }`}
                >
                  {st === 'ALL' && 'Все'}
                  {st === 'PENDING' && '⏳ Ожидают'}
                  {st === 'UNDER_REVIEW' && '🟡 На рассмотрении'}
                  {st === 'ACCEPTED' && '✅ Приняты'}
                  {st === 'REJECTED' && '❌ Отклонены'}
                </button>
              ))}
            </div>

            {/* Bulk action buttons for completed applications */}
            <div className="flex items-center gap-2">
              {statusFilter === 'ACCEPTED' && applications.length > 0 && (
                <button
                  onClick={() => handleBulkDelete('ACCEPTED')}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-600/10 hover:bg-red-600/20 text-red-400 border border-red-500/20 transition-all cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Удалить все одобренные</span>
                </button>
              )}
              {statusFilter === 'REJECTED' && applications.length > 0 && (
                <button
                  onClick={() => handleBulkDelete('REJECTED')}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-600/10 hover:bg-red-600/20 text-red-400 border border-red-500/20 transition-all cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Удалить все отклоненные</span>
                </button>
              )}
            </div>
          </div>

          {/* Table */}
          <div className="bg-[#151921] border border-[#1E232F] rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#1E232F]/60 text-slate-400 uppercase tracking-wider font-semibold border-b border-[#1E232F]">
                  <tr>
                    <th className="px-6 py-3.5">Кандидат</th>
                    <th className="px-6 py-3.5">Дата подачи</th>
                    <th className="px-6 py-3.5">Статус</th>
                    <th className="px-6 py-3.5">Рекрутер</th>
                    <th className="px-6 py-3.5 text-right">Действия</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1E232F]">
                  {applications.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                        Заявок по заданному фильтру не найдено
                      </td>
                    </tr>
                  ) : (
                    applications.map((app) => (
                      <tr key={app.id} className="hover:bg-[#1E232F]/30 transition-colors">
                        <td className="px-6 py-4">
                          <p className="font-semibold text-slate-100">{app.userTag || app.userId}</p>
                          <p className="text-[11px] text-slate-400">ID: {app.userId}</p>
                        </td>
                        <td className="px-6 py-4 text-slate-300">
                          {new Date(app.createdAt).toLocaleString('ru-RU')}
                        </td>
                        <td className="px-6 py-4">
                          {app.status === 'PENDING' && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                              <Clock className="w-3 h-3" /> Ожидает
                            </span>
                          )}
                          {app.status === 'UNDER_REVIEW' && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
                              🟡 В работе
                            </span>
                          )}
                          {app.status === 'ACCEPTED' && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              <CheckCircle className="w-3 h-3" /> Одобрена
                            </span>
                          )}
                          {app.status === 'REJECTED' && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-red-500/10 text-red-400 border border-red-500/20">
                              <XCircle className="w-3 h-3" /> Отклонена
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-slate-300">
                          {app.recruiterTag ? `@${app.recruiterTag}` : '—'}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => setSelectedApp(app)}
                              className="p-1.5 rounded-lg bg-[#1E232F] hover:bg-pink-600/20 text-pink-400 hover:text-pink-300 transition-colors inline-flex items-center gap-1 text-xs px-2.5 border border-transparent hover:border-pink-500/30 cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>Анкета</span>
                            </button>

                            <button
                              onClick={() => handleDeleteApp(app)}
                              title="Удалить заявку"
                              className="p-1.5 rounded-lg bg-[#1E232F] hover:bg-red-600/20 text-red-400 hover:text-red-300 transition-colors inline-flex items-center gap-1 text-xs px-2 border border-transparent hover:border-red-500/30 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">Удалить</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        /* Settings Tab */
        <div className="space-y-6 max-w-4xl">
          {/* Action Bar */}
          <div className="bg-[#151921] border border-[#1E232F] rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <button
                onClick={handleSaveConfig}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-pink-600 to-rose-500 hover:from-pink-500 hover:to-rose-400 text-white font-semibold text-xs transition-all shadow-lg shadow-pink-600/25 disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>Сохранить настройки</span>
              </button>

              <button
                onClick={handlePostPanel}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#1E232F] hover:bg-[#2A303F] text-slate-200 font-semibold text-xs border border-slate-700/50 transition-all hover:border-pink-500/40"
              >
                <Send className="w-4 h-4 text-pink-400" />
                <span>Опубликовать анкету в Discord</span>
              </button>
            </div>
          </div>

          {/* Channels & Roles Configuration */}
          <div className="bg-[#151921] border border-[#1E232F] rounded-2xl p-6 space-y-4">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Settings2 className="w-4 h-4 text-pink-500" />
              Привязка ролей и каналов
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block text-slate-400 mb-1 font-medium">Канал для объявления с кнопкой</label>
                <ChannelSelect
                  channels={channels}
                  channelType="text"
                  value={config?.channelId || ''}
                  onChange={(val) => setConfig({ ...config, channelId: val })}
                  placeholder="Выберите канал..."
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">Категория для тикетов (заявок)</label>
                <ChannelSelect
                  channels={channels}
                  channelType="category"
                  value={config?.categoryId || ''}
                  onChange={(val) => setConfig({ ...config, categoryId: val })}
                  placeholder="Выберите категорию..."
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">Канал для транскриптов и архива</label>
                <ChannelSelect
                  channels={channels}
                  channelType="text"
                  value={config?.logChannelId || ''}
                  onChange={(val) => setConfig({ ...config, logChannelId: val })}
                  placeholder="Выберите канал транскриптов..."
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-slate-400 mb-2 font-medium">
                  Роли участника семьи (выдаются при одобрении заявки — можно выбрать несколько)
                </label>
                <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto p-2.5 bg-[#0B0E14] border border-[#1E232F] rounded-xl">
                  {roles.map((r) => {
                    const currentRoles = config?.memberRoleIds || (config?.memberRoleId ? [config.memberRoleId] : []);
                    const isSelected = currentRoles.includes(r.id);
                    return (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => {
                          const updated = isSelected 
                            ? currentRoles.filter((id: string) => id !== r.id) 
                            : [...currentRoles, r.id];
                          setConfig({ 
                            ...config, 
                            memberRoleIds: updated, 
                            memberRoleId: updated[0] || null 
                          });
                        }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                          isSelected
                            ? 'bg-pink-600/25 text-pink-300 border-pink-500/60 font-semibold shadow-sm'
                            : 'bg-[#151921] text-slate-400 border-[#1E232F] hover:text-white'
                        }`}
                      >
                        {isSelected ? '✓ ' : '+ '}@{r.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Recruiter Roles Multi-select */}
            <div className="pt-2">
              <label className="block text-slate-400 mb-2 text-xs font-medium">
                Роли рекрутеров (имеют доступ к тикетам и кнопкам одобрения/отклонения)
              </label>
              <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto p-2 bg-[#0B0E14] border border-[#1E232F] rounded-xl">
                {roles.map((r) => {
                  const isSelected = config?.recruiterRoleIds?.includes(r.id);
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => {
                        const current = config.recruiterRoleIds || [];
                        const updated = isSelected ? current.filter((id: string) => id !== r.id) : [...current, r.id];
                        setConfig({ ...config, recruiterRoleIds: updated });
                      }}
                      className={`px-3 py-1 rounded-lg text-xs font-medium border transition-all ${
                        isSelected
                          ? 'bg-pink-600/20 text-pink-300 border-pink-500/50'
                          : 'bg-[#151921] text-slate-400 border-[#1E232F] hover:text-white'
                      }`}
                    >
                      @{r.name}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Form Questions Builder */}
          <div className="bg-[#151921] border border-[#1E232F] rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-white flex items-center gap-2">
                  <FileText className="w-4 h-4 text-pink-500" />
                  Конструктор вопросов формы (максимум 5 полей в Discord)
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Поля, которые кандидат заполняет при нажатии на кнопку «Подать заявку»
                </p>
              </div>

              {config?.questions?.length < 5 && (
                <button
                  type="button"
                  onClick={handleAddQuestion}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-pink-600/20 text-pink-300 border border-pink-500/30 text-xs font-semibold hover:bg-pink-600/30 transition-all"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Добавить вопрос</span>
                </button>
              )}
            </div>

            <div className="space-y-3">
              {config?.questions?.map((q: any, idx: number) => (
                <div key={q.id || idx} className="p-4 rounded-xl bg-[#0B0E14] border border-[#1E232F] flex flex-col md:flex-row items-start md:items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-[#1E232F] text-slate-400 font-bold text-xs flex items-center justify-center flex-shrink-0">
                    {idx + 1}
                  </span>

                  <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-3 w-full text-xs">
                    <div>
                      <label className="text-[10px] text-slate-500 uppercase font-semibold">Название вопроса</label>
                      <input
                        type="text"
                        value={q.label}
                        onChange={(e) => {
                          const updated = [...config.questions];
                          updated[idx].label = e.target.value;
                          setConfig({ ...config, questions: updated });
                        }}
                        className="w-full bg-[#151921] border border-[#1E232F] rounded-lg px-2.5 py-1.5 text-slate-200 mt-1"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] text-slate-500 uppercase font-semibold">Подсказка (Placeholder)</label>
                      <input
                        type="text"
                        value={q.placeholder || ''}
                        onChange={(e) => {
                          const updated = [...config.questions];
                          updated[idx].placeholder = e.target.value;
                          setConfig({ ...config, questions: updated });
                        }}
                        className="w-full bg-[#151921] border border-[#1E232F] rounded-lg px-2.5 py-1.5 text-slate-200 mt-1"
                      />
                    </div>

                    <div className="flex items-center gap-3 pt-4 md:pt-0">
                      <CustomSelect
                        options={[
                          { value: 'SHORT', label: 'Короткий ответ' },
                          { value: 'PARAGRAPH', label: 'Абзац (длинный)' },
                        ]}
                        value={q.style}
                        onChange={(val) => {
                          const updated = [...config.questions];
                          updated[idx].style = val;
                          setConfig({ ...config, questions: updated });
                        }}
                        searchable={false}
                        className="w-44"
                      />

                      <label className="inline-flex items-center gap-1.5 text-slate-400 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={q.required}
                          onChange={(e) => {
                            const updated = [...config.questions];
                            updated[idx].required = e.target.checked;
                            setConfig({ ...config, questions: updated });
                          }}
                          className="rounded border-[#1E232F] text-pink-600 focus:ring-0"
                        />
                        <span>Обязательный</span>
                      </label>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleRemoveQuestion(idx)}
                    className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Application Details Modal */}
      {selectedApp && createPortal(
        <div 
          className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200 overflow-y-auto"
          onClick={() => setSelectedApp(null)}
        >
          <div 
            className="w-full max-w-lg bg-[#151921] border border-[#1E232F] rounded-2xl p-6 shadow-2xl space-y-4 my-auto animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#1E232F] pb-3 shrink-0">
              <div>
                <h3 className="font-bold text-white text-base">Анкета кандидата</h3>
                <p className="text-xs text-slate-400">{selectedApp.userTag || selectedApp.userId}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedApp(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-[#1E232F]"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 overflow-y-auto custom-scrollbar flex-1 min-h-0 pr-1 text-xs">
              {Object.entries(selectedApp.answers || {}).map(([key, val]: any) => (
                <div key={key} className="p-3 rounded-xl bg-[#0B0E14] border border-[#1E232F]">
                  <p className="text-slate-400 font-medium mb-1">{key}</p>
                  <p className="text-slate-100 whitespace-pre-wrap font-semibold">{val || '—'}</p>
                </div>
              ))}

              {selectedApp.rejectionReason && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400">
                  <p className="font-semibold mb-0.5">Причина отказа:</p>
                  <p>{selectedApp.rejectionReason}</p>
                </div>
              )}
            </div>

            <div className="pt-2 flex justify-between items-center border-t border-[#1E232F] shrink-0">
              <button
                type="button"
                onClick={() => handleDeleteApp(selectedApp)}
                className="px-3.5 py-2 rounded-xl bg-red-600/15 hover:bg-red-600/25 text-red-400 hover:text-red-300 text-xs font-semibold border border-red-500/30 flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Удалить заявку</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedApp(null)}
                className="px-4 py-2 rounded-xl bg-[#1E232F] hover:bg-[#252B3B] text-slate-300 hover:text-white text-xs font-medium cursor-pointer transition-all"
              >
                Закрыть
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default Recruitment;
