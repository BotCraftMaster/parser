"use client";

import {
  Card,
  Button,
  Badge,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  toast,
} from "@acme/ui";
import {
  MoreVertical,
  ExternalLink,
  Pencil,
  Trash2,
  Power,
} from "lucide-react";
import { useTRPC } from "~/trpc/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { EditMonitorDialog } from "./edit-monitor-dialog";
import { format } from "date-fns";
import { ru } from "date-fns/locale";

interface MonitorCardProps {
  monitor: {
    id: string;
    url: string;
    telegramUsername: string;
    isActive: boolean;
    lastCheckedAt: Date | null;
    createdAt: Date;
  };
}

export function MonitorCard({ monitor }: MonitorCardProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  const toggleActiveMutation = trpc.monitor.toggleActive.mutationOptions({
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: trpc.monitor.getAll.queryKey(),
      });
      toast.success(
        monitor.isActive ? "Монитор приостановлен" : "Монитор активирован"
      );
    },
    onError: (error) => {
      toast.error(error.message || "Не удалось изменить статус");
    },
  });

  const deleteMutation = trpc.monitor.delete.mutationOptions({
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: trpc.monitor.getAll.queryKey(),
      });
      toast.success("Монитор удален");
    },
    onError: (error) => {
      toast.error(error.message || "Не удалось удалить монитор");
    },
  });

  const { mutate: toggleActive, isPending: isToggling } =
    useMutation(toggleActiveMutation);
  const { mutate: deleteMonitor, isPending: isDeleting } =
    useMutation(deleteMutation);

  const handleToggleActive = () => {
    toggleActive({ id: monitor.id });
  };

  const handleDelete = () => {
    if (confirm("Вы уверены, что хотите удалить этот монитор?")) {
      deleteMonitor({ id: monitor.id });
    }
  };

  const displayUrl =
    monitor.url.length > 60 ? `${monitor.url.substring(0, 60)}…` : monitor.url;

  return (
    <>
      <Card className="p-6 hover:shadow-md transition-shadow">
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-2">
            <Badge variant={monitor.isActive ? "default" : "secondary"}>
              {monitor.isActive ? "Активен" : "Приостановлен"}
            </Badge>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  aria-label="Действия с монитором"
                >
                  <MoreVertical className="h-4 w-4" aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={handleToggleActive}
                  disabled={isToggling}
                >
                  <Power className="h-4 w-4 mr-2" aria-hidden="true" />
                  {monitor.isActive ? "Приостановить" : "Активировать"}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setIsEditDialogOpen(true)}>
                  <Pencil className="h-4 w-4 mr-2" aria-hidden="true" />
                  Редактировать…
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <a
                    href={monitor.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="h-4 w-4 mr-2" aria-hidden="true" />
                    Открыть ссылку
                  </a>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-2" aria-hidden="true" />
                  Удалить…
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="space-y-2">
            <a
              href={monitor.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-primary hover:underline break-all line-clamp-2"
            >
              {displayUrl}
            </a>
          </div>

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Telegram:</span>
            <span className="font-mono">{monitor.telegramUsername}</span>
          </div>

          {monitor.lastCheckedAt && (
            <div className="text-xs text-muted-foreground">
              Последняя проверка:{" "}
              {format(new Date(monitor.lastCheckedAt), "d MMM, HH:mm", {
                locale: ru,
              })}
            </div>
          )}
        </div>
      </Card>

      <EditMonitorDialog
        monitor={monitor}
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
      />
    </>
  );
}
