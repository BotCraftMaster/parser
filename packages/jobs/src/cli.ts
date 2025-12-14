#!/usr/bin/env bun
import { MarketplaceParser } from "./parsers/marketplace-parser";
import { loadConfig } from "./utils/config-loader";
import { logger } from "./utils/logger";

async function main() {
  const args = process.argv.slice(2);
  const configPath = args[0] || "config.json";

  try {
    logger.info(`Loading config from ${configPath}`);
    const config = await loadConfig(configPath);

    logger.info("Starting marketplace parser...");
    const parser = new MarketplaceParser(config);

    const ads = await parser.parse();

    logger.info(`Parsing completed. Found ${ads.length} new ads`);

    if (config.saveXlsx) {
      const outputPath = "results.json";
      await Bun.write(outputPath, JSON.stringify(ads, null, 2));
      logger.info(`Results saved to ${outputPath}`);
    }

    parser.close();

    if (config.oneTimeStart) {
      logger.info("One-time start enabled. Exiting...");
      process.exit(0);
    }

    logger.info(`Waiting ${config.pauseGeneral} seconds before next run...`);
    await new Promise((resolve) =>
      setTimeout(resolve, config.pauseGeneral * 1000)
    );

    await main();
  } catch (error) {
    logger.error(`Error: ${error}`);
    process.exit(1);
  }
}

main();
