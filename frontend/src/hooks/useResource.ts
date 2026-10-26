import { useEffect, useState } from "react";
import { api } from "../api";
export function useResource<T>(path: string) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, reload] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setData(null);
    setError("");
    api<T>(path)
      .then((value) => {
        if (active) setData(value);
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [path, revision]);
  return { data, loading, error, retry: () => reload((n) => n + 1) };
}
