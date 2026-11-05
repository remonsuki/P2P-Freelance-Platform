import { useCallback, useEffect, useRef, useState } from 'react';

/** Reload after mutations, on window focus, and every 15 seconds while visible. */
export function useLiveData(loader) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const sequence = useRef(0);
  const mounted = useRef(false);
  const refresh = useCallback(async () => {
    const current = ++sequence.current;
    try {
      const result = await loader();
      if (mounted.current && current === sequence.current) { setData(result); setError(''); }
      return result;
    } catch (err) {
      if (mounted.current && current === sequence.current) setError(err.message);
      return null;
    } finally {
      if (mounted.current && current === sequence.current) setLoading(false);
    }
  }, [loader]);
  useEffect(() => {
    mounted.current = true;
    const visibleRefresh = () => { if (!document.hidden) void refresh(); };
    void Promise.resolve().then(refresh);
    window.addEventListener('yunbarter:data-changed', visibleRefresh);
    window.addEventListener('focus', visibleRefresh);
    const timer = setInterval(visibleRefresh, 15000);
    return () => {
      mounted.current = false;
      sequence.current += 1;
      clearInterval(timer);
      window.removeEventListener('yunbarter:data-changed', visibleRefresh);
      window.removeEventListener('focus', visibleRefresh);
    };
  }, [refresh]);
  return { data, error, loading, refresh };
}
