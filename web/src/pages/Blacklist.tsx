import React, { useEffect, useState } from 'react';
import { 
  UserX, 
  Plus, 
  Trash2, 
  Search, 
  ExternalLink,
  ShieldAlert,
  FileCheck,
  Hash
} from 'lucide-react';
import api from '../api/client';
import { useModal } from '../context/ModalContext';

export const Blacklist: React.FC = () => {
  const modal = useModal();
  const [blacklist, setBlacklist] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/blacklist?search=${encodeURIComponent(search)}`);
      setBlacklist(res.data.entries || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [search]);

  const handleAddBlacklist = () => {
    modal.form({
      title: 'Внести нарушителя в ЧС',
      message: 'Заполните данные игрока. По этим данным бот сможет проверять кандидатов на наборе и блокировать доступ.',
      fields: [
        {
          name: 'staticId',
          label: 'Static ID',
          placeholder: 'Например: 142055',
          required: true,
        },
        {
          name: 'discordId',
          label: 'Discord ID (если известен)',
          placeholder: 'Например: 492019482718291024',
        },
        {
          name: 'name',
          label: 'Имя / Никнейм персонажа (IC)',
          placeholder: 'Например: Tony Montana',
        },
        {
          name: 'reason',
          label: 'Причина занесения в ЧС',
          placeholder: 'Слив склада, неадекватное поведение, обман руководства...',
          required: true,
        },
        {
          name: 'proofUrl',
          label: 'Ссылка на доказательства / скриншот / откат',
          placeholder: 'https://imgur.com/... или ссылка на YouTube',
        },
      ],
      submitText: 'Внести в ЧС',
      onSubmit: async (values) => {
        try {
          await api.post('/blacklist', values);
          modal.alert({
            title: 'Внесен в ЧС',
            message: `Игрок со статиком #${values.staticId} успешно добавлен в черный список семьи.`,
            type: 'success',
          });
          fetchData();
        } catch (err: any) {
          modal.alert({
            title: 'Ошибка',
            message: err.response?.data?.error || 'Не удалось добавить запись',
            type: 'error',
          });
        }
      },
    });
  };

  const handleDeleteBlacklist = (entry: any) => {
    modal.confirm({
      title: 'Удалить из ЧС?',
      message: `Вы уверены, что хотите снять ЧС со статика #${entry.staticId} (${entry.name || 'Без имени'})?`,
      type: 'danger',
      confirmText: 'Да, удалить из ЧС',
      onConfirm: async () => {
        try {
          await api.delete(`/blacklist/${entry.id}`);
          modal.alert({
            title: 'Удалено',
            message: 'Запись успешно удалена из черного списка семьи.',
            type: 'success',
          });
          fetchData();
        } catch (err: any) {
          modal.alert({
            title: 'Ошибка',
            message: err.response?.data?.error || 'Не удалось удалить запись',
            type: 'error',
          });
        }
      },
    });
  };

  const withProofCount = blacklist.filter((b) => !!b.proofUrl).length;
  const withDiscordCount = blacklist.filter((b) => !!b.discordId).length;

  return (
    <div className="space-y-6 w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
            <UserX className="w-6 h-6 text-pink-500" />
            Черный список семьи (ЧС)
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            База заблокированных игроков и нарушителей. Автоматическая проверка на наборе и предотвращение инвайтов.
          </p>
        </div>
        <button
          onClick={handleAddBlacklist}
          className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-pink-600 to-pink-500 hover:from-pink-500 hover:to-pink-400 text-white rounded-xl text-sm font-semibold transition-all shadow-lg shadow-pink-500/20"
        >
          <Plus className="w-4 h-4" />
          Добавить в ЧС
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-dark-900/60 border border-dark-800 rounded-2xl p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-pink-500/10 border border-pink-500/20 flex items-center justify-center text-pink-400">
            <UserX className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-white">{blacklist.length}</div>
            <div className="text-xs text-gray-400">Всего в черном списке</div>
          </div>
        </div>

        <div className="bg-dark-900/60 border border-dark-800 rounded-2xl p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
            <FileCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-white">{withProofCount}</div>
            <div className="text-xs text-gray-400">С прикрепленными пруфами</div>
          </div>
        </div>

        <div className="bg-dark-900/60 border border-dark-800 rounded-2xl p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <Hash className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-white">{withDiscordCount}</div>
            <div className="text-xs text-gray-400">С Discord ID</div>
          </div>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="bg-dark-900/60 border border-dark-800 rounded-2xl p-6 backdrop-blur-sm space-y-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-gray-500 absolute left-3 top-3" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск по статику, нику или Discord ID..."
              className="w-full bg-dark-800/80 border border-dark-700 rounded-xl pl-9 pr-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-pink-500 transition-colors"
            />
          </div>
          <span className="text-xs text-gray-400">Найдено записей: {blacklist.length}</span>
        </div>

        {loading ? (
          <div className="text-center py-10 text-gray-500 text-sm">Загрузка черного списка...</div>
        ) : blacklist.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-dark-800 rounded-xl">
            <UserX className="w-10 h-10 text-gray-600 mx-auto mb-3" />
            <p className="text-sm text-gray-400">Черный список пуст</p>
            <p className="text-xs text-gray-500 mt-1">Добавьте нарушителей с помощью кнопки сверху</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-300">
              <thead className="text-xs text-gray-400 uppercase bg-dark-800/50 border-b border-dark-800">
                <tr>
                  <th className="px-4 py-3">Статик / Персонаж</th>
                  <th className="px-4 py-3">Discord ID</th>
                  <th className="px-4 py-3">Причина занесения</th>
                  <th className="px-4 py-3">Док-ва</th>
                  <th className="px-4 py-3">Кем внесен</th>
                  <th className="px-4 py-3 text-right">Действие</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-800">
                {blacklist.map((entry) => (
                  <tr key={entry.id} className="hover:bg-dark-800/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-pink-400 font-mono">#{entry.staticId}</div>
                      {entry.name && <div className="text-xs text-gray-400">{entry.name}</div>}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-400">
                      {entry.discordId || '—'}
                    </td>
                    <td className="px-4 py-3 max-w-xs truncate text-gray-200" title={entry.reason}>
                      {entry.reason}
                    </td>
                    <td className="px-4 py-3">
                      {entry.proofUrl ? (
                        <a
                          href={entry.proofUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-pink-400 hover:text-pink-300 underline"
                        >
                          Пруф <ExternalLink className="w-3 h-3" />
                        </a>
                      ) : (
                        <span className="text-xs text-gray-500">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400">
                      <div>{entry.addedByTag}</div>
                      <div className="text-[10px] text-gray-500">
                        {new Date(entry.createdAt).toLocaleDateString('ru-RU')}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleDeleteBlacklist(entry)}
                        className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                        title="Снять ЧС"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default Blacklist;
