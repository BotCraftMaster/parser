"use client";

import { useTRPC } from "~/trpc/react";
import { useQuery } from "@tanstack/react-query";
import { MonitorCard } from "./monitor-card";
import { AddMonitorDialog } from "./add-monitor-dialog";
import { Button } from "@acme/ui";
import { Plus } from "lucide-react";
import { useState } from "react";

export function MonitorsList() {
  const trpc = useTRPC();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);

  const monitorsQuery = trpc.monitor.getAll.queryOptions();
  const { data: monitors, isPending } = useQuery(monitorsQuery);

  if (isPending) {
    return <div>Загрузка…</div>;
  }

  const hasMonitors = monitors && monitors.length > 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {hasMonitors ? `Всего мониторов: ${monitors.length}` : ""}
        </div>
        <Button onClick={() => setIsAddDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" aria-hidden="true" />
          Добавить монитор
        </Button>
      </div>

      {!hasMonitors ? (
        <div className="flex flex-col items-center justify-center py-16 px-4 border-2 border-dashed rounded-lg">
          <div className="text-center space-y-4 max-w-md">
            <h3 className="text-lg font-semibold">Нет активных мониторов</h3>
            <p className="text-sm text-muted-foreground">
              Добавьте первый монитор, чтобы начать отслеживать новые объявления
              на Avito
            </p>
            <Button onClick={() => setIsAddDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" aria-hidden="true" />
              Добавить первый монитор
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {monitors.map((monitor: any) => (
            <MonitorCard key={monitor.id} monitor={monitor} />
          ))}
        </div>
      )}

      <AddMonitorDialog
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
      />
    </div>
  );
}
