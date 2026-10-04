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
  RefreshCw,
  History,
  Send,
  Clock,
  ExternalLink
} from 'lucide-react';
import api from '../api/client';
import { useModal } from '../context/ModalContext';
import { useToast } from '../context/ToastContext';
import { 
  PageHeader, 
  LoadingSpinner, 
  StatusBadge, 
  EmptyState, 
  SearchInput, 
  Modal, 
  ConfirmDialog,
  ChannelSelect 
} from '../components';

export const RecruiterPayroll: React.FC = () => {
  const modal = useModal();
  const toast = useToast();

  const [tab, setTab] = useState<'current' | 'history' | 'settings'>('current');
  const [config, setConfig] = useState<any>(null);
  const [payrollData, setPayrollData] = useState<any>(null);
  const [payoutHistory, setPayoutHistory] = useState<any[]>([]);
  const [historyFilter, setHistoryFilter] = useState<'ALL' | 'PENDING' | 'PAID'>('ALL');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [channels, setChannels] = useState<any[]>([]);

  // Confirmation Dialog States
  const [archiveConfirmOpen, setArchiveConfirmOpen] = useState(false);
  const [resetAllConfirmOpen, setResetAllConfirmOpen] = useState(false);
  const [resetSingleTarget, setResetSingleTarget] = useState<any | null>(null);

  // Recruiter applications view/delete modal
  const [selectedRecruiterForApps, setSelectedRecruiterForApps] = useState<any | null>(null);
  const [recruiterApps, setRecruiterApps] = useState<any[]>([]);
  const [recruiterAppsLoading, setRecruiterAppsLoading] = useState(false);
  const [recruiterAppsFilter, setRecruiterAppsFilter] = useState<'ALL' | 'ACCEPTED' | 'REJECTED'>('ALL');

  // Export Modal
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportComment, setExportComment] = useState('Премия');
  const [exportSource, setExportSource] = useState<'current' | 'history'>('current');
  const [exportOnlyPositive, setExportOnlyPositive] = useState(true);
  const [copied, setCopied] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [cfgRes, payRes, histRes, chRes] = await Promise.all([
        api.get('/payroll/config'),
        api.get('/payroll/calculate'),
        api.get('/payroll/history?limit=100'),
        api.get('/guild/channels').catch(() => ({ data: { channels: [] } })),
      ]);
      setConfig(cfgRes.data.config);
      setPayrollData(payRes.data);
      setPayoutHistory(histRes.data.records || []);
      setChannels(chRes.data?.channels || []);
    } catch (err) {
      console.error(err);
      toast.error('Ошибка загрузки данных по выплатам');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleOpenRecruiterApps = async (recruiter: any) => {
    setSelectedRecruiterForApps(recruiter);
    setRecruiterAppsFilter('ALL');
    await fetchRecruiterApps(recruiter.recruiterId);
  };

  const fetchRecruiterApps = async (recruiterId: string) => {
    try {
      setRecruiterAppsLoading(true);
      const res = await api.get(`/recruitment/applications?recruiterId=${recruiterId}&limit=200`);
      setRecruiterApps(res.data.applications || []);
    } catch (err) {
      console.error(err);
      toast.error('Не удалось загрузить заявки рекрутера');
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
      toast.success('Заявка удалена из статистики!');
      if (selectedRecruiterForApps) {
        await fetchRecruiterApps(selectedRecruiterForApps.recruiterId);
      }
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Не удалось удалить заявку');
    }
  };

  // Archive & Reset Week (Finalize week, create payout records, post in Discord)
  const executeArchiveWeek = async () => {
    try {
      setActionLoading(true);
      const res = await api.post('/payroll/archive-week', { guildId: config?.guildId });
      toast.success(res.data?.message || 'Неделя завершена, выплаты сформированы!');
      setArchiveConfirmOpen(false);
      await fetchData();
      setTab('history');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Не удалось завершить неделю');
    } finally {
      setActionLoading(false);
    }
  };

  // Reset all active weekly counters cleanly without archiving
  const executeResetAll = async () => {
    try {
      setActionLoading(true);
      const res = await api.post('/payroll/reset', { archive: false, guildId: config?.guildId });
      toast.success(res.data?.message || 'Статистика текущей недели успешно обнулена!');
      setResetAllConfirmOpen(false);
      await fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Не удалось обнулить статистику');
    } finally {
      setActionLoading(false);
    }
  };

  // Reset single recruiter
  const executeResetSingle = async () => {
    if (!resetSingleTarget) return;
    try {
      setActionLoading(true);
      const res = await api.post('/payroll/reset', {
        recruiterId: resetSingleTarget.recruiterId,
        guildId: config?.guildId,
      });
      toast.success(res.data?.message || `Статистика рекрутера ${resetSingleTarget.displayName} обнулена!`);
      setResetSingleTarget(null);
      await fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Не удалось обнулить');
    } finally {
      setActionLoading(false);
    }
  };

  // Clear single or global reset checkpoint
  const handleClearReset = async (recruiterId?: string) => {
    try {
      setActionLoading(true);
      await api.post('/payroll/reset-clear', { recruiterId, guildId: config?.guildId });
      toast.success('Точка обнуления сброшена. Отображаются данные за полный период недели.');
      await fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Не удалось сбросить');
    } finally {
      setActionLoading(false);
    }
  };

  // Toggle Payout Status (PAID / PENDING)
  const handleTogglePayoutStatus = async (payoutId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'PAID' ? 'PENDING' : 'PAID';
    try {
      await api.patch(`/payroll/payouts/${payoutId}`, { status: newStatus });
      toast.success(newStatus === 'PAID' ? 'Выплата отмечена как выплаченная!' : 'Выплата возвращена в статус ожидания');
      setPayoutHistory((prev) =>
        prev.map((p) => (p.id === payoutId ? { ...p, status: newStatus, paidAt: newStatus === 'PAID' ? new Date().toISOString() : null } : p))
      );
    } catch (err: any) {
      toast.error('Не удалось изменить статус выплаты');
    }
  };

  // Delete payout record
  const handleDeletePayoutRecord = async (payoutId: string) => {
    const confirmed = await modal.confirm({
      title: 'Удалить запись о выплате?',
      message: 'Запись будет безвозвратно удалена из истории выплат.',
      confirmText: 'Удалить',
      type: 'danger',
    });
    if (!confirmed) return;

    try {
      await api.delete(`/payroll/payouts/${payoutId}`);
      toast.success('Запись удалена');
      setPayoutHistory((prev) => prev.filter((p) => p.id !== payoutId));
    } catch (err: any) {
      toast.error('Не удалось удалить запись');
    }
  };

  // Save Settings
  const handleSaveConfig = async () => {
    try {
      setSaving(true);
      const res = await api.post('/payroll/config', config);
      if (res.data?.config) {
        setConfig(res.data.config);
      }
      toast.success('Настройки тарифов и канала успешно сохранены!');
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Ошибка при сохранении настроек');
    } finally {
      setSaving(false);
    }
  };

  // Export helpers - Strict bank format: staticId;amount;comment
  const getExportData = () => {
    if (exportSource === 'history') {
      return filteredHistory.map((h) => ({
        staticId: h.staticId,
        totalPayout: h.totalPayout,
        displayName: h.recruiterName || h.recruiterTag || h.recruiterId,
      }));
    }
    return (payrollData?.recruiters || []).map((r: any) => ({
      staticId: r.staticId,
      totalPayout: r.totalPayout,
      displayName: r.displayName || r.recruiterTag || r.recruiterId,
    }));
  };

  const generateStrictExportText = () => {
    const list = getExportData();
    const comment = (exportComment || 'Премия').replace(/[;\r\n]/g, ' ').trim() || 'Премия';

    // First line is strictly required by the bank template
    const lines: string[] = ['staticId;amount;comment'];

    for (const r of list) {
      const cleanStatic = String(r.staticId || '').replace(/^#/, '').trim();
      const amount = Math.round(Number(r.totalPayout) || 0);

      // Must have staticId and if exportOnlyPositive must have amount > 0
      if (!cleanStatic) continue;
      if (exportOnlyPositive && amount <= 0) continue;

      lines.push(`${cleanStatic};${amount};${comment}`);
    }

    return lines.join('\n');
  };

  const handleCopyExport = () => {
    const text = generateStrictExportText();
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success('Строгий шаблон выплат скопирован в буфер обмена!');
    setTimeout(() => setCopied(false), 3000);
  };

  const handleDownloadExport = () => {
    const text = generateStrictExportText();
    const blob = new Blob(['\uFEFF' + text], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `payouts_${exportSource === 'history' ? 'history' : 'current'}_${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success('Файл шаблона выплат скачан (.txt)!');
  };

  if (loading) {
    return <LoadingSpinner fullPage message="Загрузка системы выплат рекрутерам..." />;
  }

  // Filter recruiters
  const filteredRecruiters = (payrollData?.recruiters || []).filter((r: any) => {
    if (!search.trim()) return true;
    const s = search.toLowerCase();
    return (
      r.displayName?.toLowerCase().includes(s) ||
      r.recruiterTag?.toLowerCase().includes(s) ||
      r.staticId?.toLowerCase().includes(s) ||
      r.characterName?.toLowerCase().includes(s)
    );
  });

  // Filter history
  const filteredHistory = payoutHistory.filter((item) => {
    if (historyFilter !== 'ALL' && item.status !== historyFilter) return false;
    if (!search.trim()) return true;
    const s = search.toLowerCase();
    return (
      item.recruiterName?.toLowerCase().includes(s) ||
      item.recruiterTag?.toLowerCase().includes(s) ||
      item.staticId?.toLowerCase().includes(s)
    );
  });

  const periodStartStr = payrollData?.periodStart ? new Date(payrollData.periodStart).toLocaleDateString('ru-RU') : '';
  const periodEndStr = payrollData?.periodEnd ? new Date(payrollData.periodEnd).toLocaleDateString('ru-RU') : '';

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <PageHeader
        title="Выплаты рекрутерам"
        description="Автоматический расчет вознаграждений за принятых кандидатов, отчеты и повышения с понедельника по воскресенье"
        icon={<Coins className="w-5 h-5 text-pink-400" />}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={fetchData}
              disabled={loading}
              className="p-2.5 bg-[#151921] hover:bg-[#1E232F] text-slate-400 hover:text-white rounded-xl border border-[#1E232F] transition-all"
              title="Обновить данные"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-pink-400' : ''}`} />
            </button>
            <button
              onClick={() => {
                setExportSource('current');
                setShowExportModal(true);
              }}
              className="flex items-center gap-1.5 px-3 py-2 bg-[#151921] hover:bg-[#1E232F] text-slate-300 hover:text-white text-xs font-semibold rounded-xl border border-[#1E232F] transition-all"
              title="Экспорт ведомости текущей недели в строгий банковский шаблон"
            >
              <Download className="w-4 h-4 text-emerald-400" />
              <span>Экспорт (банк)</span>
            </button>
            <button
              onClick={() => setResetAllConfirmOpen(true)}
              disabled={actionLoading}
              className="flex items-center gap-1.5 px-3 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 text-xs font-semibold rounded-xl border border-rose-500/20 transition-all disabled:opacity-50"
              title="Сбросить текущие счетчики недели без создания ведомостей в истории"
            >
              <RotateCcw className={`w-4 h-4 ${actionLoading ? 'animate-spin' : ''}`} />
              <span>Обнулить неделю</span>
            </button>
            <button
              onClick={() => setArchiveConfirmOpen(true)}
              disabled={actionLoading}
              className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-pink-500/20 transition-all disabled:opacity-50"
            >
              <RotateCcw className={`w-4 h-4 ${actionLoading ? 'animate-spin' : ''}`} />
              <span>Завершить неделю</span>
            </button>
          </div>
        }
      />

      {/* Tabs Switcher */}
      <div className="flex items-center gap-2 border-b border-[#1E232F] pb-3 text-xs font-semibold">
        <button
          onClick={() => setTab('current')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all ${
            tab === 'current'
              ? 'bg-pink-500/15 text-pink-400 border border-pink-500/30 font-bold'
              : 'text-slate-400 hover:text-slate-200 hover:bg-[#151921]'
          }`}
        >
          <Coins className="w-4 h-4" />
          <span>Текущая неделя (Пн — Вс)</span>
          <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-pink-500/20 text-pink-300">
            {payrollData?.recruiters?.length || 0}
          </span>
        </button>

        <button
          onClick={() => setTab('history')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all ${
            tab === 'history'
              ? 'bg-pink-500/15 text-pink-400 border border-pink-500/30 font-bold'
              : 'text-slate-400 hover:text-slate-200 hover:bg-[#151921]'
          }`}
        >
          <History className="w-4 h-4" />
          <span>История выплат</span>
          <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-slate-800 text-slate-300">
            {payoutHistory.length}
          </span>
        </button>

        <button
          onClick={() => setTab('settings')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all ${
            tab === 'settings'
              ? 'bg-pink-500/15 text-pink-400 border border-pink-500/30 font-bold'
              : 'text-slate-400 hover:text-slate-200 hover:bg-[#151921]'
          }`}
        >
          <Settings2 className="w-4 h-4" />
          <span>Тарифы & Discord Канал</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: CURRENT WEEK PAYROLL                                              */}
      {/* ========================================================================= */}
      {tab === 'current' && (
        <div className="space-y-6">
          {/* Active Week Banner */}
          <div className="bg-gradient-to-r from-pink-950/40 via-[#151921] to-[#151921] border border-pink-500/20 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-pink-500/10 border border-pink-500/20 flex items-center justify-center text-pink-400 shrink-0">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-white">
                    Расчетная неделя: {periodStartStr} — {periodEndStr}
                  </h3>
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
                    Активна
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Статистика ведется с понедельника (00:00) по воскресенье (23:59). В конце недели выплаты архивируются и отправляются в Discord.
                </p>
              </div>
            </div>

            {payrollData?.lastResetAt && (
              <div className="flex items-center gap-2 text-xs text-amber-300 bg-amber-500/10 border border-amber-500/25 px-3 py-1.5 rounded-xl self-start md:self-auto">
                <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                <span>Отсчет с: {new Date(payrollData.lastResetAt).toLocaleString('ru-RU')}</span>
                <button
                  onClick={() => handleClearReset()}
                  className="ml-1 text-[11px] underline hover:text-white"
                  title="Сбросить ручную точку отсчета"
                >
                  Сбросить
                </button>
              </div>
            )}
          </div>

          {/* KPI Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-[#151921] border border-[#1E232F] rounded-2xl p-4">
              <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                <span>К выплате за неделю</span>
                <Coins className="w-4 h-4 text-pink-400" />
              </div>
              <div className="text-2xl font-black text-pink-400 tracking-tight">
                {payrollData?.currencySymbol || '$'}{(payrollData?.grandTotal || 0).toLocaleString('ru-RU')}
              </div>
              <div className="text-[10px] text-slate-500 mt-1">Всего к выдаче рекрутерам</div>
            </div>

            <div className="bg-[#151921] border border-[#1E232F] rounded-2xl p-4">
              <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                <span>Принято кандидатов</span>
                <Check className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-2xl font-black text-white tracking-tight">
                {(payrollData?.recruiters || []).reduce((acc: number, r: any) => acc + r.acceptedCount, 0)}
              </div>
              <div className="text-[10px] text-slate-500 mt-1">За текущую неделю</div>
            </div>

            <div className="bg-[#151921] border border-[#1E232F] rounded-2xl p-4">
              <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                <span>Проверено отчетов</span>
                <FileText className="w-4 h-4 text-blue-400" />
              </div>
              <div className="text-2xl font-black text-white tracking-tight">
                {(payrollData?.recruiters || []).reduce((acc: number, r: any) => acc + r.approvedReportsCount, 0)}
              </div>
              <div className="text-[10px] text-slate-500 mt-1">Отчетов по МП принято</div>
            </div>

            <div className="bg-[#151921] border border-[#1E232F] rounded-2xl p-4">
              <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                <span>Повышено академиков</span>
                <Trophy className="w-4 h-4 text-amber-400" />
              </div>
              <div className="text-2xl font-black text-white tracking-tight">
                {(payrollData?.recruiters || []).reduce((acc: number, r: any) => acc + r.promotionsCount, 0)}
              </div>
              <div className="text-[10px] text-slate-500 mt-1">Учеников закрыли 1 ранг</div>
            </div>
          </div>

          {/* Search Bar */}
          <div className="flex items-center justify-between gap-4">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Поиск по имени, нику или статику рекрутера..."
              className="w-full max-w-md"
            />
            <div className="text-xs text-slate-400">
              Рекрутеров в ведомости: <strong className="text-white">{filteredRecruiters.length}</strong>
            </div>
          </div>

          {/* Recruiters Table */}
          <div className="bg-[#151921] border border-[#1E232F] rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="text-[11px] text-slate-400 uppercase tracking-wider bg-[#0B0E14] border-b border-[#1E232F]">
                  <tr>
                    <th className="px-5 py-3.5">#</th>
                    <th className="px-5 py-3.5">Рекрутер</th>
                    <th className="px-5 py-3.5 text-center">Принято</th>
                    <th className="px-5 py-3.5 text-center">Отклонено</th>
                    <th className="px-5 py-3.5 text-center">Отчеты МП</th>
                    <th className="px-5 py-3.5 text-center">Повышения</th>
                    <th className="px-5 py-3.5 text-right font-bold text-pink-400">Сумма к выплате</th>
                    <th className="px-5 py-3.5 text-center">Действия</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1E232F]/50">
                  {filteredRecruiters.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-500">
                        <EmptyState
                          icon={<Users className="w-8 h-8" />}
                          title="Нет активности рекрутеров"
                          description="За текущую неделю пока нет принятых заявок или проверенных отчетов"
                        />
                      </td>
                    </tr>
                  ) : (
                    filteredRecruiters.map((rec: any, idx: number) => {
                      const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : null;
                      return (
                        <tr key={rec.recruiterId} className="hover:bg-[#1A1F2B]/60 transition-colors">
                          <td className="px-5 py-4 font-mono text-xs text-slate-500">
                            {medal ? <span className="text-base">{medal}</span> : idx + 1}
                          </td>
                          <td className="px-5 py-4">
                            <div className="flex flex-col">
                              <span className="font-bold text-white text-sm tracking-tight flex items-center gap-1.5">
                                {rec.displayName}
                                {rec.staticId && (
                                  <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-pink-500/10 text-pink-400 border border-pink-500/20">
                                    #{rec.staticId}
                                  </span>
                                )}
                              </span>
                              <span className="text-[11px] text-slate-500 font-mono">
                                @{rec.recruiterTag || rec.recruiterId}
                              </span>
                            </div>
                          </td>

                          <td className="px-5 py-4 text-center">
                            <span className="font-semibold text-emerald-400">{rec.acceptedCount}</span>
                            <div className="text-[10px] text-slate-500 font-mono">
                              +{payrollData?.currencySymbol}{(rec.acceptedCount * (payrollData?.rates?.payPerCandidateAccepted || 0)).toLocaleString('ru-RU')}
                            </div>
                          </td>

                          <td className="px-5 py-4 text-center">
                            <span className="font-semibold text-rose-400">{rec.rejectedCandidatesCount}</span>
                            <div className="text-[10px] text-slate-500 font-mono">
                              +{payrollData?.currencySymbol}{(rec.rejectedCandidatesCount * (payrollData?.rates?.payPerCandidateRejected || 0)).toLocaleString('ru-RU')}
                            </div>
                          </td>

                          <td className="px-5 py-4 text-center">
                            <span className="font-semibold text-blue-400">{rec.approvedReportsCount}</span>
                            <div className="text-[10px] text-slate-500 font-mono">
                              +{payrollData?.currencySymbol}{(rec.approvedReportsCount * (payrollData?.rates?.payPerApprovedReport || 0)).toLocaleString('ru-RU')}
                            </div>
                          </td>

                          <td className="px-5 py-4 text-center">
                            <span className="font-semibold text-amber-400">{rec.promotionsCount}</span>
                            <div className="text-[10px] text-slate-500 font-mono">
                              +{payrollData?.currencySymbol}{(rec.promotionsCount * (payrollData?.rates?.payPerPromotion || 0)).toLocaleString('ru-RU')}
                            </div>
                          </td>

                          <td className="px-5 py-4 text-right">
                            <span className="text-base font-black text-pink-400 tracking-tight">
                              {payrollData?.currencySymbol || '$'}{rec.totalPayout.toLocaleString('ru-RU')}
                            </span>
                          </td>

                          <td className="px-5 py-4 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => handleOpenRecruiterApps(rec)}
                                className="p-1.5 rounded-lg bg-[#0B0E14] hover:bg-[#1E232F] text-slate-400 hover:text-white border border-[#1E232F] transition-all"
                                title="Посмотреть заявки рекрутера"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => setResetSingleTarget(rec)}
                                className="p-1.5 rounded-lg bg-[#0B0E14] hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 border border-[#1E232F] transition-all"
                                title="Индивидуально обнулить статистику"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: PAYOUT HISTORY & PAYMENT TRACKING                                   */}
      {/* ========================================================================= */}
      {tab === 'history' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setHistoryFilter('ALL')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  historyFilter === 'ALL'
                    ? 'bg-pink-500/15 text-pink-400 border border-pink-500/30'
                    : 'bg-[#151921] text-slate-400 hover:text-white border border-[#1E232F]'
                }`}
              >
                Все записи ({payoutHistory.length})
              </button>
              <button
                onClick={() => setHistoryFilter('PENDING')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  historyFilter === 'PENDING'
                    ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                    : 'bg-[#151921] text-slate-400 hover:text-white border border-[#1E232F]'
                }`}
              >
                Ожидают выплаты ({payoutHistory.filter((p) => p.status === 'PENDING').length})
              </button>
              <button
                onClick={() => setHistoryFilter('PAID')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  historyFilter === 'PAID'
                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                    : 'bg-[#151921] text-slate-400 hover:text-white border border-[#1E232F]'
                }`}
              >
                Выплачено ({payoutHistory.filter((p) => p.status === 'PAID').length})
              </button>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                onClick={() => {
                  setExportSource('history');
                  setShowExportModal(true);
                }}
                className="flex items-center gap-1.5 px-3 py-2 bg-[#151921] hover:bg-[#1E232F] text-slate-300 hover:text-white text-xs font-semibold rounded-xl border border-[#1E232F] transition-all"
                title="Экспорт ведомости из истории выплат в строгий банковский шаблон"
              >
                <Download className="w-4 h-4 text-emerald-400" />
                <span>Экспорт (банк)</span>
              </button>
              <SearchInput
                value={search}
                onChange={setSearch}
                placeholder="Поиск по истории выплат..."
                className="w-full sm:w-72"
              />
            </div>
          </div>

          <div className="bg-[#151921] border border-[#1E232F] rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="text-[11px] text-slate-400 uppercase tracking-wider bg-[#0B0E14] border-b border-[#1E232F]">
                  <tr>
                    <th className="px-5 py-3.5">Период недели</th>
                    <th className="px-5 py-3.5">Рекрутер</th>
                    <th className="px-5 py-3.5">Показатели</th>
                    <th className="px-5 py-3.5 text-right font-bold text-pink-400">Сумма</th>
                    <th className="px-5 py-3.5 text-center">Статус</th>
                    <th className="px-5 py-3.5 text-center">Действие</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1E232F]/50">
                  {filteredHistory.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-500">
                        <EmptyState
                          icon={<History className="w-8 h-8" />}
                          title="История выплат пуста"
                          description="Когда завершится расчетная неделя или вы нажмете «Завершить неделю», здесь появятся итоговые ведомости."
                        />
                      </td>
                    </tr>
                  ) : (
                    filteredHistory.map((item) => {
                      const pStart = new Date(item.periodStart).toLocaleDateString('ru-RU');
                      const pEnd = new Date(item.periodEnd).toLocaleDateString('ru-RU');
                      const isPaid = item.status === 'PAID';

                      return (
                        <tr key={item.id} className="hover:bg-[#1A1F2B]/60 transition-colors">
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-2">
                              <Calendar className="w-4 h-4 text-slate-500" />
                              <span className="font-semibold text-white text-xs">{pStart} — {pEnd}</span>
                            </div>
                            <div className="text-[10px] text-slate-500 mt-0.5 font-mono">
                              Архивировано: {new Date(item.createdAt).toLocaleString('ru-RU')}
                            </div>
                          </td>

                          <td className="px-5 py-4">
                            <div className="flex flex-col">
                              <span className="font-bold text-white text-sm">
                                {item.recruiterName || item.recruiterTag || item.recruiterId}
                                {item.staticId && (
                                  <span className="ml-1.5 px-1.5 py-0.2 rounded text-[10px] font-mono bg-pink-500/10 text-pink-400 border border-pink-500/20">
                                    #{item.staticId}
                                  </span>
                                )}
                              </span>
                              <span className="text-[11px] text-slate-500 font-mono">
                                @{item.recruiterTag}
                              </span>
                            </div>
                          </td>

                          <td className="px-5 py-4">
                            <div className="flex items-center gap-2 text-xs">
                              <span className="text-emerald-400" title="Принято заявок">✓ {item.acceptedCount}</span>
                              <span className="text-slate-600">/</span>
                              <span className="text-rose-400" title="Отклонено заявок">✕ {item.rejectedCandidatesCount}</span>
                              <span className="text-slate-600">/</span>
                              <span className="text-blue-400" title="Отчетов">📝 {item.reportsCount}</span>
                              <span className="text-slate-600">/</span>
                              <span className="text-amber-400" title="Повышений">🎓 {item.promotionsCount}</span>
                            </div>
                          </td>

                          <td className="px-5 py-4 text-right">
                            <span className="text-base font-black text-pink-400">
                              {config?.currencySymbol || '$'}{item.totalPayout.toLocaleString('ru-RU')}
                            </span>
                          </td>

                          <td className="px-5 py-4 text-center">
                            {isPaid ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
                                <Check className="w-3.5 h-3.5" />
                                Выплачено
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-500/15 text-amber-400 border border-amber-500/25">
                                <Clock className="w-3.5 h-3.5" />
                                Ожидает
                              </span>
                            )}
                            {item.paidAt && (
                              <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                                {new Date(item.paidAt).toLocaleDateString('ru-RU')}
                              </div>
                            )}
                          </td>

                          <td className="px-5 py-4 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => handleTogglePayoutStatus(item.id, item.status)}
                                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                                  isPaid
                                    ? 'bg-[#0B0E14] hover:bg-amber-500/20 text-slate-400 hover:text-amber-300 border border-[#1E232F]'
                                    : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/20'
                                }`}
                              >
                                {isPaid ? 'Отменить' : 'Выплатить'}
                              </button>
                              <button
                                onClick={() => handleDeletePayoutRecord(item.id)}
                                className="p-1 rounded-lg bg-[#0B0E14] hover:bg-rose-500/20 text-slate-500 hover:text-rose-400 border border-[#1E232F] transition-all"
                                title="Удалить запись"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: SETTINGS & DISCORD CHANNEL                                         */}
      {/* ========================================================================= */}
      {tab === 'settings' && (
        <div className="bg-[#151921] border border-[#1E232F] rounded-2xl p-6 space-y-6 max-w-2xl">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Settings2 className="w-5 h-5 text-pink-500" />
              <span>Настройка тарифов и Discord-уведомлений</span>
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Укажите канал для отправки итоговых списков на выплату и настройте ставки за действия рекрутеров.
            </p>
          </div>

          <div className="space-y-4">
            {/* Discord Channel Selector */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-300">
                Канал для списков выплат и оповещений в Discord:
              </label>
              <ChannelSelect
                channels={channels}
                channelType="text"
                value={config?.payoutChannelId || ''}
                onChange={(val) => setConfig({ ...config, payoutChannelId: val })}
                placeholder="Выберите канал для выплат (например #выплаты-рекрутерам)"
              />
              <p className="text-[11px] text-slate-500">
                В этот канал по наступлению новой недели (или при нажатии «Завершить неделю») автоматически публикуется сформированная ведомость с именами и суммами, а также объявление о начале новой недели отсчета.
              </p>
            </div>

            {/* Auto Weekly Reset Switch */}
            <div className="flex items-center justify-between p-3.5 bg-[#0B0E14] border border-[#1E232F] rounded-xl">
              <div>
                <div className="text-xs font-bold text-white">Автоматический недельный сброс (Пн 00:00)</div>
                <div className="text-[11px] text-slate-500">
                  Автоматически архивировать статистику за воскресенье и запускать новую неделю
                </div>
              </div>
              <input
                type="checkbox"
                checked={config?.autoWeeklyReset !== false}
                onChange={(e) => setConfig({ ...config, autoWeeklyReset: e.target.checked })}
                className="w-4 h-4 rounded text-pink-600 bg-slate-800 border-slate-700 focus:ring-pink-500"
              />
            </div>

            {/* Currency Symbol */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Символ валюты</label>
              <input
                type="text"
                value={config?.currencySymbol || '$'}
                onChange={(e) => setConfig({ ...config, currencySymbol: e.target.value })}
                className="w-24 bg-[#0B0E14] border border-[#1E232F] rounded-xl px-3 py-2 text-sm text-white text-center font-bold focus:outline-none focus:border-pink-500"
              />
            </div>

            {/* Rates Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  За принятую заявку
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-bold">$</span>
                  <input
                    type="number"
                    value={config?.payPerCandidateAccepted || 0}
                    onChange={(e) => setConfig({ ...config, payPerCandidateAccepted: Number(e.target.value) })}
                    className="w-full bg-[#0B0E14] border border-[#1E232F] rounded-xl pl-7 pr-3 py-2 text-xs text-white focus:outline-none focus:border-pink-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  За отклоненную заявку
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-bold">$</span>
                  <input
                    type="number"
                    value={config?.payPerCandidateRejected || 0}
                    onChange={(e) => setConfig({ ...config, payPerCandidateRejected: Number(e.target.value) })}
                    className="w-full bg-[#0B0E14] border border-[#1E232F] rounded-xl pl-7 pr-3 py-2 text-xs text-white focus:outline-none focus:border-pink-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  За принятый отчет по МП
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-bold">$</span>
                  <input
                    type="number"
                    value={config?.payPerApprovedReport || 0}
                    onChange={(e) => setConfig({ ...config, payPerApprovedReport: Number(e.target.value) })}
                    className="w-full bg-[#0B0E14] border border-[#1E232F] rounded-xl pl-7 pr-3 py-2 text-xs text-white focus:outline-none focus:border-pink-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  За повышение академика (ранг 2)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-bold">$</span>
                  <input
                    type="number"
                    value={config?.payPerPromotion || 0}
                    onChange={(e) => setConfig({ ...config, payPerPromotion: Number(e.target.value) })}
                    className="w-full bg-[#0B0E14] border border-[#1E232F] rounded-xl pl-7 pr-3 py-2 text-xs text-white focus:outline-none focus:border-pink-500"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-[#1E232F]">
            <button
              onClick={handleSaveConfig}
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-pink-600 hover:bg-pink-500 text-white font-bold text-xs shadow-lg shadow-pink-500/20 transition-all disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Сохранение...' : 'Сохранить настройки'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Recruiter Applications Modal */}
      <Modal
        isOpen={Boolean(selectedRecruiterForApps)}
        onClose={() => setSelectedRecruiterForApps(null)}
        title={`Заявки рекрутера: ${selectedRecruiterForApps?.displayName || selectedRecruiterForApps?.recruiterTag}`}
        description={`Просмотр и модерация заявок за расчетную неделю`}
        maxWidth="max-w-2xl"
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-2 border-b border-[#1E232F] pb-3 text-xs">
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setRecruiterAppsFilter('ALL')}
                className={`px-2.5 py-1 rounded-lg ${recruiterAppsFilter === 'ALL' ? 'bg-pink-500/20 text-pink-400 font-bold' : 'text-slate-400'}`}
              >
                Все ({recruiterApps.length})
              </button>
              <button
                onClick={() => setRecruiterAppsFilter('ACCEPTED')}
                className={`px-2.5 py-1 rounded-lg ${recruiterAppsFilter === 'ACCEPTED' ? 'bg-emerald-500/20 text-emerald-400 font-bold' : 'text-slate-400'}`}
              >
                Принятые ({recruiterApps.filter((a) => a.status === 'ACCEPTED').length})
              </button>
              <button
                onClick={() => setRecruiterAppsFilter('REJECTED')}
                className={`px-2.5 py-1 rounded-lg ${recruiterAppsFilter === 'REJECTED' ? 'bg-rose-500/20 text-rose-400 font-bold' : 'text-slate-400'}`}
              >
                Отклоненные ({recruiterApps.filter((a) => a.status === 'REJECTED').length})
              </button>
            </div>
          </div>

          {recruiterAppsLoading ? (
            <LoadingSpinner fullPage={false} message="Загрузка заявок..." />
          ) : recruiterApps.length === 0 ? (
            <EmptyState title="Заявок не найдено" description="У этого рекрутера пока нет обработанных заявок" />
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
              {recruiterApps
                .filter((app) => recruiterAppsFilter === 'ALL' || app.status === recruiterAppsFilter)
                .map((app) => (
                  <div key={app.id} className="bg-[#0B0E14] border border-[#1E232F] rounded-xl p-3 flex items-center justify-between gap-3 text-xs">
                    <div>
                      <div className="font-bold text-white flex items-center gap-2">
                        <span>@{app.userTag || app.userId}</span>
                        <StatusBadge status={app.status} />
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                        Закрыта: {app.closedAt ? new Date(app.closedAt).toLocaleString('ru-RU') : '—'}
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteAppFromStats(app.id, app.userTag)}
                      className="p-1.5 rounded-lg bg-[#151921] hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 border border-[#1E232F] transition-all"
                      title="Удалить из статистики"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
            </div>
          )}
        </div>
      </Modal>

      {/* Export Modal - Strict Bank Template (staticId;amount;comment) */}
      <Modal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        title="Экспорт выплат в банк Majestic RP"
        description="Строгий текстовый шаблон (.txt) для выплат премий в планшете организации"
        maxWidth="max-w-lg"
      >
        <div className="space-y-4 text-xs">
          {/* Source indicator */}
          <div className="flex items-center justify-between p-2.5 bg-[#0B0E14] border border-[#1E232F] rounded-xl text-xs">
            <span className="text-slate-400">Источник данных:</span>
            <span className="font-bold text-pink-400">
              {exportSource === 'history' ? 'История выплат (архив)' : 'Текущая неделя (актуальные)'}
            </span>
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1">
              Комментарий к выплате (comment):
            </label>
            <input
              type="text"
              value={exportComment}
              onChange={(e) => setExportComment(e.target.value)}
              placeholder="Премия"
              className="w-full bg-[#0B0E14] border border-[#1E232F] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-pink-500 font-mono text-sm"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Символ «;» и переносы строк автоматически заменяются на пробелы, чтобы не нарушать структуру файла.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="exportPos"
              checked={exportOnlyPositive}
              onChange={(e) => setExportOnlyPositive(e.target.checked)}
              className="rounded text-pink-600 bg-slate-800 border-slate-700"
            />
            <label htmlFor="exportPos" className="text-slate-300 cursor-pointer select-none">
              Выгружать только тех, у кого сумма &gt; 0
            </label>
          </div>

          {/* Missing static alert */}
          {(() => {
            const missing = getExportData().filter((r: any) => {
              const cleanStatic = String(r.staticId || '').replace(/^#/, '').trim();
              const amount = Math.round(Number(r.totalPayout) || 0);
              return !cleanStatic && (!exportOnlyPositive || amount > 0);
            });
            if (missing.length === 0) return null;
            return (
              <div className="p-3 bg-amber-500/10 border border-amber-500/25 rounded-xl space-y-1.5">
                <div className="flex items-center gap-1.5 text-amber-400 font-bold text-xs">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>Не привязан статик ID ({missing.length})</span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Следующие рекрутеры имеют выплату, но у них нет статика в профиле. Они исключены из шаблона, так как банковский модуль не принимает строки без статика:
                </p>
                <div className="flex flex-wrap gap-1.5 pt-0.5">
                  {missing.map((m: any, i: number) => (
                    <span key={i} className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 font-mono text-[10px] border border-amber-500/30">
                      {m.displayName}: {config?.currencySymbol || '$'}{m.totalPayout}
                    </span>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* Strict template preview */}
          {(() => {
            const text = generateStrictExportText();
            const linesCount = text.split('\n').length;
            return (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-slate-400 text-[11px]">
                  <span>Предпросмотр строгого шаблона:</span>
                  <span className="font-mono text-emerald-400 font-semibold">
                    Строк: {linesCount}
                  </span>
                </div>
                <pre className="bg-[#0B0E14] border border-[#1E232F] rounded-xl p-3 font-mono text-[11px] text-emerald-400 whitespace-pre overflow-x-auto max-h-48 custom-scrollbar select-all leading-relaxed">
                  {text}
                </pre>
                <p className="text-[10px] text-slate-500 italic">
                  * Первая строка «staticId;amount;comment» обязательна — без нее шаблон не принимается банком.
                </p>
              </div>
            );
          })()}

          <div className="flex gap-2 pt-2">
            <button
              onClick={handleCopyExport}
              className="flex-1 py-2.5 rounded-xl bg-pink-600 hover:bg-pink-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-pink-500/20 transition-all"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? 'Скопировано!' : 'Скопировать шаблон'}</span>
            </button>
            <button
              onClick={handleDownloadExport}
              className="px-4 py-2.5 rounded-xl bg-[#151921] hover:bg-[#1E232F] text-slate-200 hover:text-white font-bold text-xs flex items-center justify-center gap-2 border border-[#1E232F] transition-all"
              title="Скачать файл .txt с кодировкой UTF-8 BOM"
            >
              <Download className="w-4 h-4 text-emerald-400" />
              <span>Скачать .txt</span>
            </button>
          </div>
        </div>
      </Modal>

      {/* Confirm Dialog: Archive Week */}
      <ConfirmDialog
        isOpen={archiveConfirmOpen}
        onClose={() => setArchiveConfirmOpen(false)}
        onConfirm={executeArchiveWeek}
        title="Завершить неделю и сформировать выплаты?"
        message="Будет произведен расчет за текущую неделю, созданы постоянные ведомости выплат в истории, статистика обнулится на новую неделю, а отчет со списками будет отправлен в настроенный Discord-канал."
        confirmLabel="Завершить неделю"
        variant="warning"
        loading={actionLoading}
      />

      {/* Confirm Dialog: Reset All Active Stats */}
      <ConfirmDialog
        isOpen={resetAllConfirmOpen}
        onClose={() => setResetAllConfirmOpen(false)}
        onConfirm={executeResetAll}
        title="Обнулить статистику текущей недели?"
        message="Текущие счетчики принятых заявок, отчетов и повышений для всех рекрутеров будут сброшены в 0. Новые данные будут учитываться с этого момента. Ведомости в историю выплат создаваться НЕ будут."
        confirmLabel="Обнулить неделю"
        variant="danger"
        loading={actionLoading}
      />

      {/* Confirm Dialog: Reset Single Recruiter */}
      <ConfirmDialog
        isOpen={!!resetSingleTarget}
        onClose={() => setResetSingleTarget(null)}
        onConfirm={executeResetSingle}
        title="Обнуление статистики рекрутера"
        message={`Обнулить текущую статистику для рекрутера ${resetSingleTarget?.displayName || resetSingleTarget?.recruiterTag || ''}? Его счетчики за текущую неделю будут обнулены с этого момента.`}
        confirmLabel="Обнулить"
        variant="danger"
        loading={actionLoading}
      />
    </div>
  );
};

export default RecruiterPayroll;
