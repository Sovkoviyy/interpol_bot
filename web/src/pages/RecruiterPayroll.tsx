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
  AlertTriangle
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

  // Period filters
  const [daysWindow, setDaysWindow] = useState(7); // 7 days (week), 30 days (month)

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

            <div className="flex items-center gap-4">
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
            </div>
          </div>

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
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1E232F]">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-slate-500">
                      Расчет ведомости...
                    </td>
                  </tr>
                ) : (!payrollData?.recruiters || payrollData.recruiters.length === 0) ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-slate-500">
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
                        @{r.recruiterTag || r.recruiterId}
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
                      <td className="px-4 py-4 text-center font-mono font-bold">
                        <span className="text-emerald-400">{r.acceptedCount}</span>
                        <span className="text-slate-500 mx-1">/</span>
                        <span className="text-slate-400">{r.rejectedCandidatesCount || 0}</span>
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
    </div>
  );
};

export default RecruiterPayroll;
