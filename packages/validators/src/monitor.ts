import { z } from "zod/v4";

export const createMonitorSchema = z.object({
  url: z
    .string()
    .url("Введите корректный URL")
    .refine((url) => url.includes("avito.ru"), "URL должен быть с сайта Avito"),
  telegramUsername: z
    .string()
    .min(1, "Укажите Telegram username")
    .regex(/^@?[a-zA-Z0-9_]{5,32}$/, "Некорректный формат username"),
});

export const updateMonitorSchema = z.object({
  id: z.string().uuid(),
  url: z
    .string()
    .url("Введите корректный URL")
    .refine((url) => url.includes("avito.ru"), "URL должен быть с сайта Avito")
    .optional(),
  telegramUsername: z
    .string()
    .min(1, "Укажите Telegram username")
    .regex(/^@?[a-zA-Z0-9_]{5,32}$/, "Некорректный формат username")
    .optional(),
  isActive: z.boolean().optional(),
});

export const deleteMonitorSchema = z.object({
  id: z.string().uuid(),
});

export const getMonitorSchema = z.object({
  id: z.string().uuid(),
});

export type CreateMonitorInput = z.infer<typeof createMonitorSchema>;
export type UpdateMonitorInput = z.infer<typeof updateMonitorSchema>;
export type DeleteMonitorInput = z.infer<typeof deleteMonitorSchema>;
export type GetMonitorInput = z.infer<typeof getMonitorSchema>;
