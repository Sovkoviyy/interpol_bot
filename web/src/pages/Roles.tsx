import React, { useEffect, useState } from 'react';
import { ShieldCheck, Save, Plus, Trash2, Check, X, ShieldAlert } from 'lucide-react';
import api from '../api/client';
import { useModal } from '../context/ModalContext';

export const Roles: React.FC = () => {
  const modal = useModal();
  const [roles, setRoles] = useState<any[]>([]);
  const [permissions, setPermissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedRoleToAdd, setSelectedRoleToAdd] = useState('');

  const fetchData = async () => {
    try {
      setLoading(true);
      const [rolesRes, permsRes] = await Promise.all([
        api.get('/guild/roles'),
        api.get('/rbac'),
      ]);
      setRoles(rolesRes.data.roles);
      setPermissions(permsRes.data.permissions);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleTogglePerm = async (roleId: string, permKey: string, currentValue: boolean) => {
    const existing = permissions.find((p) => p.roleId === roleId);
    const roleObj = roles.find((r) => r.id === roleId);

    const updated = {
      roleId,
      roleName: roleObj?.name || 'Unknown',
      manageSettings: existing ? existing.manageSettings : false,
      manageRecruiting: existing ? existing.manageRecruiting : false,
      manageEvents: existing ? existing.manageEvents : false,
      viewLogs: existing ? existing.viewLogs : false,
      manageAcademy: existing ? existing.manageAcademy : false,
      manageVoiceTracker: existing ? existing.manageVoiceTracker : false,
      antiNukeAlerts: existing ? existing.antiNukeAlerts : false,
      [permKey]: !currentValue,
    };

    try {
      await api.post('/rbac', updated);
      fetchData();
    } catch (err) {
      modal.alert({
        title: 'Ошибка',
        message: 'Ошибка обновления прав',
        type: 'error',
      });
    }
  };

  const handleAddRole = async () => {
    if (!selectedRoleToAdd) return;
    const roleObj = roles.find((r) => r.id === selectedRoleToAdd);

    try {
      await api.post('/rbac', {
        roleId: selectedRoleToAdd,
        roleName: roleObj?.name || 'Unknown',
        manageSettings: false,
        manageRecruiting: true,
        manageEvents: true,
        viewLogs: false,
      });
      setSelectedRoleToAdd('');
      fetchData();
    } catch (err) {
      modal.alert({
        title: 'Ошибка',
        message: 'Ошибка добавления роли',
        type: 'error',
      });
    }
  };

  const handleDeleteRole = async (roleId: string) => {
    const confirmed = await modal.confirm({
      title: 'Удаление прав роли',
      message: 'Удалить права доступа для этой роли из панели управления?',
      confirmText: 'Удалить',
      type: 'danger',
    });
    if (!confirmed) return;

    try {
      await api.delete(`/rbac/${roleId}`);
      fetchData();
    } catch (err) {
      modal.alert({
        title: 'Ошибка',
        message: 'Ошибка удаления прав роли',
        type: 'error',
      });
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
          <ShieldCheck className="w-6 h-6 text-pink-500" />
          Уровни доступа и права ролей (RBAC)
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Назначьте Discord-ролям права на управление разделами веб-панели (Лидер, Замы, Рекрутеры, Офицеры)
        </p>
      </div>

      {/* Add Role Control */}
      <div className="bg-[#151921] border border-[#1E232F] rounded-2xl p-4 flex items-center gap-3">
        <select
          value={selectedRoleToAdd}
          onChange={(e) => setSelectedRoleToAdd(e.target.value)}
          className="bg-[#0B0E14] border border-[#1E232F] rounded-xl px-3 py-2 text-xs text-slate-200 flex-1 max-w-xs focus:outline-none focus:border-pink-500"
        >
          <option value="">Выберите роль Discord для настройки...</option>
          {roles.map((r) => (
            <option key={r.id} value={r.id}>@{r.name}</option>
          ))}
        </select>

        <button
          onClick={handleAddRole}
          disabled={!selectedRoleToAdd}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-pink-600 to-rose-500 hover:from-pink-500 hover:to-rose-400 text-white font-semibold text-xs transition-all shadow-md shadow-pink-600/25 disabled:opacity-40"
        >
          <Plus className="w-4 h-4" />
          <span>Добавить роль в матрицу</span>
        </button>
      </div>

      {/* Permissions Table */}
      <div className="bg-[#151921] border border-[#1E232F] rounded-2xl overflow-hidden shadow-xl">
        <table className="w-full text-left text-xs">
          <thead className="bg-[#1E232F]/60 text-slate-400 uppercase tracking-wider font-semibold border-b border-[#1E232F]">
            <tr>
              <th className="px-6 py-3.5">Роль на сервере</th>
              <th className="px-3 py-3.5 text-center">Настройки</th>
              <th className="px-3 py-3.5 text-center">Рекрутинг</th>
              <th className="px-3 py-3.5 text-center">Академия</th>
              <th className="px-3 py-3.5 text-center">Сборы МП</th>
              <th className="px-3 py-3.5 text-center">Умный войс</th>
              <th className="px-3 py-3.5 text-center">Anti-Nuke</th>
              <th className="px-3 py-3.5 text-center">Логи</th>
              <th className="px-4 py-3.5 text-right">Действие</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1E232F]">
            {permissions.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-6 py-8 text-center text-slate-500">
                  Пока ни одна роль не добавлена (администраторы Discord имеют полный доступ по умолчанию)
                </td>
              </tr>
            ) : (
              permissions.map((p) => (
                <tr key={p.id} className="hover:bg-[#1E232F]/30 transition-colors">
                  <td className="px-6 py-4">
                    <span className="font-bold text-slate-200">@{p.roleName || p.roleId}</span>
                    <p className="text-[10px] text-slate-500 font-mono">ID: {p.roleId}</p>
                  </td>

                  {/* Manage Settings */}
                  <td className="px-3 py-4 text-center">
                    <button
                      onClick={() => handleTogglePerm(p.roleId, 'manageSettings', p.manageSettings)}
                      className={`w-7 h-7 rounded-lg inline-flex items-center justify-center transition-all ${
                        p.manageSettings
                          ? 'bg-pink-600/20 text-pink-400 border border-pink-500/40'
                          : 'bg-[#0B0E14] text-slate-600 border border-[#1E232F]'
                      }`}
                    >
                      {p.manageSettings ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                    </button>
                  </td>

                  {/* Manage Recruiting */}
                  <td className="px-3 py-4 text-center">
                    <button
                      onClick={() => handleTogglePerm(p.roleId, 'manageRecruiting', p.manageRecruiting)}
                      className={`w-7 h-7 rounded-lg inline-flex items-center justify-center transition-all ${
                        p.manageRecruiting
                          ? 'bg-pink-600/20 text-pink-400 border border-pink-500/40'
                          : 'bg-[#0B0E14] text-slate-600 border border-[#1E232F]'
                      }`}
                    >
                      {p.manageRecruiting ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                    </button>
                  </td>

                  {/* Manage Academy */}
                  <td className="px-3 py-4 text-center">
                    <button
                      onClick={() => handleTogglePerm(p.roleId, 'manageAcademy', p.manageAcademy)}
                      className={`w-7 h-7 rounded-lg inline-flex items-center justify-center transition-all ${
                        p.manageAcademy
                          ? 'bg-pink-600/20 text-pink-400 border border-pink-500/40'
                          : 'bg-[#0B0E14] text-slate-600 border border-[#1E232F]'
                      }`}
                    >
                      {p.manageAcademy ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                    </button>
                  </td>

                  {/* Manage Events */}
                  <td className="px-3 py-4 text-center">
                    <button
                      onClick={() => handleTogglePerm(p.roleId, 'manageEvents', p.manageEvents)}
                      className={`w-7 h-7 rounded-lg inline-flex items-center justify-center transition-all ${
                        p.manageEvents
                          ? 'bg-pink-600/20 text-pink-400 border border-pink-500/40'
                          : 'bg-[#0B0E14] text-slate-600 border border-[#1E232F]'
                      }`}
                    >
                      {p.manageEvents ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                    </button>
                  </td>

                  {/* Manage Voice Tracker */}
                  <td className="px-3 py-4 text-center">
                    <button
                      onClick={() => handleTogglePerm(p.roleId, 'manageVoiceTracker', p.manageVoiceTracker)}
                      className={`w-7 h-7 rounded-lg inline-flex items-center justify-center transition-all ${
                        p.manageVoiceTracker
                          ? 'bg-pink-600/20 text-pink-400 border border-pink-500/40'
                          : 'bg-[#0B0E14] text-slate-600 border border-[#1E232F]'
                      }`}
                    >
                      {p.manageVoiceTracker ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                    </button>
                  </td>

                  {/* Anti Nuke Alerts */}
                  <td className="px-3 py-4 text-center">
                    <button
                      onClick={() => handleTogglePerm(p.roleId, 'antiNukeAlerts', p.antiNukeAlerts)}
                      className={`w-7 h-7 rounded-lg inline-flex items-center justify-center transition-all ${
                        p.antiNukeAlerts
                          ? 'bg-pink-600/20 text-pink-400 border border-pink-500/40'
                          : 'bg-[#0B0E14] text-slate-600 border border-[#1E232F]'
                      }`}
                    >
                      {p.antiNukeAlerts ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                    </button>
                  </td>

                  {/* View Logs */}
                  <td className="px-3 py-4 text-center">
                    <button
                      onClick={() => handleTogglePerm(p.roleId, 'viewLogs', p.viewLogs)}
                      className={`w-7 h-7 rounded-lg inline-flex items-center justify-center transition-all ${
                        p.viewLogs
                          ? 'bg-pink-600/20 text-pink-400 border border-pink-500/40'
                          : 'bg-[#0B0E14] text-slate-600 border border-[#1E232F]'
                      }`}
                    >
                      {p.viewLogs ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                    </button>
                  </td>

                  <td className="px-4 py-4 text-right">
                    <button
                      onClick={() => handleDeleteRole(p.roleId)}
                      className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Roles;
