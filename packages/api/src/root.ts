import { userRouter } from "./routers/user";
import { monitorRouter } from "./routers/monitor";
import { createTRPCRouter } from "./trpc";

export const appRouter = createTRPCRouter({
  user: userRouter,
  monitor: monitorRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;
