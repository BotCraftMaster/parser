import { z } from "zod";

export const ParserConfigSchema = z.object({
  urls: z.array(z.string()),
  count: z.number().default(1),
  minPrice: z.number().default(0),
  maxPrice: z.number().default(99999999),
  keysWordWhiteList: z.array(z.string()).default([]),
  keysWordBlackList: z.array(z.string()).default([]),
  sellerBlackList: z.array(z.string()).default([]),
  geo: z.string().optional(),
  proxyString: z.string().optional(),
  proxyChangeUrl: z.string().optional(),
  pauseGeneral: z.number().default(60),
  pauseBetweenLinks: z.number().default(5),
  maxAge: z.number().default(0),
  maxCountOfRetry: z.number().default(5),
  ignoreReserv: z.boolean().default(true),
  ignorePromotion: z.boolean().default(false),
  oneTimeStart: z.boolean().default(false),
  oneFileForLink: z.boolean().default(false),
  parseViews: z.boolean().default(false),
  saveXlsx: z.boolean().default(true),
  useWebdriver: z.boolean().default(true),
  tgToken: z.string().optional(),
  tgChatId: z.array(z.string()).default([]),
  dbPath: z.string().optional(),
});

export type ParserConfig = z.infer<typeof ParserConfigSchema>;

export const AdSchema = z.object({
  id: z.number(),
  title: z.string(),
  description: z.string(),
  price: z.number(),
  urlPath: z.string(),
  sellerId: z.string().optional(),
  geo: z.string().optional(),
  sortTimeStamp: z.number(),
  isReserved: z.boolean().default(false),
  isPromotion: z.boolean().default(false),
  totalViews: z.number().optional(),
  todayViews: z.number().optional(),
});

export type Ad = z.infer<typeof AdSchema>;
