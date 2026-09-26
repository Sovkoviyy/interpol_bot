import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, CheckCircle2, XCircle, Info, Sparkles, HelpCircle, FormInput } from 'lucide-react';

export interface ConfirmOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'pink' | 'warning';
  onConfirm?: () => Promise<void> | void;
}

export interface AlertOptions {
  title?: string;
  message: string;
  type?: 'success' | 'error' | 'info' | 'warning';
  okText?: string;
}

export interface FormField {
  name: string;
  label: string;
  placeholder?: string;
  defaultValue?: string;
  required?: boolean;
}

export interface FormOptions {
  title?: string;
  message?: string;
  fields: FormField[];
  submitText?: string;
  cancelText?: string;
  onSubmit: (values: Record<string, string>) => Promise<void> | void;
}

export interface ModalContextType {
  confirm: (options: ConfirmOptions | string) => Promise<boolean>;
  alert: (options: AlertOptions | string) => Promise<void>;
  form: (options: FormOptions) => void;
  success: (message: string, title?: string) => Promise<void>;
  error: (message: string, title?: string) => Promise<void>;
  warning: (message: string, title?: string) => Promise<void>;
  info: (message: string, title?: string) => Promise<void>;
}

const ModalContext = createContext<ModalContextType | undefined>(undefined);

export const ModalProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Confirm state
  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean;
    options: ConfirmOptions;
    resolve?: (value: boolean) => void;
  }>({
    isOpen: false,
    options: { message: '' },
  });

  // Alert state
  const [alertState, setAlertState] = useState<{
    isOpen: boolean;
    options: AlertOptions;
    resolve?: () => void;
  }>({
    isOpen: false,
    options: { message: '' },
  });

  // Form state
  const [formState, setFormState] = useState<{
    isOpen: boolean;
    options: FormOptions | null;
    values: Record<string, string>;
    isSubmitting: boolean;
    error: string | null;
  }>({
    isOpen: false,
    options: null,
    values: {},
    isSubmitting: false,
    error: null,
  });

  const confirm = useCallback((input: ConfirmOptions | string): Promise<boolean> => {
    const options: ConfirmOptions = typeof input === 'string' ? { message: input } : input;
    return new Promise((resolve) => {
      setConfirmState({
        isOpen: true,
        options: {
          title: options.title || 'Подтверждение действия',
          message: options.message,
          confirmText: options.confirmText || 'Подтвердить',
          cancelText: options.cancelText || 'Отмена',
          type: options.type || 'pink',
          onConfirm: options.onConfirm,
        },
        resolve: async (val: boolean) => {
          if (val && options.onConfirm) {
            await options.onConfirm();
          }
          resolve(val);
        },
      });
    });
  }, []);

  const alert = useCallback((input: AlertOptions | string): Promise<void> => {
    const options: AlertOptions = typeof input === 'string' ? { message: input } : input;
    return new Promise((resolve) => {
      setAlertState({
        isOpen: true,
        options: {
          title: options.title || (options.type === 'error' ? 'Ошибка' : options.type === 'success' ? 'Успешно' : 'Уведомление'),
          message: options.message,
          type: options.type || 'info',
          okText: options.okText || 'Понятно',
        },
        resolve,
      });
    });
  }, []);

  const form = useCallback((options: FormOptions) => {
    const initialValues: Record<string, string> = {};
    for (const f of options.fields) {
      initialValues[f.name] = f.defaultValue || '';
    }
    setFormState({
      isOpen: true,
      options,
      values: initialValues,
      isSubmitting: false,
      error: null,
    });
  }, []);

  const success = useCallback((message: string, title: string = 'Успешно'): Promise<void> => {
    return alert({ message, title, type: 'success' });
  }, [alert]);

  const error = useCallback((message: string, title: string = 'Ошибка'): Promise<void> => {
    return alert({ message, title, type: 'error' });
  }, [alert]);

  const warning = useCallback((message: string, title: string = 'Предупреждение'): Promise<void> => {
    return alert({ message, title, type: 'warning' });
  }, [alert]);

  const info = useCallback((message: string, title: string = 'Информация'): Promise<void> => {
    return alert({ message, title, type: 'info' });
  }, [alert]);

  const handleConfirmClose = (result: boolean) => {
    if (confirmState.resolve) {
      confirmState.resolve(result);
    }
    setConfirmState(prev => ({ ...prev, isOpen: false }));
  };

  const handleAlertClose = () => {
    if (alertState.resolve) {
      alertState.resolve();
    }
    setAlertState(prev => ({ ...prev, isOpen: false }));
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formState.options) return;

    // Validate required fields
    for (const f of formState.options.fields) {
      if (f.required && !formState.values[f.name]?.trim()) {
        setFormState(prev => ({ ...prev, error: `Поле «${f.label}» обязательно для заполнения` }));
        return;
      }
    }

    try {
      setFormState(prev => ({ ...prev, isSubmitting: true, error: null }));
      await formState.options.onSubmit(formState.values);
      setFormState(prev => ({ ...prev, isOpen: false }));
    } catch (err: any) {
      setFormState(prev => ({ ...prev, error: err.message || 'Ошибка отправки формы' }));
    } finally {
      setFormState(prev => ({ ...prev, isSubmitting: false }));
    }
  };

  // Keyboard handler for Escape & Enter
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (confirmState.isOpen) {
        if (e.key === 'Escape') handleConfirmClose(false);
        else if (e.key === 'Enter') handleConfirmClose(true);
      } else if (alertState.isOpen) {
        if (e.key === 'Escape' || e.key === 'Enter') handleAlertClose();
      } else if (formState.isOpen) {
        if (e.key === 'Escape' && !formState.isSubmitting) {
          setFormState(prev => ({ ...prev, isOpen: false }));
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [confirmState.isOpen, alertState.isOpen, formState.isOpen, formState.isSubmitting]);

  return (
    <ModalContext.Provider value={{ confirm, alert, form, success, error, warning, info }}>
      {children}

      {/* Confirmation Modal */}
      <AnimatePresence>
        {confirmState.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="fixed inset-0 bg-black/80 backdrop-blur-md"
              onClick={() => handleConfirmClose(false)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.94, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 8 }}
              transition={{ type: 'spring', duration: 0.28, bounce: 0.12 }}
              onClick={(e) => e.stopPropagation()}
              className="relative z-10 w-full max-w-md bg-[#0B0E14] border border-pink-500/20 rounded-2xl p-6 shadow-2xl shadow-pink-950/40 overflow-hidden"
            >
              {/* Ambient Pink Glow Header */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-pink-600 via-rose-500 to-fuchsia-600" />

              <div className="flex items-start gap-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  confirmState.options.type === 'danger'
                    ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                    : confirmState.options.type === 'warning'
                    ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                    : 'bg-pink-500/10 text-pink-400 border border-pink-500/20'
                }`}>
                  {confirmState.options.type === 'danger' ? (
                    <AlertTriangle className="w-5 h-5 text-red-400" />
                  ) : confirmState.options.type === 'warning' ? (
                    <AlertTriangle className="w-5 h-5 text-amber-400" />
                  ) : (
                    <Sparkles className="w-5 h-5 text-pink-400" />
                  )}
                </div>

                <div className="flex-1">
                  <h3 className="text-base font-bold text-white mb-1.5">
                    {confirmState.options.title}
                  </h3>
                  <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-line">
                    {confirmState.options.message}
                  </p>
                </div>
              </div>

              <div className="mt-6 flex items-center justify-end gap-3 pt-3 border-t border-[#1E232F]">
                <button
                  type="button"
                  onClick={() => handleConfirmClose(false)}
                  className="px-4 py-2 rounded-xl bg-[#151922] hover:bg-[#1E232F] text-slate-300 hover:text-white font-medium text-xs transition-colors"
                >
                  {confirmState.options.cancelText}
                </button>
                <button
                  type="button"
                  autoFocus
                  onClick={() => handleConfirmClose(true)}
                  className={`px-5 py-2 rounded-xl text-white font-semibold text-xs shadow-lg transition-all ${
                    confirmState.options.type === 'danger'
                      ? 'bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 shadow-red-600/25'
                      : confirmState.options.type === 'warning'
                      ? 'bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 shadow-amber-600/25'
                      : 'bg-gradient-to-r from-pink-600 to-rose-500 hover:from-pink-500 hover:to-rose-400 shadow-pink-600/25'
                  }`}
                >
                  {confirmState.options.confirmText}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Alert / Notification Modal */}
      <AnimatePresence>
        {alertState.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="fixed inset-0 bg-black/80 backdrop-blur-md"
              onClick={handleAlertClose}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.94, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 8 }}
              transition={{ type: 'spring', duration: 0.28, bounce: 0.12 }}
              onClick={(e) => e.stopPropagation()}
              className="relative z-10 w-full max-w-md bg-[#0B0E14] border border-pink-500/20 rounded-2xl p-6 shadow-2xl shadow-pink-950/40 overflow-hidden"
            >
              <div className={`absolute top-0 left-0 right-0 h-1 ${
                alertState.options.type === 'error'
                  ? 'bg-gradient-to-r from-red-600 to-rose-600'
                  : alertState.options.type === 'warning'
                  ? 'bg-gradient-to-r from-amber-600 to-amber-500'
                  : alertState.options.type === 'success'
                  ? 'bg-gradient-to-r from-pink-600 via-rose-500 to-fuchsia-600'
                  : 'bg-gradient-to-r from-pink-500 to-purple-600'
              }`} />

              <div className="flex items-start gap-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  alertState.options.type === 'error'
                    ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                    : alertState.options.type === 'warning'
                    ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                    : alertState.options.type === 'success'
                    ? 'bg-pink-500/10 text-pink-400 border border-pink-500/20'
                    : 'bg-slate-700/20 text-slate-300 border border-slate-700/30'
                }`}>
                  {alertState.options.type === 'error' && <XCircle className="w-5 h-5 text-red-400" />}
                  {alertState.options.type === 'warning' && <AlertTriangle className="w-5 h-5 text-amber-400" />}
                  {alertState.options.type === 'success' && <CheckCircle2 className="w-5 h-5 text-pink-400" />}
                  {alertState.options.type === 'info' && <Info className="w-5 h-5 text-indigo-400" />}
                </div>

                <div className="flex-1">
                  <h3 className="text-base font-bold text-white mb-1.5">
                    {alertState.options.title}
                  </h3>
                  <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-line">
                    {alertState.options.message}
                  </p>
                </div>
              </div>

              <div className="mt-6 flex justify-end pt-3 border-t border-[#1E232F]">
                <button
                  type="button"
                  autoFocus
                  onClick={handleAlertClose}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-pink-600 to-rose-500 hover:from-pink-500 hover:to-rose-400 text-white font-semibold text-xs shadow-lg shadow-pink-600/25 transition-all"
                >
                  {alertState.options.okText}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Form Dialog Modal */}
      <AnimatePresence>
        {formState.isOpen && formState.options && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="fixed inset-0 bg-black/80 backdrop-blur-md"
              onClick={() => setFormState(prev => ({ ...prev, isOpen: false }))}
            />
            <motion.form 
              initial={{ opacity: 0, scale: 0.94, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 8 }}
              transition={{ type: 'spring', duration: 0.28, bounce: 0.12 }}
              onSubmit={handleFormSubmit}
              onClick={(e) => e.stopPropagation()}
              className="relative z-10 w-full max-w-lg bg-[#0B0E14] border border-pink-500/20 rounded-2xl p-6 shadow-2xl shadow-pink-950/40 overflow-hidden space-y-4"
            >
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-pink-600 via-rose-500 to-fuchsia-600" />

              <div>
                <h3 className="text-base font-bold text-white mb-1">
                  {formState.options.title || 'Ввод данных'}
                </h3>
                {formState.options.message && (
                  <p className="text-xs text-slate-400 leading-relaxed">
                    {formState.options.message}
                  </p>
                )}
              </div>

              {formState.error && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-400">
                  {formState.error}
                </div>
              )}

              <div className="space-y-3.5 max-h-[60vh] overflow-y-auto pr-1">
                {formState.options.fields.map((field) => (
                  <div key={field.name}>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      {field.label} {field.required && <span className="text-pink-500">*</span>}
                    </label>
                    <input
                      type="text"
                      value={formState.values[field.name] || ''}
                      placeholder={field.placeholder || ''}
                      onChange={(e) => setFormState(prev => ({
                        ...prev,
                        values: { ...prev.values, [field.name]: e.target.value }
                      }))}
                      className="w-full bg-[#151922] border border-[#1E232F] rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-pink-500 transition-colors"
                    />
                  </div>
                ))}
              </div>

              <div className="pt-4 border-t border-[#1E232F] flex items-center justify-end gap-3">
                <button
                  type="button"
                  disabled={formState.isSubmitting}
                  onClick={() => setFormState(prev => ({ ...prev, isOpen: false }))}
                  className="px-4 py-2 rounded-xl bg-[#151922] hover:bg-[#1E232F] text-slate-300 hover:text-white font-medium text-xs transition-colors disabled:opacity-50"
                >
                  {formState.options.cancelText || 'Отмена'}
                </button>
                <button
                  type="submit"
                  disabled={formState.isSubmitting}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-pink-600 to-rose-500 hover:from-pink-500 hover:to-rose-400 text-white font-semibold text-xs shadow-lg shadow-pink-600/25 transition-all disabled:opacity-50"
                >
                  {formState.isSubmitting ? 'Обработка...' : (formState.options.submitText || 'Сохранить')}
                </button>
              </div>
            </motion.form>
          </div>
        )}
      </AnimatePresence>
    </ModalContext.Provider>
  );
};

export const useModal = (): ModalContextType => {
  const context = useContext(ModalContext);
  if (!context) {
    throw new Error('useModal must be used within a ModalProvider');
  }
  return context;
};

export default ModalProvider;
