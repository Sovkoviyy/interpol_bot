import React, { useEffect, useState } from 'react';
import { 
  BarChart3, 
  Trophy, 
  CheckCircle, 
  XCircle, 
  Users, 
  Calendar, 
  Mic, 
  ShieldAlert, 
  Bot
} from 'lucide-react';
import api from '../api/client';

export const Stats: React.FC = () => {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

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

  useEffect(() => {
    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400">
        <div className="w-8 h-8 border-2 border-pink-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const rec = stats?.recruitment || {};
  const g = stats?.guild || {};
  const ev = stats?.events || {};
  const sys = stats?.system || {};

  return (
    <div className="space-y-8 max-w-5xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
            <BarChart3 className="w-6 h-6 text-pink-500" />
            Статистика семьи и сервера
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Детальная аналитика набора, активности мероприятий, состава и внешний доступ по API
          </p>
        </div>

        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#151921] border border-[#1E232F] text-xs text-slate-300">
          <Users className="w-4 h-4 text-emerald-400" />
          <span>Онлайн в войсе: <strong className="text-white">{g.voiceOnline || 0}</strong></span>
        </div>
      </div>

      {/* Server & Guild Live Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-[#151921] border border-[#1E232F] rounded-2xl p-4">
          <p className="text-[11px] font-semibold text-slate-400 uppercase">Всего участников</p>
          <p className="text-xl font-bold text-white mt-1.5">{g.totalMembers || 0}</p>
        </div>

        <div className="bg-[#151921] border border-[#1E232F] rounded-2xl p-4">
          <p className="text-[11px] font-semibold text-emerald-400 uppercase">Игроков (людей)</p>
          <p className="text-xl font-bold text-emerald-400 mt-1.5">{g.humanCount || 0}</p>
        </div>

        <div className="bg-[#151921] border border-[#1E232F] rounded-2xl p-4">
          <p className="text-[11px] font-semibold text-indigo-400 uppercase flex items-center gap-1">
            <Mic className="w-3 h-3" /> В голосовых
          </p>
          <p className="text-xl font-bold text-indigo-300 mt-1.5">{g.voiceOnline || 0}</p>
        </div>

        <div className="bg-[#151921] border border-[#1E232F] rounded-2xl p-4">
          <p className="text-[11px] font-semibold text-amber-400 uppercase">Сборов МП</p>
          <p className="text-xl font-bold text-amber-300 mt-1.5">{ev.total || 0}</p>
        </div>

        <div className="bg-[#151921] border border-[#1E232F] rounded-2xl p-4">
          <p className="text-[11px] font-semibold text-teal-400 uppercase">Явок на сборы</p>
          <p className="text-xl font-bold text-teal-300 mt-1.5">{ev.totalTurnout || 0}</p>
        </div>

        <div className="bg-[#151921] border border-[#1E232F] rounded-2xl p-4">
          <p className="text-[11px] font-semibold text-purple-400 uppercase">Сохранено ролей</p>
          <p className="text-xl font-bold text-purple-300 mt-1.5">{sys.savedRolesProfiles || 0}</p>
        </div>
      </div>

      {/* Recruitment Metrics */}
      <div>
        <h2 className="text-sm font-bold text-white uppercase tracking-wider mb-3">
          Аналитика рекрутинга
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-[#151921] border border-[#1E232F] rounded-2xl p-5">
            <p className="text-xs font-semibold text-slate-400 uppercase">Всего анкет</p>
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
            <p className="text-2xl font-bold text-indigo-300 mt-2">{rec.approvalRate || 0}%</p>
          </div>
        </div>
      </div>

      {/* Recruiter Leaderboard */}
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
                    Пока ни одна заявка не была обработана рекрутерами
                  </td>
                </tr>
              ) : (
                rec.leaderboard.map((r: any, idx: number) => {
                  const rate = r.total > 0 ? Math.round((r.accepted / r.total) * 100) : 0;
                  return (
                    <tr key={idx} className="hover:bg-[#1A1F2B]/60 transition-colors">
                      <td className="px-6 py-4 font-bold text-slate-400">
                        {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}`}
                      </td>
                      <td className="px-6 py-4 font-semibold text-white">
                        {r.tag}
                      </td>
                      <td className="px-6 py-4 text-center font-medium text-slate-300">
                        {r.total}
                      </td>
                      <td className="px-6 py-4 text-center font-semibold text-emerald-400">
                        {r.accepted}
                      </td>
                      <td className="px-6 py-4 text-center font-semibold text-red-400">
                        {r.rejected}
                      </td>
                      <td className="px-6 py-4 text-right font-bold text-indigo-300">
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
