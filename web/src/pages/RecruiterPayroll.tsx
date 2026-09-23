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
  Award
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
  const [daysWindow, setDaysWindow] = useState(7); // 7 days, 14 days, 30 days

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

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
            <Coins className="w-6 h-6 text-pink-500" />
            Выплаты и премии рекрутерам
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Автоматический расчет зарплат: за одобренные и отклоненные заявки, проверенные отчеты МП и повышения
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
                { label: '7 дней', val: 7 },
                { label: '14 дней', val: 14 },
                { label: '30 дней (месяц)', val: 30 },
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

            <div className="text-xs">
              <span className="text-slate-400 mr-2">Итого к выплате всем:</span>
              <strong className="text-base text-pink-400 font-mono font-bold">
                {payrollData?.grandTotal?.toLocaleString('ru-RU') || 0} {currency}
              </strong>
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
                  <th className="px-4 py-3.5 text-center">Заявки в семью (Одобр / Отклон)</th>
                  <th className="px-4 py-3.5 text-center">Отчеты МП (Одобр / Отклон)</th>
                  <th className="px-4 py-3.5 text-center">Повышено на 2 ранг</th>
                  <th className="px-5 py-3.5 text-right">Сумма выплаты</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1E232F]">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                      Расчет ведомости...
                    </td>
                  </tr>
                ) : (!payrollData?.recruiters || payrollData.recruiters.length === 0) ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
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
                        <span className="block text-[10px] text-slate-500 font-mono">ID: {r.recruiterId}</span>
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
    </div>
  );
};

export default RecruiterPayroll;
