import React from 'react';

type BadgeVariant = 'success' | 'danger' | 'warning' | 'info' | 'muted';

const variants: Record<BadgeVariant, string> = {
  success: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
  danger: 'bg-red-500/15 text-red-400 border-red-500/25',
  warning: 'bg-amber-500/15 text-amber-400 border-amber-500/25',
  info: 'bg-pink-500/15 text-pink-400 border-pink-500/25',
  muted: 'bg-slate-500/15 text-slate-400 border-slate-500/25',
};

const statusMap: Record<string, { label: string; variant: BadgeVariant }> = {
  ACTIVE: { label: 'Активный', variant: 'success' },
  PENDING: { label: 'Ожидание', variant: 'warning' },
  APPROVED: { label: 'Одобрено', variant: 'success' },
  ACCEPTED: { label: 'Принято', variant: 'success' },
  REJECTED: { label: 'Отклонено', variant: 'danger' },
  UNDER_REVIEW: { label: 'На рассмотрении', variant: 'warning' },
  CANCELLED: { label: 'Отменено', variant: 'muted' },
  FINISHED: { label: 'Завершено', variant: 'muted' },
  ON_LEAVE: { label: 'В отпуске', variant: 'info' },
  BLACKLISTED: { label: 'ЧС', variant: 'danger' },
  PROMOTED: { label: 'Повышен', variant: 'success' },
  ARCHIVED: { label: 'Архив', variant: 'muted' },
  OPEN: { label: 'Открыт', variant: 'success' },
  CLOSED: { label: 'Закрыт', variant: 'muted' },
  REVIEWED: { label: 'Проверено', variant: 'info' },
  PAID: { label: 'Выплачено', variant: 'success' },
  AFK: { label: 'Неактив', variant: 'warning' },
  CONFIRMED: { label: 'Подтверждено', variant: 'success' },
  RESERVE: { label: 'Резерв', variant: 'warning' },
};

interface StatusBadgeProps {
  status: string;
  label?: string;
  variant?: BadgeVariant;
  size?: 'sm' | 'md';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, label, variant, size = 'sm' }) => {
  const mapped = statusMap[status];
  const finalLabel = label || mapped?.label || status;
  const finalVariant = variant || mapped?.variant || 'muted';
  const sizeClass = size === 'sm' ? 'text-[10px] px-2 py-0.5' : 'text-xs px-2.5 py-1';

  return (
    <span className={`inline-flex items-center gap-1 rounded-md font-semibold uppercase tracking-wider border ${sizeClass} ${variants[finalVariant]}`}>
      {finalLabel}
    </span>
  );
};
