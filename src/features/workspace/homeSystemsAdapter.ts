import { useEffect, useMemo, useState } from 'react';

import {
  homeEnergyDailyProfile,
  homeEnergySnapshot,
  homeSystemRecords,
  type HomeEnergyDailySample,
  type HomeEnergySnapshot,
  type HomeSystemRecord,
} from './homeSystemsModel';

export type HomeSystemsDataSourceStatus = 'local-baseline' | 'backend-ready' | 'offline';

export type HomeSystemsPayload = {
  sourceStatus: HomeSystemsDataSourceStatus;
  snapshot: HomeEnergySnapshot;
  dailyProfile: HomeEnergyDailySample[];
  records: HomeSystemRecord[];
  updatedAt: string;
  error?: string;
};

type HomeSystemsImportMetaEnv = ImportMetaEnv & {
  readonly VITE_HOME_SYSTEMS_API_URL?: string;
};

type JsonFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

function getHomeSystemsApiUrl() {
  return (import.meta.env as HomeSystemsImportMetaEnv).VITE_HOME_SYSTEMS_API_URL;
}

export function createLocalHomeSystemsPayload(now = new Date()): HomeSystemsPayload {
  return {
    sourceStatus: 'local-baseline',
    snapshot: homeEnergySnapshot,
    dailyProfile: homeEnergyDailyProfile,
    records: homeSystemRecords,
    updatedAt: now.toISOString(),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object';
}

function normalizePayload(payload: unknown, now = new Date()): HomeSystemsPayload {
  const fallback = createLocalHomeSystemsPayload(now);
  if (!isRecord(payload)) return { ...fallback, sourceStatus: 'backend-ready' };

  return {
    sourceStatus: 'backend-ready',
    snapshot: isRecord(payload.snapshot) ? { ...fallback.snapshot, ...payload.snapshot } : fallback.snapshot,
    dailyProfile: Array.isArray(payload.dailyProfile) && payload.dailyProfile.length
      ? payload.dailyProfile as HomeEnergyDailySample[]
      : fallback.dailyProfile,
    records: Array.isArray(payload.records) && payload.records.length ? payload.records as HomeSystemRecord[] : fallback.records,
    updatedAt: typeof payload.updatedAt === 'string' ? payload.updatedAt : now.toISOString(),
  };
}

export async function fetchHomeSystemsPayload(apiUrl: string, fetchImpl: JsonFetch, now = new Date()): Promise<HomeSystemsPayload> {
  const response = await fetchImpl(apiUrl);
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`.trim());
  }

  return normalizePayload(await response.json(), now);
}

export function useHomeSystemsData(refreshMs = 120_000): HomeSystemsPayload {
  const fallbackPayload = useMemo(() => createLocalHomeSystemsPayload(), []);
  const [payload, setPayload] = useState<HomeSystemsPayload>(fallbackPayload);

  useEffect(() => {
    const apiUrl = getHomeSystemsApiUrl();
    if (!apiUrl || typeof window === 'undefined' || typeof window.fetch !== 'function') {
      setPayload(fallbackPayload);
      return;
    }

    let cancelled = false;
    const fetchImpl = window.fetch.bind(window);

    const loadHomeSystems = async () => {
      try {
        const nextPayload = await fetchHomeSystemsPayload(apiUrl, fetchImpl);
        if (!cancelled) setPayload(nextPayload);
      } catch (error) {
        if (!cancelled) {
          setPayload({
            ...createLocalHomeSystemsPayload(),
            sourceStatus: 'offline',
            error: `Home systems backend unavailable: ${error instanceof Error ? error.message : 'request failed'}`,
          });
        }
      }
    };

    void loadHomeSystems();
    const interval = window.setInterval(loadHomeSystems, refreshMs);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [fallbackPayload, refreshMs]);

  return payload;
}
