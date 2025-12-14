import { Suspense } from "react";
import { MonitorsList } from "./_components/monitors-list";
import { MonitorsListSkeleton } from "./_components/monitors-list-skeleton";

export const metadata = {
  title: "Мониторинг Avito",
};

export default function MonitorsPage() {
  return (
    <div className="container mx-auto py-6 px-4 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Мониторинг Avito</h1>
        <p className="text-muted-foreground mt-2">
          Добавьте ссылки на поиск Avito для отслеживания новых объявлений
        </p>
      </div>

      <Suspense fallback={<MonitorsListSkeleton />}>
        <MonitorsList />
      </Suspense>
    </div>
  );
}
