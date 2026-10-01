"use client";

import { useCallback, useEffect, useState } from "react";
import {
  loadPins,
  startDevelopmentSession,
  type DataProblem,
  type PinRecord,
} from "../lib/pin-data";

export function usePins() {
  const [pins, setPins] = useState<PinRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [problem, setProblem] = useState<DataProblem | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setProblem(null);
    try {
      setPins(await loadPins());
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "error";
      setProblem(
        message === "offline" || message === "expired" ? message : "error",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void loadPins(controller.signal)
      .then((records) => {
        setPins(records);
        setProblem(null);
      })
      .catch((cause: unknown) => {
        if (cause instanceof DOMException && cause.name === "AbortError")
          return;
        const message = cause instanceof Error ? cause.message : "error";
        setProblem(
          message === "offline" || message === "expired" ? message : "error",
        );
      })
      .finally(() => setLoading(false));
    const handleOffline = () => setProblem("offline");
    const handleOnline = () => void reload();
    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);
    return () => {
      controller.abort();
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, [reload]);

  const signIn = useCallback(async () => {
    setLoading(true);
    try {
      await startDevelopmentSession();
      await reload();
    } catch {
      setProblem("error");
      setLoading(false);
    }
  }, [reload]);

  return { pins, loading, problem, reload, signIn };
}
