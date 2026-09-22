import React, { useEffect, useState } from 'react';
import { 
  Users, 
  UserPlus, 
  CalendarDays, 
  ScrollText, 
  CheckCircle2, 
  AlertCircle,
  ToggleLeft,
  ToggleRight,
  Shield,
  ArrowUpRight
} from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import { useModal } from '../context/ModalContext';

export const Dashboard: React.FC = () => {
  const modal = useModal();
  const [stats, setStats] = useState<any>(null);
  const [config, setConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [statsRes, configRes] = await Promise.all([
        api.get('/stats'),
        api.get('/guild/config'),
      ]);
      setStats(statsRes.data);
      setConfig(configRes.data.config);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleToggleModule = async (moduleKey: string, currentValue: boolean) => {
    try {
      setSaving(true);
      const newConfig = {
        ...config,
        [moduleKey]: !currentValue,
      };
      await api.post('/guild/config', newConfig);
      setConfig(newConfig);
    } catch (err) {
      modal.alert({
        title: 'Ошибка',
        message: 'Ошибка изменения настройки',
        type: 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400">
        <div className="w-8 h-8 border-2 border-pink-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Top Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-pink-950/40 via-[#151921] to-[#0B0E14] border border-pink-500/20 p-8 shadow-lg shadow-pink-950/10">
        <div className="relative z-10 max-w-2xl">
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-pink-500/10 text-pink-400 border border-pink-500/20 mb-4">
            <Shield className="w-3.5 h-3.5" />
            Majestic RP • Family OS
          </span>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">
            {stats?.guild?.name || 'Семья Interpol'}
          </h1>
          <p className="text-slate-300 mt-2 text-sm leading-relaxed">
            Централизованная система управления рекрутингом, сборами на мероприятия (дропы, цеха, капты) и полным аудитом действий Discord-сервера.
          </p>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-[#151921] border border-[#1E232F] rounded-2xl p-6 relative overflow-hidden group hover:border-pink-500/40 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Участников на сервере</span>
            <div className="w-10 h-10 rounded-xl bg-pink-500/10 text-pink-400 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-white">{stats?.guild?.totalMembers || 0}</span>
            <span className="text-xs text-slate-400">человек</span>
          </div>
        </div>

        <div className="bg-[#151921] border border-[#1E232F] rounded-2xl p-6 relative overflow-hidden group hover:border-pink-500/40 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Заявки в ожидании</span>
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
              <UserPlus className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-amber-400">{stats?.recruitment?.pending || 0}</span>
            <span className="text-xs text-slate-400">ждут рекрутера</span>
          </div>
          <Link to="/recruitment" className="mt-3 inline-flex items-center text-xs text-pink-400 hover:text-pink-300 gap-1 font-medium">
            Перейти к заявкам <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="bg-[#151921] border border-[#1E232F] rounded-2xl p-6 relative overflow-hidden group hover:border-pink-500/40 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Активные сборы на МП</span>
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <CalendarDays className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-emerald-400">{stats?.events?.active || 0}</span>
            <span className="text-xs text-slate-400">сборов в процессе</span>
          </div>
          <Link to="/events" className="mt-3 inline-flex items-center text-xs text-pink-400 hover:text-pink-300 gap-1 font-medium">
            Открыть сборы <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* Modules Toggles Box */}
      <div className="bg-[#151921] border border-[#1E232F] rounded-2xl p-6">
        <h2 className="text-base font-bold text-white mb-1">Управление модулями</h2>
        <p className="text-xs text-slate-400 mb-6">Включение и мгновенное отключение функций бота</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Recruitment Module */}
          <div className="p-4 rounded-xl bg-[#1E232F]/50 border border-[#1E232F] flex items-center justify-between hover:border-pink-500/30 transition-all">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-pink-500/10 text-pink-400 flex items-center justify-center">
                <UserPlus className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-100">Заявки в семью</p>
                <p className="text-xs text-slate-400">Форма и тикеты</p>
              </div>
            </div>
            <button
              onClick={() => handleToggleModule('recruitmentEnabled', config?.recruitmentEnabled)}
              disabled={saving}
              className="text-slate-300 hover:text-white"
            >
              {config?.recruitmentEnabled ? (
                <ToggleRight className="w-8 h-8 text-pink-500" />
              ) : (
                <ToggleLeft className="w-8 h-8 text-slate-500" />
              )}
            </button>
          </div>

          {/* Events Module */}
          <div className="p-4 rounded-xl bg-[#1E232F]/50 border border-[#1E232F] flex items-center justify-between hover:border-pink-500/30 transition-all">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-rose-500/10 text-rose-400 flex items-center justify-center">
                <CalendarDays className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-100">Сборы на МП</p>
                <p className="text-xs text-slate-400">Дропы, цеха, пинги</p>
              </div>
            </div>
            <button
              onClick={() => handleToggleModule('eventsEnabled', config?.eventsEnabled)}
              disabled={saving}
              className="text-slate-300 hover:text-white"
            >
              {config?.eventsEnabled ? (
                <ToggleRight className="w-8 h-8 text-pink-500" />
              ) : (
                <ToggleLeft className="w-8 h-8 text-slate-500" />
              )}
            </button>
          </div>

          {/* Logging Module */}
          <div className="p-4 rounded-xl bg-[#1E232F]/50 border border-[#1E232F] flex items-center justify-between hover:border-pink-500/30 transition-all">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center">
                <ScrollText className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-100">Аудит сервера</p>
                <p className="text-xs text-slate-400">Логи всех действий</p>
              </div>
            </div>
            <button
              onClick={() => handleToggleModule('loggingEnabled', config?.loggingEnabled)}
              disabled={saving}
              className="text-slate-300 hover:text-white"
            >
              {config?.loggingEnabled ? (
                <ToggleRight className="w-8 h-8 text-pink-500" />
              ) : (
                <ToggleLeft className="w-8 h-8 text-slate-500" />
              )}
            </button>
          </div>

          {/* Restore Roles Module */}
          <div className="p-4 rounded-xl bg-[#1E232F]/50 border border-[#1E232F] flex items-center justify-between hover:border-pink-500/30 transition-all">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-500/10 text-purple-400 flex items-center justify-center">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-100">Возврат ролей</p>
                <p className="text-xs text-slate-400">При возвращении</p>
              </div>
            </div>
            <button
              onClick={() => handleToggleModule('restoreRolesOnJoin', config?.restoreRolesOnJoin)}
              disabled={saving}
              className="text-slate-300 hover:text-white"
            >
              {config?.restoreRolesOnJoin ? (
                <ToggleRight className="w-8 h-8 text-pink-500" />
              ) : (
                <ToggleLeft className="w-8 h-8 text-slate-500" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
