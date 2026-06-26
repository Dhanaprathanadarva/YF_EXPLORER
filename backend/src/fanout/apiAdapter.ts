import axios from 'axios';
import { JobType } from './types';

const YF_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Referer': 'https://finance.yahoo.com',
  'Origin': 'https://finance.yahoo.com',
};

async function fetchYF(url: string, params: Record<string, string>) {
  const qs = new URLSearchParams(params).toString();
  const response = await axios.get(`${url}?${qs}`, {
    headers: YF_HEADERS,
    validateStatus: () => true,
    timeout: 30000,
  });
  return response.data;
}

export interface ChildJob {
  key: string;
  jobType: JobType;
  data?: unknown;
}

export interface LevelResponse {
  data: unknown
  children: ChildJob[]  // empty = leaf, no further jobs
}

// Level 1 — Trending: region → trending symbols (Level 2 Chart jobs) + MarketSummary branch
async function fetchTrending(region: string): Promise<LevelResponse> {
  const data = await fetchYF(
    `https://query1.finance.yahoo.com/v1/finance/trending/${encodeURIComponent(region)}`,
    { lang: 'en-US', region }
  );
  const quotes: { symbol: string }[] = data?.finance?.result?.[0]?.quotes ?? [];
  return {
    data,
    children: quotes.map((q) => ({ key: q.symbol, jobType: 'chart' as JobType })),
  };
}

// Level 2 — Chart: symbol → OHLCV data, leaf node
async function fetchChart(symbol: string): Promise<LevelResponse> {
  const data = await fetchYF(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}`,
    { interval: '1d', range: '1mo', lang: 'en-US', region: 'US' }
  );
  return { data, children: [] };
}

// Level 2 — Market Summary: region → market snapshot, leaf node
async function fetchMarketSummary(region: string): Promise<LevelResponse> {
  const data = await fetchYF(
    'https://query1.finance.yahoo.com/v6/finance/quote/marketSummary',
    { lang: 'en-US', region }
  );
  return { data, children: [] };
}

// Dispatcher — called by the worker based on jobType
export async function fetchNextLevel(key: string, jobType: JobType, region: string): Promise<LevelResponse> {
  if (jobType === 'trending')      return fetchTrending(key);
  if (jobType === 'chart')         return fetchChart(key);
  if (jobType === 'marketSummary') return fetchMarketSummary(key);
  return { data: null, children: [] };
}
