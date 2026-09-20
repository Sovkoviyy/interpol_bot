import React, { useEffect, useState } from 'react';
import { BarChart3, Trophy, CheckCircle, XCircle, Users, Calendar } from 'lucide-react';
import api from '../api/client';

export const Stats: React.FC = () => {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        const res = await api.get('/stats');
        setStats(res.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const rec = stats?.recruitment || {};
  const totalClosed = (rec.accepted || 0) + (rec.rejected || 0);
  const acceptRate = totalClosed > 0 ? Math.round((rec.accepted / totalClosed) * 100) : 0;

  return (
    <div className="space-y-8 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
          <BarChart3 className="w-6 h-6 text-indigo-400" />
          Статистика и лидерборд
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Аналитика набора в семью, эффективность рекрутеров и проведение мероприятий
        </p>
      </div>

      {/* Recruitment Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#151921] border border-[#1E232F] rounded-2xl p-5">
          <p className="text-xs font-semibold text-slate-400 uppercase">Всего заявок</p>
          <p className="text-2xl font-bold text-white mt-2">{rec.total || 0}</p>
        </div>

        <div className="bg-[#151921] border border-[#1E232F] rounded-2xl p-5">
          <p className="text-xs font-semibold text-emerald-400 uppercase flex items-center gap-1.5">
            <CheckCircle className="w-3.5 h-3.5" /> Принято в семью
          </p>
          <p className="text-2xl font-bold text-emerald-400 mt-2">{rec.accepted || 0}</p>
        </div>

        <div className="bg-[#151921] border border-[#1E232F] rounded-2xl p-5">
          <p className="text-xs font-semibold text-red-400 uppercase flex items-center gap-1.5">
            <XCircle className="w-3.5 h-3.5" /> Отклонено
          </p>
          <p className="text-2xl font-bold text-red-400 mt-2">{rec.rejected || 0}</p>
        </div>

        <div className="bg-[#151921] border border-[#1E232F] rounded-2xl p-5">
          <p className="text-xs font-semibold text-indigo-400 uppercase">Процент одобрения</p>
          <p className="text-2xl font-bold text-indigo-300 mt-2">{acceptRate}%</p>
        </div>
      </div>

      {/* Recruiter Leaderboard Table */}
      <div className="bg-[#151921] border border-[#1E232F] rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Trophy className="w-5 h-5 text-amber-400" />
          <h2 className="text-sm font-bold text-white uppercase tracking-wider">
            Рейтинг активности рекрутеров
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#1E232F]/60 text-slate-400 uppercase tracking-wider font-semibold border-b border-[#1E232F]">
              <tr>
                <th className="px-6 py-3.5">#</th>
                <th className="px-6 py-3.5">Рекрутер</th>
                <th className="px-6 py-3.5 text-center">Всего закрыто</th>
                <th className="px-6 py-3.5 text-center">Одобрено</th>
                <th className="px-6 py-3.5 text-center">Отклонено</th>
                <th className="px-6 py-3.5 text-right">% одобрения</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1E232F]">
              {(!rec.leaderboard || rec.leaderboard.length === 0) ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                    Пока ни одна заявка не была закрыта
                  </td>
                </tr>
              ) : (
                rec.leaderboard.map((item: any, idx: number) => {
                  const rate = item.total > 0 ? Math.round((item.accepted / item.total) * 100) : 0;
                  return (
                    <tr key={idx} className="hover:bg-[#1E232F]/30 transition-colors">
                      <td className="px-6 py-4 font-bold text-slate-400">
                        {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : idx + 1}
                      </td>
                      <td className="px-6 py-4 font-bold text-slate-200">
                        @{item.tag}
                      </td>
                      <td className="px-6 py-4 text-center font-bold text-indigo-400">
                        {item.total}
                      </td>
                      <td className="px-6 py-4 text-center text-emerald-400 font-semibold">
                        {item.accepted}
                      </td>
                      <td className="px-6 py-4 text-center text-red-400 font-semibold">
                        {item.rejected}
                      </td>
                      <td className="px-6 py-4 text-right font-mono font-bold text-slate-200">
                        {rate}%
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
  );
};

export default Stats;
