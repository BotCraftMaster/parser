import { eq } from "drizzle-orm";
import { z } from "zod/v4";
import { monitor } from "@acme/db/schema";
import {
  createMonitorSchema,
  deleteMonitorSchema,
  getMonitorSchema,
  updateMonitorSchema,
} from "@acme/validators";
import { createTRPCRouter, protectedProcedure } from "../trpc";

export const monitorRouter = createTRPCRouter({
  getAll: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select()
      .from(monitor)
      .where(eq(monitor.userId, ctx.session.user.id))
      .orderBy(monitor.createdAt);
  }),

  getById: protectedProcedure
    .input(getMonitorSchema)
    .query(async ({ ctx, input }) => {
      const result = await ctx.db
        .select()
        .from(monitor)
        .where(eq(monitor.id, input.id))
        .limit(1);

      if (!result[0] || result[0].userId !== ctx.session.user.id) {
        throw new Error("Монитор не найден");
      }

      return result[0];
    }),

  create: protectedProcedure
    .input(createMonitorSchema)
    .mutation(async ({ ctx, input }) => {
      const normalizedUsername = input.telegramUsername.startsWith("@")
        ? input.telegramUsername
        : `@${input.telegramUsername}`;

      const result = await ctx.db
        .insert(monitor)
        .values({
          userId: ctx.session.user.id,
          url: input.url,
          telegramUsername: normalizedUsername,
        })
        .returning();

      return result[0];
    }),

  update: protectedProcedure
    .input(updateMonitorSchema)
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db
        .select()
        .from(monitor)
        .where(eq(monitor.id, input.id))
        .limit(1);

      if (!existing[0] || existing[0].userId !== ctx.session.user.id) {
        throw new Error("Монитор не найден");
      }

      const updateData: any = {};
      if (input.url) updateData.url = input.url;
      if (input.telegramUsername) {
        updateData.telegramUsername = input.telegramUsername.startsWith("@")
          ? input.telegramUsername
          : `@${input.telegramUsername}`;
      }
      if (input.isActive !== undefined) updateData.isActive = input.isActive;

      const result = await ctx.db
        .update(monitor)
        .set(updateData)
        .where(eq(monitor.id, input.id))
        .returning();

      return result[0];
    }),

  delete: protectedProcedure
    .input(deleteMonitorSchema)
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db
        .select()
        .from(monitor)
        .where(eq(monitor.id, input.id))
        .limit(1);

      if (!existing[0] || existing[0].userId !== ctx.session.user.id) {
        throw new Error("Монитор не найден");
      }

      await ctx.db.delete(monitor).where(eq(monitor.id, input.id));

      return { success: true };
    }),

  toggleActive: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db
        .select()
        .from(monitor)
        .where(eq(monitor.id, input.id))
        .limit(1);

      if (!existing[0] || existing[0].userId !== ctx.session.user.id) {
        throw new Error("Монитор не найден");
      }

      const result = await ctx.db
        .update(monitor)
        .set({ isActive: !existing[0].isActive })
        .where(eq(monitor.id, input.id))
        .returning();

      return result[0];
    }),
});
