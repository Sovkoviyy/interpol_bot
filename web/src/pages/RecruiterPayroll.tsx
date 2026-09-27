import React, { useEffect, useState } from 'react';
import { 
  Coins, 
  Settings2, 
  Save, 
  Calendar, 
  CheckCircle, 
  Trophy, 
  Download,
  Users,
  Check,
  XCircle,
  Award,
  Copy,
  FileText,
  AlertTriangle,
  RotateCcw,
  Trash2,
  Eye,
  RefreshCw
} from 'lucide-react';
import api from '../api/client';
import { useModal } from '../context/ModalContext';

export const RecruiterPayroll: React.FC = () => {
  const modal = useModal();
  const [tab, setTab] = useState<'payroll' | 'rates'>('payroll');
  const [config, setConfig] = useState<any>(null);
  const [payrollData, setPayrollData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);

  // Period filters
  const [daysWindow, setDaysWindow] = useState(7); // 7 days (week), 30 days (month)

  // Recruiter applications view/delete modal
  const [selectedRecruiterForApps, setSelectedRecruiterForApps] = useState<any | null>(null);
  const [recruiterApps, setRecruiterApps] = useState<any[]>([]);
  const [recruiterAppsLoading, setRecruiterAppsLoading] = useState(false);
  const [recruiterAppsFilter, setRecruiterAppsFilter] = useState<'ALL' | 'ACCEPTED' | 'REJECTED'>('ALL');

  // Export Modal
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportComment, setExportComment] = useState('Премия');
  const [exportOnlyPositive, setExportOnlyPositive] = useState(true);
  const [copied, setCopied] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const end = new Date();
      const start = new Date(Date.now() - daysWindow * 24 * 3600 * 1000);

      const [cfgRes, payRes] = await Promise.all([
        api.get('/payroll/config'),
        api.get(`/payroll/calculate?start=${start.toISOString()}&end=${end.toISOString()}`),
      ]);
      setConfig(cfgRes.data.config);
      setPayrollData(payRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [daysWindow]);

  const handleOpenRecruiterApps = async (recruiter: any) => {
    setSelectedRecruiterForApps(recruiter);
    setRecruiterAppsFilter('ALL');
    await fetchRecruiterApps(recruiter.recruiterId);
  };

  const fetchRecruiterApps = async (recruiterId: string) => {
    try {
      setRecruiterAppsLoading(true);
      const end = new Date();
      const start = new Date(Date.now() - daysWindow * 24 * 3600 * 1000);
      const res = await api.get(`/recruitment/applications?recruiterId=${recruiterId}&start=${start.toISOString()}&end=${end.toISOString()}&limit=200`);
      setRecruiterApps(res.data.applications || []);
    } catch (err) {
      console.error(err);
    } finally {
      setRecruiterAppsLoading(false);
    }
  };

  const handleDeleteAppFromStats = async (appId: string, userTag?: string) => {
    const confirmed = await modal.confirm({
      title: 'Удаление заявки из статистики',
      message: `Удалить заявку кандидата ${userTag || 'кандидата'}? Она будет безвозвратно удалена из базы данных и статистики рекрутера.`,
      confirmText: 'Удалить',
      type: 'danger',
    });
    if (!confirmed) return;

    try {
      await api.delete(`/recruitment/applications/${appId}`);
      modal.alert({ title: 'Успешно', message: 'Заявка успешно удалена!', type: 'success' });
      if (selectedRecruiterForApps) {
        await fetchRecruiterApps(selectedRecruiterForApps.recruiterId);
      }
      fetchData();
    } catch (err: any) {
      modal.alert({ title: 'Ошибка', message: err.response?.data?.error || 'Не удалось удалить заявку', type: 'error' });
    }
  };

  const handleBulkDeleteRecruiterApps = async (status: 'ACCEPTED' | 'REJECTED') => {
    if (!selectedRecruiterForApps) return;
    const statusLabel = status === 'ACCEPTED' ? 'одобренные' : 'отклоненные';
    const confirmed = await modal.confirm({
      title: `Удаление заявок (${statusLabel})`,
      message: `Вы действительно хотите удалить ВСЕ ${statusLabel} заявки рекрутера @${selectedRecruiterForApps.recruiterTag || selectedRecruiterForApps.recruiterId}? Они будут удалены из базы данных и статистики.`,
      confirmText: 'Удалить все',
      type: 'danger',
    });
    if (!confirmed) return;

    try {
      const res = await api.post('/recruitment/applications/bulk-delete', {
        recruiterId: selectedRecruiterForApps.recruiterId,
        status,
      });
      modal.alert({ title: 'Успешно', message: `Удалено ${res.data.count || 0} заявок`, type: 'success' });
      await fetchRecruiterApps(selectedRecruiterForApps.recruiterId);
      fetchData();
    } catch (err: any) {
      modal.alert({ title: 'Ошибка', message: err.response?.data?.error || 'Ошибка удаления', type: 'error' });
    }
  };

  const handleResetAllStats = async () => {
    const confirmed = await modal.confirm({
      title: 'Обнуление статистики всех рекрутеров',
      message: 'Вы действительно хотите обнулить текущую статистику всех рекрутеров? С этого момента счетчики будут обнулены, а отсчет начнется заново.',
      confirmText: 'Обнулить статистику',
      type: 'danger',
    });
    if (!confirmed) return;

    try {
      setResetting(true);
      await api.post('/payroll/reset', {});
      modal.alert({ title: 'Успешно', message: 'Статистика рекрутеров успешно обнулена!', type: 'success' });
      fetchData();
    } catch (err: any) {
      modal.alert({ title: 'Ошибка', message: err.response?.data?.error || 'Не удалось обнулить статистику', type: 'error' });
    } finally {
      setResetting(false);
    }
  };

  const handleResetSingleRecruiter = async (recruiter: any) => {
    const confirmed = await modal.confirm({
      title: 'Обнуление статистики рекрутера',
      message: `Обнулить текущую статистику для рекрутера @${recruiter.recruiterTag || recruiter.recruiterId}? Его счетчики за текущий период будут обнулены.`,
      confirmText: 'Обнулить',
      type: 'danger',
    });
    if (!confirmed) return;

    try {
      setResetting(true);
      await api.post('/payroll/reset', { recruiterId: recruiter.recruiterId });
      modal.alert({ title: 'Успешно', message: `Статистика рекрутера @${recruiter.recruiterTag || recruiter.recruiterId} обнулена!`, type: 'success' });
      fetchData();
    } catch (err: any) {
      modal.alert({ title: 'Ошибка', message: err.response?.data?.error || 'Не удалось обнулить', type: 'error' });
    } finally {
      setResetting(false);
    }
  };

  const handleClearReset = async (recruiterId?: string) => {
    try {
      setResetting(true);
      await api.post('/payroll/reset-clear', { recruiterId });
      modal.alert({ title: 'Успешно', message: 'Точка обнуления сброшена. Отображаются данные за полный период.', type: 'success' });
      fetchData();
    } catch (err: any) {
      modal.alert({ title: 'Ошибка', message: err.response?.data?.error || 'Не удалось сбросить', type: 'error' });
    } finally {
      setResetting(false);
    }
  };

  const handleSaveRates = async () => {
    try {
      setSaving(true);
      await api.post('/payroll/config', config);
      modal.alert({
        title: 'Успешно',
        message: 'Тарифные ставки рекрутеров сохранены!',
        type: 'success',
      });
      fetchData();
    } catch (err: any) {
      modal.alert({
        title: 'Ошибка',
        message: err.response?.data?.error || 'Не удалось сохранить ставки',
        type: 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  const currency = config?.currencySymbol || '$';

  // Compute mass export text: static;amount;comment
  const getExportLines = (): string[] => {
    if (!payrollData?.recruiters) return [];
    return payrollData.recruiters
      .filter((r: any) => (exportOnlyPositive ? r.totalPayout > 0 : true))
      .map((r: any) => {
        const staticId = r.staticId || 'НЕ_УКАЗАН';
        return `${staticId};${r.totalPayout};${exportComment}`;
      });
  };

  const exportText = getExportLines().join('\n');

  const handleCopyExport = () => {
    navigator.clipboard.writeText(exportText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadTxt = () => {
    const blob = new Blob([exportText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `recruiter_payroll_${daysWindow}d_${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
            <Coins className="w-6 h-6 text-pink-500" />
            Выплаты и премии рекрутерам
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Автоматический расчет зарплат рекрутеров по основным статикам с возможностью массового экспорта
          </p>
        </div>

        {/* Tab switchers */}
        <div className="flex bg-[#0B0E14] p-1 rounded-xl border border-[#1E232F]">
          <button
            onClick={() => setTab('payroll')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              tab === 'payroll'
                ? 'bg-gradient-to-r from-pink-600 to-rose-500 text-white shadow-md shadow-pink-600/25'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Ведомость выплат
          </button>
          <button
            onClick={() => setTab('rates')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              tab === 'rates'
                ? 'bg-gradient-to-r from-pink-600 to-rose-500 text-white shadow-md shadow-pink-600/25'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Тарифы & Ставки
          </button>
        </div>
      </div>

      {tab === 'payroll' && (
        <div className="space-y-6">
          {/* Controls Bar */}
          <div className="bg-[#151921] border border-[#1E232F] rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 font-medium">Период ведомости:</span>
              {[
                { label: 'Неделя (7 дн.)', val: 7 },
                { label: '2 недели (14 дн.)', val: 14 },
                { label: 'Месяц (30 дн.)', val: 30 },
              ].map((p) => (
                <button
                  key={p.val}
                  onClick={() => setDaysWindow(p.val)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    daysWindow === p.val
                      ? 'bg-gradient-to-r from-pink-600 to-rose-500 text-white shadow-md shadow-pink-600/25'
                      : 'bg-[#0B0E14] text-slate-400 border border-[#1E232F] hover:text-white'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="text-xs">
                <span className="text-slate-400 mr-2">Итого к выплате:</span>
                <strong className="text-base text-pink-400 font-mono font-bold">
                  {payrollData?.grandTotal?.toLocaleString('ru-RU') || 0} {currency}
                </strong>
              </div>

              <button
                onClick={() => setShowExportModal(true)}
                className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-pink-600 to-rose-500 hover:from-pink-500 hover:to-rose-400 text-white text-xs font-semibold shadow-md shadow-pink-600/20 transition-all"
              >
                <Download className="w-4 h-4" />
                <span>Массовый вывод (.txt)</span>
              </button>

              <button
                onClick={handleResetAllStats}
                disabled={resetting}
                className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-red-600/20 hover:bg-red-600/30 text-red-300 hover:text-white border border-red-500/30 text-xs font-semibold shadow-sm transition-all disabled:opacity-50"
                title="Обнулить текущую статистику всех рекрутеров"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Обнулить статистику</span>
              </button>
            </div>
          </div>

          {/* Reset Information Banner */}
          {payrollData?.lastResetAt && (
            <div className="bg-amber-500/10 border border-amber-500/25 rounded-2xl px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs text-amber-300">
              <div className="flex items-center gap-2">
                <RotateCcw className="w-4 h-4 text-amber-400 shrink-0" />
                <span>
                  Статистика рекрутеров обнулена: <strong>{new Date(payrollData.lastResetAt).toLocaleString('ru-RU')}</strong>. Отсчет ведется с момента последнего обнуления.
                </span>
              </div>
              <button
                onClick={() => handleClearReset()}
                disabled={resetting}
                className="text-[11px] px-2.5 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-200 border border-amber-500/30 font-semibold transition-all"
              >
                Сбросить обнуление (полный период)
              </button>
            </div>
          )}

          {/* Current Rates Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="bg-[#151921] border border-[#1E232F] rounded-xl p-3 text-center">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Одобр. заявка</span>
              <span className="text-sm font-bold text-emerald-400 font-mono">
                {config?.payPerCandidateAccepted?.toLocaleString('ru-RU') || 0} {currency}
              </span>
            </div>
            <div className="bg-[#151921] border border-[#1E232F] rounded-xl p-3 text-center">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Отклон. заявка</span>
              <span className="text-sm font-bold text-slate-300 font-mono">
                {config?.payPerCandidateRejected?.toLocaleString('ru-RU') || 0} {currency}
              </span>
            </div>
            <div className="bg-[#151921] border border-[#1E232F] rounded-xl p-3 text-center">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Одобр. отчет</span>
              <span className="text-sm font-bold text-pink-400 font-mono">
                {config?.payPerApprovedReport?.toLocaleString('ru-RU') || 0} {currency}
              </span>
            </div>
            <div className="bg-[#151921] border border-[#1E232F] rounded-xl p-3 text-center">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Отклон. отчет</span>
              <span className="text-sm font-bold text-rose-300 font-mono">
                {config?.payPerRejectedReport?.toLocaleString('ru-RU') || 0} {currency}
              </span>
            </div>
            <div className="bg-[#151921] border border-[#1E232F] rounded-xl p-3 text-center col-span-2 sm:col-span-1">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Повышение 2 ранг</span>
              <span className="text-sm font-bold text-amber-400 font-mono">
                {config?.payPerPromotion?.toLocaleString('ru-RU') || 0} {currency}
              </span>
            </div>
          </div>

          {/* Statement Table */}
          <div className="bg-[#151921] border border-[#1E232F] rounded-2xl overflow-hidden shadow-xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#1E232F]/60 text-slate-400 uppercase tracking-wider font-semibold border-b border-[#1E232F]">
                <tr>
                  <th className="px-5 py-3.5">#</th>
                  <th className="px-5 py-3.5">Рекрутер</th>
                  <th className="px-4 py-3.5">Основной статик</th>
                  <th className="px-4 py-3.5 text-center">Заявки (Одобр / Отклон)</th>
                  <th className="px-4 py-3.5 text-center">Отчеты МП (Одобр / Отклон)</th>
                  <th className="px-4 py-3.5 text-center">Повышено на 2 ранг</th>
                  <th className="px-5 py-3.5 text-right">Сумма выплаты</th>
                  <th className="px-5 py-3.5 text-right">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1E232F]">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-8 text-center text-slate-500">
                      Расчет ведомости...
                    </td>
                  </tr>
                ) : (!payrollData?.recruiters || payrollData.recruiters.length === 0) ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-8 text-center text-slate-500">
                      За выбранный период нет зафиксированных действий рекрутеров
                    </td>
                  </tr>
                ) : (
                  payrollData.recruiters.map((r: any, idx: number) => (
                    <tr key={r.recruiterId} className="hover:bg-[#1A1F2B]/40 transition-colors">
                      <td className="px-5 py-4 font-bold text-slate-400">
                        {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}`}
                      </td>
                      <td className="px-5 py-4 font-semibold text-white">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span>@{r.recruiterTag || r.recruiterId}</span>
                          {r.isReset && (
                            <span 
                              className="text-[10px] text-amber-400 bg-amber-500/15 border border-amber-500/25 px-1.5 py-0.5 rounded font-normal"
                              title={`Обнулен: ${r.resetAt ? new Date(r.resetAt).toLocaleString('ru-RU') : ''}`}
                            >
                              Обнулен
                            </span>
                          )}
                        </div>
                        {r.characterName && (
                          <span className="block text-[11px] text-slate-400 font-normal">{r.characterName}</span>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        {r.staticId ? (
                          <span className="font-mono font-bold text-pink-400 bg-pink-500/10 border border-pink-500/20 px-2 py-0.5 rounded text-xs">
                            {r.staticId}
                          </span>
                        ) : (
                          <span className="text-[11px] text-amber-400/80 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                            Не привязан
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-center">
                        <button
                          onClick={() => handleOpenRecruiterApps(r)}
                          title="Посмотреть и удалить заявки рекрутера"
                          className="group inline-flex items-center gap-1 font-mono font-bold hover:bg-pink-500/15 px-2.5 py-1 rounded-lg border border-transparent hover:border-pink-500/30 transition-all cursor-pointer"
                        >
                          <span className="text-emerald-400">{r.acceptedCount}</span>
                          <span className="text-slate-500 mx-1">/</span>
                          <span className="text-slate-400">{r.rejectedCandidatesCount || 0}</span>
                          <Eye className="w-3.5 h-3.5 text-pink-400 opacity-60 group-hover:opacity-100 ml-1 transition-opacity" />
                        </button>
                      </td>
                      <td className="px-4 py-4 text-center font-mono font-bold">
                        <span className="text-pink-400">{r.approvedReportsCount || r.reportsCount || 0}</span>
                        <span className="text-slate-500 mx-1">/</span>
                        <span className="text-slate-400">{r.rejectedReportsCount || 0}</span>
                      </td>
                      <td className="px-4 py-4 text-center font-mono font-bold text-amber-400">
                        {r.promotionsCount}
                      </td>
                      <td className="px-5 py-4 text-right font-mono font-extrabold text-white text-sm">
                        {r.totalPayout.toLocaleString('ru-RU')} <span className="text-pink-400 font-bold">{currency}</span>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenRecruiterApps(r)}
                            title="Управление и удаление заявок рекрутера"
                            className="p-1.5 rounded-lg bg-[#1E232F] hover:bg-pink-600/20 text-pink-400 hover:text-pink-300 transition-all text-xs inline-flex items-center gap-1 border border-slate-700/40"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Заявки</span>
                          </button>

                          {r.isReset ? (
                            <button
                              onClick={() => handleClearReset(r.recruiterId)}
                              disabled={resetting}
                              title="Вернуть статистику рекрутера (снять обнуление)"
                              className="p-1.5 rounded-lg bg-[#1E232F] hover:bg-amber-600/20 text-amber-400 hover:text-amber-300 transition-all text-xs inline-flex items-center gap-1 border border-slate-700/40"
                            >
                              <RefreshCw className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">Вернуть</span>
                            </button>
                          ) : (
                            <button
                              onClick={() => handleResetSingleRecruiter(r)}
                              disabled={resetting}
                              title="Обнулить статистику этого рекрутера"
                              className="p-1.5 rounded-lg bg-[#1E232F] hover:bg-red-600/20 text-red-400 hover:text-red-300 transition-all text-xs inline-flex items-center gap-1 border border-slate-700/40 disabled:opacity-50"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">Обнулить</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'rates' && (
        <div className="bg-[#151921] border border-[#1E232F] rounded-2xl p-6 space-y-4 max-w-2xl">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <Settings2 className="w-4 h-4 text-pink-500" />
            Настройки тарифов за действия
          </h2>

          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-400 mb-1 font-medium">Ставка за 1 одобренную заявку</label>
                <input
                  type="number"
                  min={0}
                  step={500}
                  value={config?.payPerCandidateAccepted ?? 10000}
                  onChange={(e) => setConfig({ ...config, payPerCandidateAccepted: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-[#0B0E14] border border-[#1E232F] rounded-xl px-3 py-2 text-slate-200"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">Ставка за 1 отклоненную заявку</label>
                <input
                  type="number"
                  min={0}
                  step={500}
                  value={config?.payPerCandidateRejected ?? 3000}
                  onChange={(e) => setConfig({ ...config, payPerCandidateRejected: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-[#0B0E14] border border-[#1E232F] rounded-xl px-3 py-2 text-slate-200"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-400 mb-1 font-medium">Ставка за 1 одобренный отчет по МП</label>
                <input
                  type="number"
                  min={0}
                  step={500}
                  value={config?.payPerApprovedReport ?? 3000}
                  onChange={(e) => setConfig({ ...config, payPerApprovedReport: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-[#0B0E14] border border-[#1E232F] rounded-xl px-3 py-2 text-slate-200"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">Ставка за 1 проверенный и отклоненный отчет МП</label>
                <input
                  type="number"
                  min={0}
                  step={500}
                  value={config?.payPerRejectedReport ?? 1500}
                  onChange={(e) => setConfig({ ...config, payPerRejectedReport: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-[#0B0E14] border border-[#1E232F] rounded-xl px-3 py-2 text-slate-200"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-400 mb-1 font-medium">Ставка за 1 проведенное повышение академика на 2 ранг</label>
              <input
                type="number"
                min={0}
                step={500}
                value={config?.payPerPromotion ?? 15000}
                onChange={(e) => setConfig({ ...config, payPerPromotion: parseFloat(e.target.value) || 0 })}
                className="w-full bg-[#0B0E14] border border-[#1E232F] rounded-xl px-3 py-2 text-slate-200"
              />
            </div>

            <div>
              <label className="block text-slate-400 mb-1 font-medium">Символ валюты</label>
              <input
                type="text"
                value={config?.currencySymbol || '$'}
                onChange={(e) => setConfig({ ...config, currencySymbol: e.target.value })}
                className="w-full bg-[#0B0E14] border border-[#1E232F] rounded-xl px-3 py-2 text-slate-200"
              />
            </div>
          </div>

          <div className="pt-2">
            <button
              onClick={handleSaveRates}
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-pink-600 to-rose-500 hover:from-pink-500 hover:to-rose-400 text-white font-semibold text-xs shadow-lg shadow-pink-600/25 transition-all disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>Сохранить ставки</span>
            </button>
          </div>
        </div>
      )}

      {/* MASS EXPORT MODAL */}
      {showExportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#151921] border border-[#1E232F] rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between p-5 border-b border-[#1E232F] bg-[#1A1F2B]/50">
              <div className="flex items-center gap-2.5">
                <FileText className="w-5 h-5 text-pink-500" />
                <div>
                  <h3 className="font-bold text-white text-sm">Массовый экспорт для выдачи выплат</h3>
                  <p className="text-[11px] text-slate-400">Формат: статик;сумма;комментарий</p>
                </div>
              </div>
              <button
                onClick={() => setShowExportModal(false)}
                className="p-1 rounded-lg hover:bg-[#1E232F] text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto flex-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Комментарий к выплате</label>
                  <input
                    type="text"
                    value={exportComment}
                    onChange={(e) => setExportComment(e.target.value)}
                    placeholder="например: Премия или Зарплата"
                    className="w-full bg-[#0B0E14] border border-[#1E232F] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-pink-500"
                  />
                </div>
                <div className="flex items-end pb-1">
                  <label className="flex items-center gap-2 text-slate-300 cursor-pointer text-xs">
                    <input
                      type="checkbox"
                      checked={exportOnlyPositive}
                      onChange={(e) => setExportOnlyPositive(e.target.checked)}
                      className="rounded border-[#1E232F] bg-[#0B0E14] text-pink-500 focus:ring-pink-500 w-4 h-4"
                    />
                    <span>Только рекрутеры с суммой &gt; 0</span>
                  </label>
                </div>
              </div>

              {payrollData?.recruiters?.some((r: any) => !r.staticId && r.totalPayout > 0) && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-start gap-2.5 text-xs text-amber-300">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>
                    У некоторых рекрутеров не указан основной статик в профиле. Вы можете привязать статики во вкладке <strong>«Профили»</strong>.
                  </span>
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-medium text-slate-400">
                    Сгенерированный список ({getExportLines().length} строк):
                  </label>
                  <span className="text-[10px] text-slate-500 font-mono">статик;сумма;комментарий</span>
                </div>
                <textarea
                  readOnly
                  rows={8}
                  value={exportText}
                  className="w-full bg-[#0B0E14] border border-[#1E232F] rounded-xl p-3 font-mono text-xs text-pink-300 focus:outline-none select-all resize-none"
                />
              </div>
            </div>

            <div className="p-4 border-t border-[#1E232F] bg-[#1A1F2B]/40 flex items-center justify-between gap-3">
              <span className="text-xs text-slate-400 font-mono">
                Итого строк: <strong>{getExportLines().length}</strong>
              </span>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopyExport}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-[#1E232F] hover:bg-[#252B3B] text-slate-200 rounded-xl text-xs font-semibold transition-all border border-[#1E232F]"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>{copied ? 'Скопировано!' : 'Копировать'}</span>
                </button>

                <button
                  onClick={handleDownloadTxt}
                  className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-pink-600 to-rose-500 hover:from-pink-500 hover:to-rose-400 text-white rounded-xl text-xs font-semibold shadow-md shadow-pink-600/25 transition-all"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Скачать .txt</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* RECRUITER APPLICATIONS MODAL (VIEW & DELETE) */}
      {selectedRecruiterForApps && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#151921] border border-[#1E232F] rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between p-5 border-b border-[#1E232F] bg-[#1A1F2B]/50">
              <div className="flex items-center gap-2.5">
                <FileText className="w-5 h-5 text-pink-500" />
                <div>
                  <h3 className="font-bold text-white text-sm">
                    Заявки рекрутера: @{selectedRecruiterForApps.recruiterTag || selectedRecruiterForApps.recruiterId}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Статик: {selectedRecruiterForApps.staticId || 'Не привязан'} | Удаление заявок из статистики
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedRecruiterForApps(null)}
                className="p-1 rounded-lg hover:bg-[#1E232F] text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            {/* Filter and Bulk Action Bar */}
            <div className="p-4 border-b border-[#1E232F] bg-[#0B0E14]/40 flex flex-wrap items-center justify-between gap-3">
              <div className="flex gap-1.5">
                {[
                  { id: 'ALL', label: `Все (${recruiterApps.length})` },
                  { id: 'ACCEPTED', label: `Одобренные (${recruiterApps.filter(a => a.status === 'ACCEPTED').length})` },
                  { id: 'REJECTED', label: `Отклоненные (${recruiterApps.filter(a => a.status === 'REJECTED').length})` },
                ].map((f: any) => (
                  <button
                    key={f.id}
                    onClick={() => setRecruiterAppsFilter(f.id)}
                    className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                      recruiterAppsFilter === f.id
                        ? 'bg-pink-600/20 text-pink-300 border border-pink-500/40'
                        : 'bg-[#151921] text-slate-400 hover:text-white border border-[#1E232F]'
                    }`}
                  >
                    {f.id === 'ACCEPTED' && '✅ '}
                    {f.id === 'REJECTED' && '❌ '}
                    {f.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                {recruiterApps.some(a => a.status === 'ACCEPTED') && (
                  <button
                    onClick={() => handleBulkDeleteRecruiterApps('ACCEPTED')}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-600/10 hover:bg-red-600/20 text-red-400 border border-red-500/20 text-[11px] font-medium transition-all"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Удалить все одобренные</span>
                  </button>
                )}
                {recruiterApps.some(a => a.status === 'REJECTED') && (
                  <button
                    onClick={() => handleBulkDeleteRecruiterApps('REJECTED')}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-600/10 hover:bg-red-600/20 text-red-400 border border-red-500/20 text-[11px] font-medium transition-all"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Удалить все отклоненные</span>
                  </button>
                )}
              </div>
            </div>

            {/* List */}
            <div className="p-4 space-y-3 overflow-y-auto flex-1 text-xs">
              {recruiterAppsLoading ? (
                <div className="py-12 text-center text-slate-500">Загрузка заявок...</div>
              ) : recruiterApps
                  .filter(a => recruiterAppsFilter === 'ALL' || a.status === recruiterAppsFilter)
                  .length === 0 ? (
                <div className="py-12 text-center text-slate-500">
                  Заявок в этой категории не найдено
                </div>
              ) : (
                recruiterApps
                  .filter(a => recruiterAppsFilter === 'ALL' || a.status === recruiterAppsFilter)
                  .map((app: any) => (
                    <div
                      key={app.id}
                      className="p-3.5 rounded-xl bg-[#0B0E14] border border-[#1E232F] flex items-center justify-between gap-4 hover:border-slate-700/50 transition-colors"
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-white">@{app.userTag || app.userId}</span>
                          <span className="text-[10px] text-slate-500 font-mono">ID: {app.userId}</span>
                          {app.status === 'ACCEPTED' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
                              <CheckCircle className="w-3 h-3" /> Одобрена
                            </span>
                          ) : app.status === 'REJECTED' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-500/15 text-red-400 border border-red-500/25">
                              <XCircle className="w-3 h-3" /> Отклонена
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-400">{app.status}</span>
                          )}
                        </div>

                        <div className="text-[11px] text-slate-400 flex flex-wrap gap-x-3">
                          <span>Подана: {new Date(app.createdAt).toLocaleDateString('ru-RU')}</span>
                          {app.closedAt && (
                            <span>Закрыта: {new Date(app.closedAt).toLocaleString('ru-RU')}</span>
                          )}
                          {app.rejectionReason && (
                            <span className="text-red-400">Причина: {app.rejectionReason}</span>
                          )}
                        </div>

                        {app.answers && Object.keys(app.answers).length > 0 && (
                          <div className="text-[11px] text-slate-400 line-clamp-1 pt-0.5">
                            {Object.entries(app.answers).slice(0, 2).map(([k, v]: any) => `${k}: ${v}`).join(' | ')}
                          </div>
                        )}
                      </div>

                      <button
                        onClick={() => handleDeleteAppFromStats(app.id, app.userTag || app.userId)}
                        title="Удалить заявку из базы и статистики"
                        className="p-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 border border-red-500/20 transition-all shrink-0 flex items-center gap-1 text-xs font-semibold cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                        <span className="hidden sm:inline">Удалить</span>
                      </button>
                    </div>
                  ))
              )}
            </div>

            <div className="p-4 border-t border-[#1E232F] bg-[#1A1F2B]/40 flex items-center justify-between">
              <span className="text-xs text-slate-400">
                При удалении заявки она убирается из базы и пересчитывает ведомость
              </span>
              <button
                onClick={() => setSelectedRecruiterForApps(null)}
                className="px-4 py-2 rounded-xl bg-[#1E232F] hover:bg-[#252B3B] text-slate-200 text-xs font-semibold transition-all cursor-pointer"
              >
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RecruiterPayroll;
