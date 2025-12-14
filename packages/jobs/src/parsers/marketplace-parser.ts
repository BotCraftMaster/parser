import { PlaywrightCrawler, log } from "crawlee";
import type { ParserConfig, Ad } from "../types";
import { AdSchema } from "../types";
import { Database } from "bun:sqlite";

export class MarketplaceParser {
  private config: ParserConfig;
  private db: Database;
  private viewedAds: Set<string>;
  private results: Ad[] = [];

  constructor(config: ParserConfig) {
    this.config = config;
    const dbPath =
      config.dbPath || process.env.PARSER_DB_PATH || "marketplace.db";
    this.db = new Database(dbPath);
    this.viewedAds = new Set();
    this.initDatabase();
  }

  private initDatabase() {
    this.db.run(`
      CREATE TABLE IF NOT EXISTS viewed_ads (
        id INTEGER PRIMARY KEY,
        price INTEGER,
        viewed_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }

  private isViewed(id: number, price: number): boolean {
    const key = `${id}-${price}`;
    if (this.viewedAds.has(key)) return true;

    const result = this.db
      .query("SELECT 1 FROM viewed_ads WHERE id = ? AND price = ?")
      .get(id, price);

    if (result) {
      this.viewedAds.add(key);
      return true;
    }
    return false;
  }

  private markAsViewed(ads: Ad[]) {
    const stmt = this.db.prepare(
      "INSERT OR IGNORE INTO viewed_ads (id, price) VALUES (?, ?)"
    );

    for (const ad of ads) {
      stmt.run(ad.id, ad.price);
      this.viewedAds.add(`${ad.id}-${ad.price}`);
    }
  }

  private filterAds(ads: Ad[]): Ad[] {
    return ads.filter((ad) => {
      if (this.isViewed(ad.id, ad.price)) return false;
      if (ad.price < this.config.minPrice || ad.price > this.config.maxPrice)
        return false;

      const fullText = `${ad.title} ${ad.description}`.toLowerCase();

      if (this.config.keysWordBlackList.length > 0) {
        if (
          this.config.keysWordBlackList.some((word) =>
            fullText.includes(word.toLowerCase())
          )
        ) {
          return false;
        }
      }

      if (this.config.keysWordWhiteList.length > 0) {
        if (
          !this.config.keysWordWhiteList.some((word) =>
            fullText.includes(word.toLowerCase())
          )
        ) {
          return false;
        }
      }

      if (this.config.geo && ad.geo && !ad.geo.includes(this.config.geo)) {
        return false;
      }

      if (this.config.sellerBlackList.length > 0 && ad.sellerId) {
        if (this.config.sellerBlackList.includes(ad.sellerId)) {
          return false;
        }
      }

      if (this.config.maxAge > 0) {
        const now = Date.now();
        const adAge = (now - ad.sortTimeStamp) / 1000;
        if (adAge > this.config.maxAge) return false;
      }

      if (this.config.ignoreReserv && ad.isReserved) return false;
      if (this.config.ignorePromotion && ad.isPromotion) return false;

      return true;
    });
  }

  private extractAdsFromPage(html: string): Ad[] {
    try {
      const scriptMatch = html.match(
        /<script type="mime\/invalid"[^>]*>(.*?)<\/script>/s
      );
      if (!scriptMatch?.[1]) return [];

      const jsonData = JSON.parse(scriptMatch[1]);
      const catalog =
        jsonData?.state?.data?.catalog || jsonData?.data?.catalog || {};
      const items = catalog.items || [];

      return items
        .filter((item: any) => item.id)
        .map((item: any) => {
          try {
            return AdSchema.parse({
              id: item.id,
              title: item.title || "",
              description: item.description || "",
              price: item.priceDetailed?.value || 0,
              urlPath: item.urlPath || "",
              sellerId: this.extractSellerId(item),
              geo: item.geo?.formattedAddress || "",
              sortTimeStamp: item.sortTimeStamp || Date.now(),
              isReserved: item.isReserved || false,
              isPromotion: this.checkPromotion(item),
            });
          } catch (e) {
            log.warning(`Failed to parse ad: ${e}`);
            return null;
          }
        })
        .filter((ad: Ad | null): ad is Ad => ad !== null);
    } catch (e) {
      log.error(`Failed to extract ads: ${e}`);
      return [];
    }
  }

  private extractSellerId(item: any): string | undefined {
    const match = JSON.stringify(item).match(/\/brands\/([^/?#]+)/);
    return match ? match[1] : undefined;
  }

  private checkPromotion(item: any): boolean {
    const dateInfoSteps = item.iva?.DateInfoStep || [];
    return dateInfoSteps.some((step: any) =>
      step.payload?.vas?.some((v: any) => v.title === "Продвинуто")
    );
  }

  private getNextPageUrl(url: string, page: number): string {
    const urlObj = new URL(url);
    urlObj.searchParams.set("p", String(page));
    return urlObj.toString();
  }

  async parse(): Promise<Ad[]> {
    this.results = [];
    const self = this;

    const crawler = new PlaywrightCrawler({
      launchContext: {
        launchOptions: {
          headless: this.config.useWebdriver,
          proxy: this.config.proxyString
            ? {
                server: `http://${this.config.proxyString}`,
              }
            : undefined,
        },
      },
      maxRequestsPerCrawl: this.config.urls.length * this.config.count,
      requestHandlerTimeoutSecs: 60,

      async requestHandler({ page, request, log }) {
        log.info(`Processing ${request.url}`);

        await page.waitForLoadState("networkidle");
        const html = await page.content();

        const ads = self.extractAdsFromPage(html);
        log.info(`Found ${ads.length} ads on page`);

        const filtered = self.filterAds(ads);
        log.info(`${filtered.length} ads passed filters`);

        if (filtered.length > 0) {
          self.markAsViewed(filtered);
          self.results.push(...filtered);
        }

        await new Promise((resolve) =>
          setTimeout(resolve, self.config.pauseBetweenLinks * 1000)
        );
      },
    });

    const requests = [];
    for (const url of this.config.urls) {
      for (let page = 1; page <= this.config.count; page++) {
        requests.push({ url: this.getNextPageUrl(url, page) });
      }
    }

    await crawler.run(requests);

    log.info(`Total ads collected: ${this.results.length}`);
    return this.results;
  }

  close() {
    this.db.close();
  }
}
