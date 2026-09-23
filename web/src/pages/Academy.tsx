import React, { useEffect, useState } from 'react';
import { 
  GraduationCap, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Settings2, 
  FileText, 
  Users, 
  Save, 
  ShieldAlert,
  ArrowUpRight,
  Clock,
  Sparkles,
  ExternalLink
} from 'lucide-react';
import api from '../api/client';
import { useModal } from '../context/ModalContext';

export const Academy: React.FC = () => {
  const modal = useModal();
  const [tab, setTab] = useState<'channels' | 'reports' | 'settings'>('channels');
  const [config, setConfig] = useState<any>(null);
  const [channels, setChannels] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [guildChannels, setGuildChannels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [reportFilter, setReportFilter] = useState('ALL');

  const fetchData = async () => {
    try {
      setLoading(true);
      const [cfgRes, chRes, repRes, rolesRes, gChRes] = await Promise.all([
        api.get('/academy/config'),
        api.get('/academy/channels'),
        api.get(`/academy/reports?status=${reportFilter}`),
        api.get('/guild/roles'),
        api.get('/guild/channels'),
      ]);
      setConfig(cfgRes.data.config);
      setChannels(chRes.data.channels || []);
      setReports(repRes.data.reports || []);
      setRoles(rolesRes.data.roles || []);
      setGuildChannels(gChRes.data.channels || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [reportFilter]);

  const handleSaveConfig = async () => {
    try {
      setSaving(true);
      await api.post('/academy/config', config);
      modal.alert({
        title: 'Успешно',
        message: 'Настройки академии успешно сохранены!',
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

  const handleReviewReport = async (reportId: string, approved: boolean) => {
    let rejectionReason = '';
    if (!approved) {
      const reason = prompt('Укажите причину отказа отчета:');
      if (reason === null) return;
      rejectionReason = reason;
    }

    try {
      await api.post(`/academy/reports/${reportId}/review`, {
        approved,
        rejectionReason,
      });
      modal.alert({
        title: approved ? 'Отчет одобрен' : 'Отчет отклонен',
        message: approved ? 'Отчет засчитан академику!' : 'Отчет отклонен.',
        type: approved ? 'success' : 'info',
      });
      fetchData();
    } catch (err: any) {
      modal.alert({
        title: 'Ошибка',
        message: err.response?.data?.error || 'Ошибка проверки отчета',
        type: 'error',
      });
    }
  };

  const handlePromote = async (channelId: string, approved: boolean) => {
    if (!approved) {
      modal.form({
        title: 'Отклонить повышение',
        message: 'Укажите причину отказа и количество штрафных МП, которые академик должен отыграть дополнительно:',
        fields: [
          {
            name: 'rejectionReason',
            label: 'Причина отказа',
            placeholder: 'Недостаточно активности, косяки в отчетах...',
            required: true,
          },
          {
            name: 'penaltyMp',
            label: 'Штрафные МП к норме',
            placeholder: '2',
            defaultValue: '2',
            required: true,
          },
        ],
        submitText: 'Отклонить и оштрафовать',
        onSubmit: async (values) => {
          try {
            await api.post(`/academy/channels/${channelId}/promote`, {
              approved: false,
              rejectionReason: values.rejectionReason,
              penaltyMp: parseInt(values.penaltyMp, 10) || 2,
            });
            modal.alert({
              title: 'Повышение отклонено',
              message: `Назначен штраф +${values.penaltyMp || 2} МП к норме.`,
              type: 'info',
            });
            fetchData();
          } catch (err: any) {
            modal.alert({
              title: 'Ошибка',
              message: err.response?.data?.error || 'Ошибка действия',
              type: 'error',
            });
          }
        },
      });
      return;
    }

    const confirmed = await modal.confirm({
      title: 'Повышение на 2 ранг',
      message: 'Одобрить повышение академика на 2 ранг? Бот снимет роль 1 ранга, выдаст роль 2 ранга (мейна) и заархивирует канал.',
      confirmText: 'Повысить',
      type: 'pink',
    });
    if (!confirmed) return;

    try {
      await api.post(`/academy/channels/${channelId}/promote`, {
        approved: true,
      });
      modal.alert({
        title: 'Повышение одобрено!',
        message: 'Академик успешно повышен на 2 ранг (Основной состав)!',
        type: 'success',
      });
      fetchData();
    } catch (err: any) {
      modal.alert({
        title: 'Ошибка',
        message: err.response?.data?.error || 'Ошибка действия',
        type: 'error',
      });
    }
  };

  const categories = guildChannels.filter((c) => c.type === 4);

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
            <GraduationCap className="w-6 h-6 text-pink-500" />
            Академия семьи и повышение (1 ➔ 2 ранг)
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Личные каналы академиков, проверка скриншотов с мероприятий, штрафы и подтверждение повышения
          </p>
        </div>

        {/* Tab switchers */}
        <div className="flex bg-[#0B0E14] p-1 rounded-xl border border-[#1E232F]">
          <button
            onClick={() => setTab('channels')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              tab === 'channels'
                ? 'bg-gradient-to-r from-pink-600 to-rose-500 text-white shadow-md shadow-pink-600/25'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Академики ({channels.filter(c => c.status === 'ACTIVE').length})
          </button>
          <button
            onClick={() => setTab('reports')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              tab === 'reports'
                ? 'bg-gradient-to-r from-pink-600 to-rose-500 text-white shadow-md shadow-pink-600/25'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Отчеты МП ({reports.filter(r => r.status === 'PENDING').length} новых)
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

      {tab === 'channels' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {loading ? (
              <div className="col-span-full py-12 text-center text-slate-500">Загрузка академиков...</div>
            ) : channels.length === 0 ? (
              <div className="col-span-full py-12 text-center text-slate-500">Академиков пока нет</div>
            ) : (
              channels.map((ch) => {
                const totalNeeded = ch.requiredMp + ch.penaltyMp;
                const percent = Math.min(100, Math.round((ch.approvedMpCount / totalNeeded) * 100));
                const isReady = ch.approvedMpCount >= totalNeeded;

                return (
                  <div
                    key={ch.id}
                    className={`bg-[#151921] border rounded-2xl p-5 flex flex-col justify-between transition-all ${
                      isReady && ch.status === 'ACTIVE'
                        ? 'border-pink-500/60 shadow-lg shadow-pink-600/10'
                        : 'border-[#1E232F]'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-pink-500/10 text-pink-400 border border-pink-500/20">
                          ID: {ch.staticId || '—'}
                        </span>
                        <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${
                          ch.status === 'ACTIVE' ? 'bg-amber-500/10 text-amber-400' : 'bg-emerald-500/10 text-emerald-400'
                        }`}>
                          {ch.status === 'ACTIVE' ? (isReady ? '🎉 Готов к повышению' : 'Обучение') : 'Повышен'}
                        </span>
                      </div>

                      <h3 className="font-bold text-white text-sm mb-1">{ch.userTag || ch.userId}</h3>
                      <p className="text-[11px] text-slate-400 mb-4">Канал: #{ch.channelId}</p>

                      {/* Progress bar */}
                      <div className="space-y-1.5 mb-4">
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-400">Сдано отчетов:</span>
                          <span className="font-bold text-white">{ch.approvedMpCount} / {totalNeeded} МП</span>
                        </div>
                        <div className="w-full h-2 bg-[#0B0E14] rounded-full overflow-hidden border border-[#1E232F]">
                          <div
                            className="h-full bg-gradient-to-r from-pink-600 to-rose-500 rounded-full transition-all"
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                        {ch.penaltyMp > 0 && (
                          <p className="text-[10px] text-rose-400">⚠️ Включая штраф: +{ch.penaltyMp} МП</p>
                        )}
                      </div>
                    </div>

                    {ch.status === 'ACTIVE' && (
                      <div className="pt-3 border-t border-[#1E232F] flex items-center justify-between gap-2">
                        <button
                          onClick={() => handlePromote(ch.id, true)}
                          className="flex-1 py-1.5 px-2 rounded-xl bg-gradient-to-r from-pink-600 to-rose-500 hover:from-pink-500 hover:to-rose-400 text-white text-xs font-semibold shadow-md shadow-pink-600/20 transition-all text-center"
                        >
                          Повысить на 2 ранг
                        </button>
                        <button
                          onClick={() => handlePromote(ch.id, false)}
                          className="py-1.5 px-2.5 rounded-xl bg-[#1E232F] hover:bg-rose-500/20 text-slate-300 hover:text-rose-300 text-xs font-semibold border border-slate-700/40 transition-all"
                          title="Добавить штрафные МП"
                        >
                          Штраф
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {tab === 'reports' && (
        <div className="space-y-4">
          <div className="flex gap-2">
            {['ALL', 'PENDING', 'APPROVED', 'REJECTED'].map((st) => (
              <button
                key={st}
                onClick={() => setReportFilter(st)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                  reportFilter === st
                    ? 'bg-pink-600/20 text-pink-300 border-pink-500/40'
                    : 'bg-[#151921] text-slate-400 border-[#1E232F] hover:text-white'
                }`}
              >
                {st === 'ALL' && 'Все отчеты'}
                {st === 'PENDING' && '⏳ На проверке'}
                {st === 'APPROVED' && '✅ Одобренные'}
                {st === 'REJECTED' && '❌ Отклоненные'}
              </button>
            ))}
          </div>

          <div className="bg-[#151921] border border-[#1E232F] rounded-2xl overflow-hidden shadow-xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#1E232F]/60 text-slate-400 uppercase tracking-wider font-semibold border-b border-[#1E232F]">
                <tr>
                  <th className="px-5 py-3.5">Академик</th>
                  <th className="px-5 py-3.5">Тип МП</th>
                  <th className="px-5 py-3.5">Скриншоты</th>
                  <th className="px-5 py-3.5">Статус</th>
                  <th className="px-5 py-3.5">Проверил</th>
                  <th className="px-5 py-3.5 text-right">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1E232F]">
                {reports.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-8 text-center text-slate-500">
                      Отчетов по заданному фильтру не найдено
                    </td>
                  </tr>
                ) : (
                  reports.map((r) => {
                    let urls: string[] = [];
                    try {
                      urls = JSON.parse(r.screenshotUrls || '[]');
                    } catch {}

                    return (
                      <tr key={r.id} className="hover:bg-[#1E232F]/30 transition-colors">
                        <td className="px-5 py-3.5 font-semibold text-white">
                          {r.userTag || r.userId}
                        </td>
                        <td className="px-5 py-3.5 font-bold text-pink-400">
                          {r.mpType}
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex gap-2">
                            {urls.map((u, i) => (
                              <a
                                key={i}
                                href={u}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-[11px] text-pink-400 hover:text-pink-300 underline"
                              >
                                Скрин #{i + 1} <ExternalLink className="w-3 h-3" />
                              </a>
                            ))}
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          {r.status === 'PENDING' && <span className="text-amber-400 font-semibold">⏳ На проверке</span>}
                          {r.status === 'APPROVED' && <span className="text-emerald-400 font-semibold">✅ Одобрен</span>}
                          {r.status === 'REJECTED' && <span className="text-rose-400 font-semibold">❌ Отклонен</span>}
                        </td>
                        <td className="px-5 py-3.5 text-slate-300">
                          {r.reviewerTag ? `@${r.reviewerTag}` : '—'}
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          {r.status === 'PENDING' && (
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => handleReviewReport(r.id, true)}
                                className="px-2.5 py-1 rounded-lg bg-emerald-600/20 text-emerald-300 border border-emerald-500/30 text-xs font-semibold hover:bg-emerald-600/30 transition-all"
                              >
                                Одобрить
                              </button>
                              <button
                                onClick={() => handleReviewReport(r.id, false)}
                                className="px-2.5 py-1 rounded-lg bg-rose-600/20 text-rose-300 border border-rose-500/30 text-xs font-semibold hover:bg-rose-600/30 transition-all"
                              >
                                Отклонить
                              </button>
                            </div>
                          )}
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

      {tab === 'settings' && (
        <div className="bg-[#151921] border border-[#1E232F] rounded-2xl p-6 space-y-4 max-w-3xl">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <Settings2 className="w-4 h-4 text-pink-500" />
            Настройки академии и повышения
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block text-slate-400 mb-1 font-medium">Категория для активных каналов академии</label>
              <select
                value={config?.categoryId || ''}
                onChange={(e) => setConfig({ ...config, categoryId: e.target.value })}
                className="w-full bg-[#0B0E14] border border-[#1E232F] rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-pink-500"
              >
                <option value="">Выберите категорию...</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>📁 {c.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-400 mb-1 font-medium">Категория для архива (после повышения)</label>
              <select
                value={config?.archiveCategoryId || ''}
                onChange={(e) => setConfig({ ...config, archiveCategoryId: e.target.value })}
                className="w-full bg-[#0B0E14] border border-[#1E232F] rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-pink-500"
              >
                <option value="">Выберите категорию архива...</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>📁 {c.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-400 mb-1 font-medium">Роль 1 ранга (Академик)</label>
              <select
                value={config?.academicRoleId || ''}
                onChange={(e) => setConfig({ ...config, academicRoleId: e.target.value })}
                className="w-full bg-[#0B0E14] border border-[#1E232F] rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-pink-500"
              >
                <option value="">Выберите роль 1 ранга...</option>
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>@{r.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-400 mb-1 font-medium">Роль 2 ранга (Основной состав)</label>
              <select
                value={config?.promotedRoleId || ''}
                onChange={(e) => setConfig({ ...config, promotedRoleId: e.target.value })}
                className="w-full bg-[#0B0E14] border border-[#1E232F] rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-pink-500"
              >
                <option value="">Выберите роль 2 ранга...</option>
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>@{r.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-400 mb-1 font-medium">Норма отыгранных МП для повышения</label>
              <input
                type="number"
                min={1}
                max={50}
                value={config?.requiredMpForRankUp || 10}
                onChange={(e) => setConfig({ ...config, requiredMpForRankUp: parseInt(e.target.value, 10) || 10 })}
                className="w-full bg-[#0B0E14] border border-[#1E232F] rounded-xl px-3 py-2 text-slate-200"
              />
            </div>

            <div>
              <label className="block text-slate-400 mb-1 font-medium">Префикс названия каналов</label>
              <input
                type="text"
                value={config?.channelPrefix || 'академик-'}
                onChange={(e) => setConfig({ ...config, channelPrefix: e.target.value })}
                className="w-full bg-[#0B0E14] border border-[#1E232F] rounded-xl px-3 py-2 text-slate-200"
              />
            </div>
          </div>

          <div className="pt-2">
            <button
              onClick={handleSaveConfig}
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-pink-600 to-rose-500 hover:from-pink-500 hover:to-rose-400 text-white font-semibold text-xs shadow-lg shadow-pink-600/25 transition-all disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>Сохранить настройки академии</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Academy;
