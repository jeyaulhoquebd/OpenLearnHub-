import { useCallback, useEffect, useState } from 'react';
import { loadResources } from '../lib/resourceCache';

export function useResources({ force = false } = {}) {
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  const reload = useCallback(() => {
    setReloadKey((value) => value + 1);
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    loadResources({ force: force || reloadKey > 0 })
      .then((items) => {
        if (active) {
          setResources(items);
          setLoading(false);
        }
      })
      .catch((loadError) => {
        if (active) {
          console.warn('[resources]', loadError);
          setError(loadError);
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [force, reloadKey]);

  return { resources, loading, error, reload };
}
