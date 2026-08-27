"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { AppointmentDTO, BlockDTO, PatientDTO, SnapshotDTO } from "@/lib/types";
import { SNAPSHOT_CACHE_KEY } from "@/lib/types";
import { apiFetch, OfflineError } from "@/lib/api-client";
import { useOnlineStatus } from "./useOnlineStatus";

function readCache(): SnapshotDTO | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(SNAPSHOT_CACHE_KEY);
    return raw ? (JSON.parse(raw) as SnapshotDTO) : null;
  } catch {
    return null;
  }
}

function writeCache(snapshot: SnapshotDTO) {
  try {
    localStorage.setItem(SNAPSHOT_CACHE_KEY, JSON.stringify(snapshot));
  } catch {
    /* quota */
  }
}

type AdminData = {
  snapshot: SnapshotDTO;
  fromCache: boolean;
  refreshing: boolean;
  online: boolean;
  serverUnreachable: boolean;
  refresh: () => Promise<void>;
  setSnapshot: (next: SnapshotDTO | ((prev: SnapshotDTO) => SnapshotDTO)) => void;
  upsertAppointment: (a: AppointmentDTO) => void;
  removeAppointment: (id: string) => void;
  upsertBlock: (b: BlockDTO) => void;
  removeBlock: (id: string) => void;
  upsertPatient: (p: PatientDTO) => void;
};

const empty: SnapshotDTO = {
  appointments: [],
  patients: [],
  blocks: [],
  serverTime: new Date(0).toISOString(),
};

const Ctx = createContext<AdminData | null>(null);

export function AdminDataProvider({ children }: { children: React.ReactNode }) {
  const [snapshot, setSnapshotState] = useState<SnapshotDTO>(empty);
  const [fromCache, setFromCache] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [serverUnreachable, setServerUnreachable] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const online = useOnlineStatus();

  const setSnapshot = useCallback((next: SnapshotDTO | ((prev: SnapshotDTO) => SnapshotDTO)) => {
    setSnapshotState((prev) => {
      const value = typeof next === "function" ? next(prev) : next;
      writeCache(value);
      return value;
    });
  }, []);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await apiFetch("/api/admin/snapshot");
      if (!res.ok) throw new Error("Failed to load");
      const data = (await res.json()) as SnapshotDTO;
      setSnapshot(data);
      setFromCache(false);
      setServerUnreachable(false);
    } catch (err) {
      setFromCache(true);
      setServerUnreachable(!(err instanceof OfflineError));
    } finally {
      setRefreshing(false);
    }
  }, [setSnapshot]);

  useEffect(() => {
    const cached = readCache();
    if (cached) {
      setSnapshotState(cached);
      setFromCache(true);
    }
    setHydrated(true);
    void refresh();
  }, [refresh]);

  const wasOnline = useRef(online);
  useEffect(() => {
    if (online && !wasOnline.current) void refresh();
    wasOnline.current = online;
  }, [online, refresh]);

  const upsertAppointment = useCallback(
    (a: AppointmentDTO) => {
      setSnapshot((prev) => {
        const exists = prev.appointments.some((x) => x.id === a.id);
        const appointments = exists
          ? prev.appointments.map((x) => (x.id === a.id ? a : x))
          : [...prev.appointments, a];
        return { ...prev, appointments };
      });
    },
    [setSnapshot],
  );

  const removeAppointment = useCallback(
    (id: string) => {
      setSnapshot((prev) => ({
        ...prev,
        appointments: prev.appointments.filter((x) => x.id !== id),
      }));
    },
    [setSnapshot],
  );

  const upsertBlock = useCallback(
    (b: BlockDTO) => {
      setSnapshot((prev) => {
        const exists = prev.blocks.some((x) => x.id === b.id);
        const blocks = exists ? prev.blocks.map((x) => (x.id === b.id ? b : x)) : [...prev.blocks, b];
        return { ...prev, blocks };
      });
    },
    [setSnapshot],
  );

  const removeBlock = useCallback(
    (id: string) => {
      setSnapshot((prev) => ({ ...prev, blocks: prev.blocks.filter((x) => x.id !== id) }));
    },
    [setSnapshot],
  );

  const upsertPatient = useCallback(
    (p: PatientDTO) => {
      setSnapshot((prev) => {
        const exists = prev.patients.some((x) => x.id === p.id);
        const patients = exists
          ? prev.patients.map((x) => (x.id === p.id ? p : x))
          : [...prev.patients, p].sort((a, b) => a.name.localeCompare(b.name));
        return { ...prev, patients };
      });
    },
    [setSnapshot],
  );

  const value = useMemo(
    () => ({
      snapshot,
      fromCache,
      refreshing,
      online,
      serverUnreachable,
      refresh,
      setSnapshot,
      upsertAppointment,
      removeAppointment,
      upsertBlock,
      removeBlock,
      upsertPatient,
    }),
    [
      snapshot,
      fromCache,
      refreshing,
      online,
      serverUnreachable,
      refresh,
      setSnapshot,
      upsertAppointment,
      removeAppointment,
      upsertBlock,
      removeBlock,
      upsertPatient,
    ],
  );

  if (!hydrated) {
    return <div className="h-full bg-ivory" />;
  }

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAdminData() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAdminData must be used within AdminDataProvider");
  return ctx;
}
