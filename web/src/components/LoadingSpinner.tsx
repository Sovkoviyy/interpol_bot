import React from 'react';

interface LoadingSpinnerProps {
  message?: string;
  fullPage?: boolean;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ message = 'Загрузка...', fullPage = true }) => (
  <div className={`flex flex-col items-center justify-center gap-3 ${fullPage ? 'h-64' : 'py-8'}`}>
    <div className="relative flex items-center justify-center">
      <div className="w-10 h-10 border-2 border-pink-500/20 border-t-pink-500 rounded-full animate-spin"></div>
      <div className="w-5 h-5 border-2 border-rose-400/30 border-b-rose-400 rounded-full animate-spin absolute" style={{ animationDirection: 'reverse', animationDuration: '0.8s' }}></div>
    </div>
    <p className="text-xs text-slate-500 animate-pulse">{message}</p>
  </div>
);
