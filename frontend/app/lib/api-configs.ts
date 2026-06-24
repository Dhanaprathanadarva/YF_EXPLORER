export type FieldType = 'text' | 'select' | 'number' | 'checkbox'

export interface SelectOption {
  value: string
  label: string
}

export interface FieldConfig {
  name: string
  label: string
  type: FieldType
  defaultValue: string | number | boolean
  options?: SelectOption[]
  description: string
  required?: boolean
  placeholder?: string
}

export interface ApiConfig {
  id: string
  name: string
  version: string
  endpoint: string
  backendPath: string
  shortDescription: string
  context: string
  accentColor: string   // hex color
  fields: FieldConfig[]
  isDashboard?: boolean
}

const REGIONS: SelectOption[] = [
  { value: 'US', label: 'United States' },
  { value: 'GB', label: 'United Kingdom' },
  { value: 'CA', label: 'Canada' },
  { value: 'AU', label: 'Australia' },
  { value: 'IN', label: 'India' },
  { value: 'DE', label: 'Germany' },
  { value: 'FR', label: 'France' },
  { value: 'JP', label: 'Japan' },
]

export const API_CONFIGS: ApiConfig[] = [
  {
    id: 'dashboard',
    name: 'Dashboard',
    version: 'multi',
    endpoint: '/api/dashboard',
    backendPath: '/api/dashboard',
    shortDescription: 'Search → Chart + Market Summary + Trending in one shot',
    context:
      'A single backend call that first resolves a company name or ticker to a symbol via the Search endpoint, then fans out in parallel to fetch: Chart (1-month daily OHLCV), Market Summary (major indices snapshot), and Trending Tickers (US top 10). Results for all four sub-requests are returned together, letting you explore multiple endpoints with one click.',
    accentColor: '#a855f7',
    isDashboard: true,
    fields: [
      {
        name: 'q',
        label: 'Query',
        type: 'text',
        defaultValue: 'Apple',
        description: 'Company name or ticker used to resolve the symbol before fetching chart data',
        required: true,
        placeholder: 'e.g. Apple, TSLA, Microsoft',
      },
      {
        name: 'region',
        label: 'Region',
        type: 'select',
        defaultValue: 'US',
        description: 'Market region — applied to search, chart, market summary, and trending calls',
        options: REGIONS,
      },
    ],
  },

  {
    id: 'chart',
    name: 'Chart (Historical)',
    version: 'v8',
    endpoint: '/v8/finance/chart/{symbol}',
    backendPath: '/api/chart',
    shortDescription: 'OHLCV time-series data with splits and dividends',
    context:
      'Returns Open, High, Low, Close, Volume data for any ticker. Supports 12 intervals from 1 minute to 3 months, and ranges from 1 day all the way back to IPO via max. The response contains parallel timestamp and price arrays plus adjusted close. Dividend and split events are overlaid when the events param includes them. Intraday intervals (1m–90m) are capped by Yahoo at 7–60 days depending on resolution.',
    accentColor: '#10b981',
    fields: [
      {
        name: 'symbol',
        label: 'Symbol',
        type: 'text',
        defaultValue: 'AAPL',
        description: 'Ticker symbol to fetch data for',
        required: true,
        placeholder: 'e.g. AAPL, TSLA, MSFT',
      },
      {
        name: 'interval',
        label: 'Interval',
        type: 'select',
        defaultValue: '1d',
        description: 'Bar size — intraday intervals are limited to recent data (7–60 days max)',
        options: [
          { value: '1m',  label: '1 minute'  },
          { value: '2m',  label: '2 minutes' },
          { value: '5m',  label: '5 minutes' },
          { value: '15m', label: '15 minutes' },
          { value: '30m', label: '30 minutes' },
          { value: '60m', label: '60 minutes' },
          { value: '90m', label: '90 minutes' },
          { value: '1d',  label: '1 day'   },
          { value: '5d',  label: '5 days'  },
          { value: '1wk', label: '1 week'  },
          { value: '1mo', label: '1 month' },
          { value: '3mo', label: '3 months' },
        ],
      },
      {
        name: 'range',
        label: 'Range',
        type: 'select',
        defaultValue: '1mo',
        description: 'Lookback window — max returns all data since IPO',
        options: [
          { value: '1d',  label: '1 day'      },
          { value: '5d',  label: '5 days'     },
          { value: '1mo', label: '1 month'    },
          { value: '3mo', label: '3 months'   },
          { value: '6mo', label: '6 months'   },
          { value: '1y',  label: '1 year'     },
          { value: '2y',  label: '2 years'    },
          { value: '5y',  label: '5 years'    },
          { value: '10y', label: '10 years'   },
          { value: 'ytd', label: 'Year to date' },
          { value: 'max', label: 'Max (since IPO)' },
        ],
      },
      {
        name: 'includePrePost',
        label: 'Include Pre/Post Market',
        type: 'checkbox',
        defaultValue: false,
        description: 'Add pre-market and after-hours bars for intraday intervals',
      },
      {
        name: 'events',
        label: 'Events',
        type: 'text',
        defaultValue: 'div,splits,capitalGains',
        description: 'Corporate action events to overlay on the price series',
        placeholder: 'div,splits,capitalGains',
      },
    ],
  },
  {
    id: 'search',
    name: 'Search',
    version: 'v1',
    endpoint: '/v1/finance/search',
    backendPath: '/api/search',
    shortDescription: 'Autocomplete across tickers, funds, and news articles',
    context:
      'Resolves a company name, partial ticker, or keyword into two result lists: quotes (matching instruments with their exchange, asset type, and short name) and news (recent articles mentioning the query). Useful for building a search box or finding a ticker from a company name. Fuzzy matching allows approximate queries to succeed when the exact ticker is unknown.',
    accentColor: '#3b82f6',
    fields: [
      {
        name: 'q',
        label: 'Query',
        type: 'text',
        defaultValue: '',
        description: 'Company name, ticker symbol, or keyword to search for',
        required: true,
        placeholder: 'e.g. Apple, TSLA, semiconductors',
      },
      {
        name: 'quotesCount',
        label: 'Quotes Count',
        type: 'number',
        defaultValue: 6,
        description: 'Maximum number of ticker / instrument results to return',
      },
      {
        name: 'newsCount',
        label: 'News Count',
        type: 'number',
        defaultValue: 4,
        description: 'Maximum number of news articles to return',
      },
      {
        name: 'enableFuzzyQuery',
        label: 'Enable Fuzzy Matching',
        type: 'checkbox',
        defaultValue: false,
        description: 'Allow approximate matches — e.g. "Aple" still resolves to AAPL',
      },
      {
        name: 'region',
        label: 'Region',
        type: 'select',
        defaultValue: 'US',
        description: 'Market region to prioritize results from',
        options: REGIONS,
      },
    ],
  },
  {
    id: 'market-summary',
    name: 'Market Summary',
    version: 'v6',
    endpoint: '/v6/finance/quote/marketSummary',
    backendPath: '/api/market-summary',
    shortDescription: 'Major indices, commodities, and currencies snapshot',
    context:
      'Returns a pre-defined set of benchmark instruments for the selected region — the same data shown on Yahoo Finance\'s homepage. For the US region this includes S&P 500, Dow Jones, Nasdaq, Russell 2000, crude oil, gold, EUR/USD, GBP/USD, and Bitcoin. The instrument set is curated by Yahoo per region; no symbols parameter is needed. Each item includes current price, change, and percentage change.',
    accentColor: '#f59e0b',
    fields: [
      {
        name: 'region',
        label: 'Region',
        type: 'select',
        defaultValue: 'US',
        description: 'Determines which benchmark instruments Yahoo returns — each region has its own curated set',
        options: REGIONS,
      },
    ],
  },
  {
    id: 'trending',
    name: 'Trending Tickers',
    version: 'v1',
    endpoint: '/v1/finance/trending/{region}',
    backendPath: '/api/trending',
    shortDescription: 'Most-viewed tickers on Yahoo Finance right now',
    context:
      'Ranked list of symbols currently receiving the most page views on Yahoo Finance for a given region. Updates frequently during market hours, typically driven by news events, earnings releases, or unusual volume. The response returns symbols only with no price data — pair the results with the Quote endpoint to get current prices. The count parameter caps how many tickers are returned.',
    accentColor: '#f43f5e',
    fields: [
      {
        name: 'region',
        label: 'Region',
        type: 'select',
        defaultValue: 'US',
        description: 'Region code — used in both the URL path and query param',
        options: REGIONS,
      },
      {
        name: 'count',
        label: 'Count',
        type: 'number',
        defaultValue: 10,
        description: 'Number of trending tickers to return',
      },
    ],
  },
]
