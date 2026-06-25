import axios from 'axios';

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

export interface LevelResponse {
  data: unknown
  children: { key: string; data: unknown }[]  // empty = leaf, no further jobs
}

// Level 1 — Search: query → symbols (children become Level 2 jobs)
async function fetchLevel1(query: string): Promise<LevelResponse> {
  const data = await fetchYF(
    'https://query1.finance.yahoo.com/v1/finance/search',
    { q: query, lang: 'en-US', region: 'US', quotesCount: '5', newsCount: '0' }
  );
  const quotes: { symbol: string }[] = data?.quotes ?? [];
  return {
    data,
    children: quotes.map((q) => ({ key: q.symbol, data: q })),
  };
}

// Level 2 — Chart: symbol → OHLCV data, leaf node (children: [] stops recursion)
async function fetchLevel2(symbol: string): Promise<LevelResponse> {
  const data = await fetchYF(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}`,
    { interval: '1d', range: '1mo', lang: 'en-US', region: 'US' }
  );
  return { data, children: [] };
}

// Dispatcher — called by the worker based on current depth
export async function fetchNextLevel(key: string, depth: number): Promise<LevelResponse> {
  if (depth === 1) return fetchLevel1(key);
  if (depth === 2) return fetchLevel2(key);
  return { data: null, children: [] };
}
