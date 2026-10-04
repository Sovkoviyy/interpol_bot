import React from 'react';
import { Inbox } from 'lucide-react';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title?: string;
  description?: string;
  action?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title = 'Нет данных',
  description = 'Здесь пока ничего нет',
  action,
}) => (
  <div className="flex flex-col items-center justify-center py-16 text-center">
    <div className="w-14 h-14 rounded-2xl bg-slate-800/50 border border-slate-700/50 flex items-center justify-center text-slate-500 mb-4">
      {icon || <Inbox className="w-7 h-7" />}
    </div>
    <h3 className="text-sm font-semibold text-slate-300 mb-1">{title}</h3>
    <p className="text-xs text-slate-500 max-w-xs">{description}</p>
    {action && <div className="mt-4">{action}</div>}
  </div>
);
