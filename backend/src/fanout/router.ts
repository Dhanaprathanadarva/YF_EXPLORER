import { Router, Request, Response } from 'express';
import axios from 'axios';
import { startFanout } from './producer';
import { getStatus, getAllResults, cleanup, getTiming } from './aggregator';

const YF_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Referer': 'https://finance.yahoo.com',
  'Origin': 'https://finance.yahoo.com',
};

async function fetchYF(url: string, params: Record<string, string>) {
  const qs = new URLSearchParams(params).toString();
  const start = Date.now();
  const response = await axios.get(`${url}?${qs}`, {
    headers: YF_HEADERS,
    validateStatus: () => true,
    timeout: 30000,
  });
  return { data: response.data, timeMs: Date.now() - start };
}

const router = Router();

// POST /api/fanout/start  { query: "Apple" }
// → starts the fan-out tree, returns rootJobId immediately
router.post('/start', async (req: Request, res: Response) => {
  try {
    const { query = 'Apple' } = req.body;
    if (!String(query).trim()) {
      res.status(400).json({ error: 'query is required' });
      return;
    }
    const rootJobId = await startFanout(String(query).trim());
    res.json({ rootJobId, message: 'Fan-out started. Poll /status/:rootJobId for progress.' });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// GET /api/fanout/status/:rootJobId
// → returns { total, completed, done }
router.get('/status/:rootJobId', async (req: Request, res: Response) => {
  try {
    const status = await getStatus(req.params.rootJobId);
    res.json(status);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// GET /api/fanout/results/:rootJobId
// → returns all aggregated results once done
router.get('/results/:rootJobId', async (req: Request, res: Response) => {
  try {
    const status = await getStatus(req.params.rootJobId);
    if (!status.done) {
      res.status(202).json({ message: 'Still processing', ...status });
      return;
    }
    const [results, timing] = await Promise.all([
      getAllResults(req.params.rootJobId),
      getTiming(req.params.rootJobId),
    ]);
    res.json({ rootJobId: req.params.rootJobId, totalJobs: status.total, timing, results });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// DELETE /api/fanout/cleanup/:rootJobId
// → removes Redis keys for a completed job
router.delete('/cleanup/:rootJobId', async (req: Request, res: Response) => {
  try {
    await cleanup(req.params.rootJobId);
    res.json({ message: 'Cleaned up', rootJobId: req.params.rootJobId });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// POST /api/fanout/sequential { query }
// → runs Search then Chart for each symbol one by one (no parallelism), returns timing
router.post('/sequential', async (req: Request, res: Response) => {
  try {
    const { query = 'Apple' } = req.body;

    // Level 1 — Search (sequential start)
    const { data: searchData, timeMs: searchTimeMs } = await fetchYF(
      'https://query1.finance.yahoo.com/v1/finance/search',
      { q: query, lang: 'en-US', region: 'US', quotesCount: '5', newsCount: '0' }
    );

    const symbols: string[] = (searchData?.quotes ?? []).map((q: { symbol: string }) => q.symbol);

    // Level 2 — Chart for each symbol one by one
    const chartJobs: { key: string; timeMs: number }[] = [];
    for (const symbol of symbols) {
      const { timeMs } = await fetchYF(
        `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}`,
        { interval: '1d', range: '1mo', lang: 'en-US', region: 'US' }
      );
      chartJobs.push({ key: symbol, timeMs });
    }

    const level1WallClock = searchTimeMs;
    const level2WallClock = chartJobs.reduce((sum, j) => sum + j.timeMs, 0);

    res.json({
      totalTimeMs: level1WallClock + level2WallClock,
      levelTimings: [
        { depth: 1, wallClockMs: level1WallClock, jobCount: 1,             jobs: [{ key: query,  timeMs: searchTimeMs }] },
        { depth: 2, wallClockMs: level2WallClock, jobCount: chartJobs.length, jobs: chartJobs },
      ],
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export default router;
