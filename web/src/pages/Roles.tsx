import React, { useEffect, useState } from 'react';
import { ShieldCheck, Save, Plus, Trash2, Check, X, ShieldAlert } from 'lucide-react';
import api from '../api/client';

export const Roles: React.FC = () => {
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
      [permKey]: !currentValue,
    };

    try {
      await api.post('/rbac', updated);
      fetchData();
    } catch (err) {
      alert('Ошибка обновления прав');
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
      alert('Ошибка добавления роли');
    }
  };

  const handleDeleteRole = async (roleId: string) => {
    if (!confirm('Удалить права доступа для этой роли?')) return;
    try {
      await api.delete(`/rbac/${roleId}`);
      fetchData();
    } catch (err) {
      alert('Ошибка удаления');
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
          <ShieldCheck className="w-6 h-6 text-purple-400" />
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
          className="bg-[#0B0E14] border border-[#1E232F] rounded-xl px-3 py-2 text-xs text-slate-200 flex-1 max-w-xs"
        >
          <option value="">Выберите роль Discord для настройки...</option>
          {roles.map((r) => (
            <option key={r.id} value={r.id}>@{r.name}</option>
          ))}
        </select>

        <button
          onClick={handleAddRole}
          disabled={!selectedRoleToAdd}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs transition-all disabled:opacity-40"
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
              <th className="px-4 py-3.5 text-center">Настройки бота</th>
              <th className="px-4 py-3.5 text-center">Заявки и рекрутинг</th>
              <th className="px-4 py-3.5 text-center">Сборы на МП</th>
              <th className="px-4 py-3.5 text-center">Логи аудита</th>
              <th className="px-4 py-3.5 text-right">Действие</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1E232F]">
            {permissions.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                  Пока ни одна роль не добавлена (администраторы Discord имеют полный доступ по умолчанию)
                </td>
              </tr>
            ) : (
              permissions.map((p) => (
                <tr key={p.id} className="hover:bg-[#1E232F]/30 transition-colors">
                  <td className="px-6 py-4">
                    <span className="font-bold text-slate-200">@{p.roleName || p.roleId}</span>
                    <p className="text-[10px] text-slate-500">ID: {p.roleId}</p>
                  </td>

                  {/* Manage Settings */}
                  <td className="px-4 py-4 text-center">
                    <button
                      onClick={() => handleTogglePerm(p.roleId, 'manageSettings', p.manageSettings)}
                      className={`w-7 h-7 rounded-lg inline-flex items-center justify-center transition-all ${
                        p.manageSettings
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : 'bg-[#0B0E14] text-slate-600 border border-[#1E232F]'
                      }`}
                    >
                      {p.manageSettings ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                    </button>
                  </td>

                  {/* Manage Recruiting */}
                  <td className="px-4 py-4 text-center">
                    <button
                      onClick={() => handleTogglePerm(p.roleId, 'manageRecruiting', p.manageRecruiting)}
                      className={`w-7 h-7 rounded-lg inline-flex items-center justify-center transition-all ${
                        p.manageRecruiting
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : 'bg-[#0B0E14] text-slate-600 border border-[#1E232F]'
                      }`}
                    >
                      {p.manageRecruiting ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                    </button>
                  </td>

                  {/* Manage Events */}
                  <td className="px-4 py-4 text-center">
                    <button
                      onClick={() => handleTogglePerm(p.roleId, 'manageEvents', p.manageEvents)}
                      className={`w-7 h-7 rounded-lg inline-flex items-center justify-center transition-all ${
                        p.manageEvents
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : 'bg-[#0B0E14] text-slate-600 border border-[#1E232F]'
                      }`}
                    >
                      {p.manageEvents ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                    </button>
                  </td>

                  {/* View Logs */}
                  <td className="px-4 py-4 text-center">
                    <button
                      onClick={() => handleTogglePerm(p.roleId, 'viewLogs', p.viewLogs)}
                      className={`w-7 h-7 rounded-lg inline-flex items-center justify-center transition-all ${
                        p.viewLogs
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
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
