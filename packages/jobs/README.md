# @acme/jobs

Parser package using Crawlee and Bun.js for web scraping tasks.

## Features

- Marketplace parser with Crawlee and Playwright
- Built-in filtering and deduplication
- SQLite database for tracking viewed ads
- TypeScript with Zod validation

## Usage

```typescript
import { MarketplaceParser } from "@acme/jobs";

const parser = new MarketplaceParser({
  urls: [process.env.MARKETPLACE_URL || "https://example.com/..."],
  count: 5,
  minPrice: 1000,
  maxPrice: 50000,
  keysWordWhiteList: ["keyword1", "keyword2"],
  pauseBetweenLinks: 3,
  dbPath: process.env.PARSER_DB_PATH,
});

const ads = await parser.parse();
console.log(`Found ${ads.length} ads`);
parser.close();
```

## Development

```bash
bun install
bun run dev
```
