export type MarketGraph = {
  id: string;
  categoryId: string;
  category: string;
  label: string;
  ticker: string;
  change: string;
  horizon: string;
  note: string;
};

type MarketCategory = {
  id: string;
  label: string;
  summary: string;
  graphs: MarketGraph[];
};

export const marketCategories: MarketCategory[] = [
  {
    id: 'equities',
    label: 'Equities',
    summary: 'indices and large caps',
    graphs: [
      { id: 'spx', categoryId: 'equities', category: 'Equities', label: 'S&P 500', ticker: 'SPX', change: '+0.8%', horizon: '1D / 4H', note: 'broad market benchmark and risk appetite' },
      { id: 'ndx', categoryId: 'equities', category: 'Equities', label: 'Nasdaq 100', ticker: 'NDX', change: '+1.4%', horizon: '1D / 1H', note: 'tech-heavy momentum and volatility' },
      { id: 'ukx', categoryId: 'equities', category: 'Equities', label: 'FTSE 100', ticker: 'UKX', change: '+0.3%', horizon: '1D / 1H', note: 'steady large-cap index with defensive tilt' },
    ],
  },
  {
    id: 'crypto',
    label: 'Crypto',
    summary: 'high beta and weekend noise',
    graphs: [
      { id: 'btc', categoryId: 'crypto', category: 'Crypto', label: 'Bitcoin', ticker: 'BTC/USD', change: '+2.1%', horizon: '1D / 30M', note: 'primary crypto risk gauge' },
      { id: 'eth', categoryId: 'crypto', category: 'Crypto', label: 'Ethereum', ticker: 'ETH/USD', change: '+1.6%', horizon: '1D / 30M', note: 'smart contract network and beta proxy' },
      { id: 'sol', categoryId: 'crypto', category: 'Crypto', label: 'Solana', ticker: 'SOL/USD', change: '+3.4%', horizon: '1D / 15M', note: 'fast moving altcoin trend tracker' },
    ],
  },
  {
    id: 'fx',
    label: 'FX',
    summary: 'currency crosses and macro drift',
    graphs: [
      { id: 'eurusd', categoryId: 'fx', category: 'FX', label: 'Euro / Dollar', ticker: 'EUR/USD', change: '-0.2%', horizon: '1D / 1H', note: 'core reserve currency cross' },
      { id: 'gbpusd', categoryId: 'fx', category: 'FX', label: 'Pound / Dollar', ticker: 'GBP/USD', change: '+0.1%', horizon: '1D / 1H', note: 'UK rate sensitivity and risk tone' },
      { id: 'usdjpy', categoryId: 'fx', category: 'FX', label: 'Dollar / Yen', ticker: 'USD/JPY', change: '+0.6%', horizon: '1D / 1H', note: 'carry, intervention risk, and funding stress' },
    ],
  },
  {
    id: 'commodities',
    label: 'Commodities',
    summary: 'energy, metals, and inflation pressure',
    graphs: [
      { id: 'gold', categoryId: 'commodities', category: 'Commodities', label: 'Gold', ticker: 'XAU/USD', change: '+0.4%', horizon: '1D / 4H', note: 'safe haven and real-rate mirror' },
      { id: 'brent', categoryId: 'commodities', category: 'Commodities', label: 'Brent crude', ticker: 'BRENT', change: '-0.7%', horizon: '1D / 1H', note: 'energy pulse and inflation input' },
      { id: 'silver', categoryId: 'commodities', category: 'Commodities', label: 'Silver', ticker: 'XAG/USD', change: '+0.9%', horizon: '1D / 4H', note: 'industrial demand and precious metal mix' },
    ],
  },
];

const marketGraphIndex = new Map(marketCategories.flatMap((category) => category.graphs.map((graph) => [graph.id, graph] as const)));
export const marketGraphs = marketCategories.flatMap((category) => category.graphs);
export const defaultMarketGraph = marketCategories[0]?.graphs[0] ?? {
  id: 'spx',
  categoryId: 'equities',
  category: 'Equities',
  label: 'S&P 500',
  ticker: 'SPX',
  change: '+0.8%',
  horizon: '1D / 4H',
  note: 'broad market benchmark and risk appetite',
};

export function getMarketGraph(graphId: string) {
  return marketGraphIndex.get(graphId) ?? defaultMarketGraph;
}
