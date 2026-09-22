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
  Key, 
  Copy, 
  Check, 
  Terminal, 
  Sparkles,
  Bot
} from 'lucide-react';
import api from '../api/client';
import { useModal } from '../context/ModalContext';

export const Stats: React.FC = () => {
  const modal = useModal();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [generatingKey, setGeneratingKey] = useState(false);
  const [copied, setCopied] = useState(false);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const res = await api.get('/stats');
      setStats(res.data);
      setApiKey(res.data.apiKey);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const handleGenerateKey = async () => {
    if (apiKey) {
      const confirmed = await modal.confirm({
        title: 'Перевыпуск ключа',
        message: 'Старый API-ключ перестанет действовать. Вы уверены, что хотите перевыпустить новый ключ?',
        confirmText: 'Перевыпустить',
        type: 'pink',
      });
      if (!confirmed) return;
    }

    try {
      setGeneratingKey(true);
      const res = await api.post('/stats/api-key/generate');
      if (res.data?.apiKey) {
        setApiKey(res.data.apiKey);
        modal.alert({
          title: 'Успешно',
          message: 'Новый API-ключ успешно сгенерирован!',
          type: 'success',
        });
      }
    } catch (err) {
      modal.alert({
        title: 'Ошибка',
        message: 'Ошибка при генерации ключа API',
        type: 'error',
      });
    } finally {
      setGeneratingKey(false);
    }
  };

  const handleCopyCurl = () => {
    if (!apiKey) return;
    const origin = window.location.origin;
    const curl = `curl -H "X-API-Key: ${apiKey}" ${origin}/api/stats/external`;
    navigator.clipboard.writeText(curl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

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

      {/* External API Access Section */}
      <div className="bg-[#151921] border border-pink-500/20 rounded-2xl p-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-pink-600/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-pink-500/10 border border-pink-500/20 flex items-center justify-center text-pink-400">
              <Key className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                Внешний доступ к статистике по REST API
                <span className="px-2 py-0.5 rounded-full bg-pink-500/10 border border-pink-500/30 text-[10px] text-pink-400 font-semibold">
                  API Key
                </span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Используйте этот эндпоинт для автоматической выгрузки статистики на ваш сайт, форум или во внешние боты
              </p>
            </div>
          </div>

          <button
            onClick={handleGenerateKey}
            disabled={generatingKey}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-gradient-to-r from-pink-600 to-rose-500 hover:from-pink-500 hover:to-rose-400 text-white font-semibold text-xs transition-all shadow-md shadow-pink-600/25 disabled:opacity-50"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{apiKey ? 'Перевыпустить ключ' : 'Создать API ключ'}</span>
          </button>
        </div>

        {apiKey ? (
          <div className="space-y-3 mt-4">
            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1">Ваш секретный API-ключ:</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={apiKey}
                  className="w-full bg-[#0B0E14] border border-[#1E232F] rounded-xl px-3 py-2 text-xs text-pink-300 font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1">Пример cURL запроса:</label>
              <div className="relative">
                <pre className="p-3 bg-[#0B0E14] border border-[#1E232F] rounded-xl text-slate-300 text-xs font-mono overflow-x-auto">
                  {`curl -X GET "${window.location.origin}/api/stats/external" \\\n  -H "X-API-Key: ${apiKey}"`}
                </pre>
                <button
                  onClick={handleCopyCurl}
                  className="absolute top-2.5 right-2.5 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#151921] hover:bg-[#1E232F] text-slate-300 hover:text-white border border-[#1E232F] text-[11px] transition-all"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Скопировано!' : 'Копировать'}</span>
                </button>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-xs text-slate-400 italic">
            Ключ пока не создан. Нажмите кнопку «Создать API ключ», чтобы получить доступ к внешнему API.
          </p>
        )}
      </div>
    </div>
  );
};

export default Stats;
