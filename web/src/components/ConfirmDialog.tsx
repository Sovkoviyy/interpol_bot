import React from 'react';
import { Modal } from './Modal';
import { AlertTriangle } from 'lucide-react';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'info';
  loading?: boolean;
}

const variantColors = {
  danger: { icon: 'text-red-400 bg-red-500/10 border-red-500/20', btn: 'bg-red-600 hover:bg-red-700' },
  warning: { icon: 'text-amber-400 bg-amber-500/10 border-amber-500/20', btn: 'bg-amber-600 hover:bg-amber-700' },
  info: { icon: 'text-pink-400 bg-pink-500/10 border-pink-500/20', btn: 'bg-pink-600 hover:bg-pink-700' },
};

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title = 'Подтверждение',
  message = 'Вы уверены?',
  confirmLabel = 'Подтвердить',
  cancelLabel = 'Отмена',
  variant = 'danger',
  loading = false,
}) => {
  const colors = variantColors[variant];

  return (
    <Modal isOpen={isOpen} onClose={onClose} maxWidth="max-w-sm">
      <div className="text-center">
        <div className={`w-12 h-12 rounded-xl border flex items-center justify-center mx-auto mb-4 ${colors.icon}`}>
          <AlertTriangle className="w-6 h-6" />
        </div>
        <h3 className="text-base font-bold text-white mb-1">{title}</h3>
        <p className="text-sm text-slate-400 mb-6">{message}</p>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 py-2.5 px-4 bg-[#1E232F] hover:bg-[#2A303F] text-slate-300 rounded-xl text-xs font-medium transition border border-slate-700/50"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`flex-1 py-2.5 px-4 text-white rounded-xl text-xs font-semibold transition shadow-lg ${colors.btn} disabled:opacity-50`}
          >
            {loading ? 'Загрузка...' : confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
};
