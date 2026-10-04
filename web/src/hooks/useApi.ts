import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../api/client';

interface UseApiOptions<T> {
  url: string;
  params?: Record<string, any>;
  initialData?: T;
  autoFetch?: boolean;
}

interface UseApiReturn<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  setData: React.Dispatch<React.SetStateAction<T | null>>;
}

export function useApi<T = any>({ url, params, initialData, autoFetch = true }: UseApiOptions<T>): UseApiReturn<T> {
  const [data, setData] = useState<T | null>(initialData ?? null);
  const [loading, setLoading] = useState(autoFetch);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get(url, { params });
      if (mountedRef.current) {
        setData(res.data);
      }
    } catch (err: any) {
      if (mountedRef.current) {
        setError(err?.response?.data?.error || err?.message || 'Ошибка загрузки данных');
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [url, JSON.stringify(params)]);

  useEffect(() => {
    mountedRef.current = true;
    if (autoFetch) {
      fetchData();
    }
    return () => { mountedRef.current = false; };
  }, [fetchData, autoFetch]);

  return { data, loading, error, refetch: fetchData, setData };
}
