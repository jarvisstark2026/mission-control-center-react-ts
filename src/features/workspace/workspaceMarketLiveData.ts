import { useEffect, useMemo, useState } from 'react';

import { marketGraphs, type MarketGraph } from './workspaceMarketData';

export type MarketQuoteStatus = 'live' | 'local-baseline' | 'error';

export type MarketLiveStateStatus = 'local-baseline' | 'loading' | 'ready' | 'partial' | 'error';

export type MarketLiveQuote = {
  graphId: string;
  price: number | null;
  priceLabel: string;
  changePercent: number | null;
  changeLabel: string;
  status: MarketQuoteStatus;
  source: 'kraken' | 'frankfurter' | 'local-baseline';
  sourceLabel: string;
  detail: string;
  updatedAt: string;
  sparkline: number[];
};

export type MarketLiveState = {
  status: MarketLiveStateStatus;
  updatedAt: string;
  sourceLabel: string;
  quotes: Record<string, MarketLiveQuote>;
  errors: string[];
};

type MarketImportMetaEnv = ImportMetaEnv & {
  readonly VITE_MARKET_DATA_MODE?: string;
};

type JsonFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

type KrakenTickerRecord = {
  c?: [string, string];
  o?: string;
};

type KrakenTickerResponse = {
  error?: string[];
  result?: Record<string, KrakenTickerRecord>;
};

type FrankfurterRateResponse = {
  rate?: number;
  date?: string;
  rates?: Record<string, number>;
};

const cryptoPairs: Record<string, { request: string; match: string }> = {
  btc: { request: 'XBTUSD', match: 'XBT' },
  eth: { request: 'ETHUSD', match: 'ETH' },
  sol: { request: 'SOLUSD', match: 'SOL' },
};

const fxPairs: Record<string, { base: string; quote: string }> = {
  eurusd: { base: 'EUR', quote: 'USD' },
  gbpusd: { base: 'GBP', quote: 'USD' },
  usdjpy: { base: 'USD', quote: 'JPY' },
};

function shouldFetchLiveMarketData() {
  const env = import.meta.env as MarketImportMetaEnv;
  return env.MODE !== 'test' && env.VITE_MARKET_DATA_MODE !== 'static';
}

function formatPercent(value: number | null) {
  if (value === null || !Number.isFinite(value)) return 'reference';

  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}

function formatUsdPrice(value: number | null) {
  if (value === null || !Number.isFinite(value)) return 'local baseline';

  const maximumFractionDigits = value >= 100 ? 0 : value >= 1 ? 2 : 4;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits,
  }).format(value);
}

function formatFxRate(graphId: string, value: number | null) {
  if (value === null || !Number.isFinite(value)) return 'local baseline';

  const maximumFractionDigits = graphId === 'usdjpy' ? 3 : 5;
  return value.toFixed(maximumFractionDigits);
}

function formatStaticPrice(graph: MarketGraph) {
  return graph.categoryId === 'fx' ? graph.ticker : graph.label;
}

function getSeed(id: string) {
  return id.split('').reduce((sum, character) => sum + character.charCodeAt(0), 0);
}

function createSparkline(id: string, changePercent: number | null) {
  const seed = getSeed(id);
  const trend = Number.isFinite(changePercent) ? Math.max(-14, Math.min(14, changePercent ?? 0)) : 0;

  return Array.from({ length: 16 }, (_, index) => {
    const progress = index / 15;
    const wave = Math.sin(seed * 0.19 + index * 0.82) * 7;
    const secondary = Math.cos(seed * 0.13 + index * 0.38) * 4;
    const value = 52 + wave + secondary + (progress - 0.5) * trend * 2.8;
    return Math.max(8, Math.min(92, Math.round(value)));
  });
}

function createStaticQuote(graph: MarketGraph, updatedAt: string): MarketLiveQuote {
  return {
    graphId: graph.id,
    price: null,
    priceLabel: formatStaticPrice(graph),
    changePercent: null,
    changeLabel: graph.change,
    status: 'local-baseline',
    source: 'local-baseline',
    sourceLabel: 'Local baseline',
    detail: `${graph.note}. Live source is unavailable for this instrument.`,
    updatedAt,
    sparkline: createSparkline(graph.id, null),
  };
}

export function createFallbackMarketLiveState(now = new Date()): MarketLiveState {
  const updatedAt = now.toISOString();

  return {
    status: 'local-baseline',
    updatedAt,
    sourceLabel: 'Local baseline',
    quotes: Object.fromEntries(marketGraphs.map((graph) => [graph.id, createStaticQuote(graph, updatedAt)])),
    errors: [],
  };
}

function buildCryptoUrl() {
  const params = new URLSearchParams({
    pair: Object.values(cryptoPairs)
      .map((pair) => pair.request)
      .join(','),
  });

  return `https://api.kraken.com/0/public/Ticker?${params.toString()}`;
}

function buildFxUrl(base: string, quote: string) {
  return `https://api.frankfurter.dev/v2/rate/${base}/${quote}`;
}

async function readJson(fetchImpl: JsonFetch, url: string) {
  const response = await fetchImpl(url);
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`.trim());
  }

  return (await response.json()) as unknown;
}

function getGraphById(graphId: string) {
  return marketGraphs.find((graph) => graph.id === graphId);
}

function parseFrankfurterRate(payload: unknown, quote: string) {
  if (!payload || typeof payload !== 'object') return null;

  const record = payload as Record<string, unknown>;
  if (typeof record.rate === 'number') return record.rate;

  const rates = record.rates;
  if (rates && typeof rates === 'object') {
    const quotedRate = (rates as Record<string, unknown>)[quote];
    return typeof quotedRate === 'number' ? quotedRate : null;
  }

  return null;
}

function parseKrakenTicker(payload: unknown, match: string) {
  if (!payload || typeof payload !== 'object') return null;

  const response = payload as KrakenTickerResponse;
  if (response.error?.length) return null;

  const ticker = Object.entries(response.result ?? {}).find(([key]) => {
    const normalized = key.toUpperCase();
    return normalized.includes(match) && normalized.includes('USD');
  })?.[1];

  if (!ticker?.c?.[0]) return null;

  const price = Number.parseFloat(ticker.c[0]);
  const open = typeof ticker.o === 'string' ? Number.parseFloat(ticker.o) : null;
  const changePercent = open && Number.isFinite(open) && open > 0 ? ((price - open) / open) * 100 : null;

  if (!Number.isFinite(price)) return null;

  return {
    price,
    changePercent,
  };
}

function parseFrankfurterDate(payload: unknown) {
  if (!payload || typeof payload !== 'object') return null;
  const date = (payload as Record<string, unknown>).date;
  return typeof date === 'string' ? date : null;
}

function mergeQuote(state: MarketLiveState, quote: MarketLiveQuote) {
  state.quotes[quote.graphId] = quote;
}

export async function fetchMarketLiveState(fetchImpl: JsonFetch, now = new Date()): Promise<MarketLiveState> {
  const state = createFallbackMarketLiveState(now);
  const errors: string[] = [];
  let liveQuoteCount = 0;

  try {
    const payload = await readJson(fetchImpl, buildCryptoUrl());

    Object.entries(cryptoPairs).forEach(([graphId, pair]) => {
      const graph = getGraphById(graphId);
      const ticker = parseKrakenTicker(payload, pair.match);
      if (!graph || !ticker) return;

      mergeQuote(state, {
        graphId,
        price: ticker.price,
        priceLabel: formatUsdPrice(ticker.price),
        changePercent: ticker.changePercent,
        changeLabel: formatPercent(ticker.changePercent),
        status: 'live',
        source: 'kraken',
        sourceLabel: 'Kraken public ticker',
        detail: 'Live crypto quote from Kraken public market data.',
        updatedAt: state.updatedAt,
        sparkline: createSparkline(graphId, ticker.changePercent),
      });
      liveQuoteCount += 1;
    });
  } catch (error) {
    errors.push(`Kraken crypto feed unavailable: ${error instanceof Error ? error.message : 'request failed'}`);
  }

  await Promise.all(
    Object.entries(fxPairs).map(async ([graphId, pair]) => {
      const graph = getGraphById(graphId);
      if (!graph) return;

      try {
        const payload = (await readJson(fetchImpl, buildFxUrl(pair.base, pair.quote))) as FrankfurterRateResponse;
        const rate = parseFrankfurterRate(payload, pair.quote);
        if (typeof rate !== 'number') {
          throw new Error('rate was not present in the response');
        }

        const responseDate = parseFrankfurterDate(payload);
        const updatedAt = responseDate ? `${responseDate}T16:00:00.000Z` : state.updatedAt;

        mergeQuote(state, {
          graphId,
          price: rate,
          priceLabel: formatFxRate(graphId, rate),
          changePercent: null,
          changeLabel: 'spot',
          status: 'live',
          source: 'frankfurter',
          sourceLabel: 'Frankfurter',
          detail: `Latest ${pair.base}/${pair.quote} reference rate from Frankfurter open exchange-rate data.`,
          updatedAt,
          sparkline: createSparkline(graphId, null),
        });
        liveQuoteCount += 1;
      } catch (error) {
        errors.push(`${graph.label} FX feed unavailable: ${error instanceof Error ? error.message : 'request failed'}`);
      }
    }),
  );

  const hasErrors = errors.length > 0;

  return {
    ...state,
    status: liveQuoteCount === 0 ? (hasErrors ? 'error' : 'local-baseline') : hasErrors ? 'partial' : 'ready',
    sourceLabel:
      liveQuoteCount === 0
        ? 'Local baseline'
        : hasErrors
          ? 'Live partial'
          : 'Kraken + Frankfurter',
    errors,
  };
}

export function getMarketLiveQuote(state: MarketLiveState, graph: MarketGraph) {
  return state.quotes[graph.id] ?? createStaticQuote(graph, state.updatedAt);
}

export function useMarketLiveData(refreshMs = 120_000): MarketLiveState {
  const fallbackState = useMemo(() => createFallbackMarketLiveState(), []);
  const [state, setState] = useState<MarketLiveState>(fallbackState);

  useEffect(() => {
    if (!shouldFetchLiveMarketData() || typeof window === 'undefined' || typeof window.fetch !== 'function') return;

    let cancelled = false;
    const fetchImpl = window.fetch.bind(window);

    const loadMarketData = async () => {
      setState((current) => ({
        ...current,
        status: current.status === 'local-baseline' ? 'loading' : current.status,
      }));

      const nextState = await fetchMarketLiveState(fetchImpl).catch((error) => ({
        ...createFallbackMarketLiveState(),
        status: 'error' as const,
        sourceLabel: 'Local baseline',
        errors: [`Market data refresh failed: ${error instanceof Error ? error.message : 'request failed'}`],
      }));

      if (!cancelled) {
        setState(nextState);
      }
    };

    void loadMarketData();
    const interval = window.setInterval(loadMarketData, refreshMs);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [refreshMs]);

  return state;
}
