import express, { Request, Response } from 'express';
import cors from 'cors';
import axios from 'axios';

const app = express();
const PORT = 5000;

app.use(cors({ origin: 'http://localhost:3000' }));
app.use(express.json());

const YF_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Referer': 'https://finance.yahoo.com',
  'Origin': 'https://finance.yahoo.com',
};

async function fetchYF(url: string, params: Record<string, string>) {
  const qs = new URLSearchParams(params).toString();
  const finalUrl = `${url}?${qs}`;
  const startTime = Date.now();
  const response = await axios.get(finalUrl, {
    headers: YF_HEADERS,
    validateStatus: () => true,
    timeout: 30000,
  });
  const time = Date.now() - startTime;
  return { status: response.status, statusText: response.statusText, data: response.data, url: finalUrl, time };
}


app.post('/api/chart', async (req: Request, res: Response) => {
  try {
    const {
      symbol = 'AAPL',
      interval = '1d',
      range = '1mo',
      includePrePost = 'false',
      events = 'div,splits,capitalGains',
      lang = 'en-US',
      region = 'US',
    } = req.body as Record<string, string>;

    const result = await fetchYF(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}`,
      { interval, range, lang, region, includePrePost: String(includePrePost), events }
    );
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.post('/api/search', async (req: Request, res: Response) => {
  try {
    const {
      q = '',
      quotesCount = '6',
      newsCount = '4',
      enableFuzzyQuery = 'false',
      region = 'US',
      lang = 'en-US',
    } = req.body as Record<string, string>;

    if (!q.trim()) { res.status(400).json({ error: 'Query (q) is required' }); return; }

    const result = await fetchYF(
      'https://query1.finance.yahoo.com/v1/finance/search',
      {
        q: q.trim(),
        lang,
        region,
        quotesCount: String(quotesCount),
        newsCount: String(newsCount),
        enableFuzzyQuery: String(enableFuzzyQuery),
        quotesQueryId: 'tss_match_phrase_query',
        multiQuoteQueryId: 'multi_quote_single_token_query',
        enableCb: 'true',
        enableNavLinks: 'true',
        enableEnhancedTrivialQuery: 'true',
      }
    );
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.post('/api/market-summary', async (req: Request, res: Response) => {
  try {
    const { region = 'US', lang = 'en-US' } = req.body as Record<string, string>;

    const result = await fetchYF(
      'https://query1.finance.yahoo.com/v6/finance/quote/marketSummary',
      { lang, region, corsDomain: 'finance.yahoo.com' }
    );
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.post('/api/trending', async (req: Request, res: Response) => {
  try {
    const { region = 'US', count = '10', lang = 'en-US' } = req.body as Record<string, string>;

    const result = await fetchYF(
      `https://query1.finance.yahoo.com/v1/finance/trending/${encodeURIComponent(region)}`,
      { lang, region, count: String(count), corsDomain: 'finance.yahoo.com' }
    );
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// parallel Execution
app.post('/api/dashboard', async (req: Request, res: Response) => {
  try {
    const { q = 'Apple', region = 'US' } = req.body;

    // Step 1: Search (required first)
    const searchResult = await fetchYF(
      'https://query1.finance.yahoo.com/v1/finance/search',
      {
        q,
        lang: 'en-US',
        region,
        quotesCount: '6',
        newsCount: '4'
      }
    );

    const symbol =
      searchResult.data?.quotes?.[0]?.symbol || 'AAPL';

    // Step 2: Parallel execution
    const [chart, marketSummary, trending] = await Promise.all([
      fetchYF(
        `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}`,
        {
          interval: '1d',
          range: '1mo',
          lang: 'en-US',
          region,
          includePrePost: 'false',
          events: 'div,splits,capitalGains'
        }
      ),

      fetchYF(
        'https://query1.finance.yahoo.com/v6/finance/quote/marketSummary',
        {
          lang: 'en-US',
          region,
          corsDomain: 'finance.yahoo.com'
        }
      ),

      fetchYF(
        `https://query1.finance.yahoo.com/v1/finance/trending/${encodeURIComponent(region)}`,
        {
          lang: 'en-US',
          region,
          count: '10',
          corsDomain: 'finance.yahoo.com'
        }
      )
    ]);

    res.json({
      search: searchResult,
      chart,
      marketSummary,
      trending
    });

  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

app.listen(PORT, () => console.log(`YF Explorer backend running on http://localhost:${PORT}`));
