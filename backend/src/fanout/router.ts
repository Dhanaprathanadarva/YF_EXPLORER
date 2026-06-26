import { Router, Request, Response } from 'express';
import axios from 'axios';
import { startFanout } from './producer';
import { getStatus, getAllResults, cleanup, getTiming } from './aggregator';
import { fanoutQueue } from './queue';
import { FanoutRecord } from './db';

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

// POST /api/fanout/start  { query: "Apple", region: "US" }
router.post('/start', async (req: Request, res: Response) => {
  try {
    const { region = 'US' } = req.body;
    if (!String(region).trim()) {
      res.status(400).json({ error: 'region is required' });
      return;
    }
    const rootJobId = await startFanout(String(region).trim());
    res.json({ rootJobId, message: 'Fan-out started. Poll /status/:rootJobId for progress.' });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// GET /api/fanout/status/:rootJobId
router.get('/status/:rootJobId', async (req: Request, res: Response) => {
  try {
    const status = await getStatus(req.params.rootJobId);
    res.json(status);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// GET /api/fanout/results/:rootJobId
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
router.delete('/cleanup/:rootJobId', async (req: Request, res: Response) => {
  try {
    await cleanup(req.params.rootJobId);
    await (fanoutQueue as any).obliterate({ force: true });
    res.json({ message: 'Cleaned up', rootJobId: req.params.rootJobId });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// DELETE /api/fanout/records
// → deletes all MongoDB fanout records
router.delete('/records', async (_req: Request, res: Response) => {
  try {
    const result = await FanoutRecord.deleteMany({});
    res.json({ message: 'All MongoDB records deleted', deletedCount: result.deletedCount });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// POST /api/fanout/sequential { query, region }
// Runs all calls one by one — same work as the parallel fan-out but with no concurrency
router.post('/sequential', async (req: Request, res: Response) => {
  try {
    const { region = 'US' } = req.body;

    // Level 1a — Trending
    const { data: trendingData, timeMs: trendingTimeMs } = await fetchYF(
      `https://query1.finance.yahoo.com/v1/finance/trending/${encodeURIComponent(region)}`,
      { lang: 'en-US', region }
    );
    const trendingSymbols: string[] = (trendingData?.finance?.result?.[0]?.quotes ?? [])
      .map((q: { symbol: string }) => q.symbol);

    // Level 1b — Market Summary (sequential — runs after Trending)
    const { timeMs: mktTimeMs } = await fetchYF(
      'https://query1.finance.yahoo.com/v6/finance/quote/marketSummary',
      { lang: 'en-US', region }
    );

    // Level 2 — Chart for each trending symbol one by one
    const chartJobs: { key: string; timeMs: number }[] = [];
    for (const symbol of trendingSymbols) {
      const { timeMs } = await fetchYF(
        `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}`,
        { interval: '1d', range: '1mo', lang: 'en-US', region: 'US' }
      );
      chartJobs.push({ key: symbol, timeMs });
    }

    const level1Jobs = [
      { key: `trending:${region}`,      timeMs: trendingTimeMs },
      { key: `marketSummary:${region}`, timeMs: mktTimeMs },
    ];
    const level1WallClock = level1Jobs.reduce((sum, j) => sum + j.timeMs, 0);
    const level2WallClock = chartJobs.reduce((sum, j) => sum + j.timeMs, 0);

    res.json({
      totalTimeMs: level1WallClock + level2WallClock,
      levelTimings: [
        { depth: 1, wallClockMs: level1WallClock, jobCount: level1Jobs.length, jobs: level1Jobs },
        { depth: 2, wallClockMs: level2WallClock, jobCount: chartJobs.length,  jobs: chartJobs },
      ],
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export default router;
