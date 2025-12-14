"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod/v4";
import { updateMonitorSchema } from "@acme/validators";
import { useTRPC } from "~/trpc/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  toast,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  Button,
  Input,
  Label,
} from "@acme/ui";
import { Loader2 } from "lucide-react";

type FormData = {
  url: string;
  telegramUsername: string;
};

interface EditMonitorDialogProps {
  monitor: {
    id: string;
    url: string;
    telegramUsername: string;
  };
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditMonitorDialog({
  monitor,
  open,
  onOpenChange,
}: EditMonitorDialogProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [errors, setErrors] = useState<Record<string, string>>({});

  const {
    register,
    handleSubmit,
    reset,
    formState: { isDirty },
  } = useForm<FormData>({
    defaultValues: {
      url: monitor.url,
      telegramUsername: monitor.telegramUsername,
    },
  });

  useEffect(() => {
    if (open) {
      reset({
        url: monitor.url,
        telegramUsername: monitor.telegramUsername,
      });
      setErrors({});
    }
  }, [open, monitor, reset]);

  const updateMutation = trpc.monitor.update.mutationOptions({
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: trpc.monitor.getAll.queryKey(),
      });
      toast.success("Монитор обновлен");
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error(error.message || "Не удалось обновить монитор");
    },
  });

  const { mutate: updateMonitor, isPending } = useMutation(updateMutation);

  const onSubmit = (data: FormData) => {
    setErrors({});

    const result = updateMonitorSchema.safeParse({
      id: monitor.id,
      ...data,
    });

    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      const issues = result.error.issues || [];
      issues.forEach((err: any) => {
        if (err.path[0]) {
          fieldErrors[err.path[0].toString()] = err.message;
        }
      });
      setErrors(fieldErrors);
      return;
    }

    updateMonitor(result.data);
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen && isDirty) {
      if (confirm("У вас есть несохраненные изменения. Закрыть форму?")) {
        onOpenChange(false);
      }
    } else {
      onOpenChange(newOpen);
    }
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent className="sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Редактировать монитор</SheetTitle>
          <SheetDescription>
            Измените параметры мониторинга объявлений
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 mt-6">
          <div className="space-y-2">
            <Label htmlFor="edit-url">
              Ссылка на поиск Avito{" "}
              <span aria-label="обязательное поле">*</span>
            </Label>
            <Input
              id="edit-url"
              type="url"
              placeholder="https://www.avito.ru/rossiya?q=…"
              autoComplete="url"
              spellCheck={false}
              {...register("url")}
              aria-invalid={!!errors.url}
              aria-describedby={errors.url ? "edit-url-error" : undefined}
              style={{ fontSize: "16px" }}
            />
            {errors.url && (
              <p
                id="edit-url-error"
                className="text-sm text-destructive"
                role="alert"
              >
                {errors.url}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-telegramUsername">
              Telegram username <span aria-label="обязательное поле">*</span>
            </Label>
            <Input
              id="edit-telegramUsername"
              type="text"
              placeholder="@username или username"
              autoComplete="username"
              spellCheck={false}
              {...register("telegramUsername")}
              aria-invalid={!!errors.telegramUsername}
              aria-describedby={
                errors.telegramUsername ? "edit-telegram-error" : undefined
              }
              style={{ fontSize: "16px" }}
            />
            {errors.telegramUsername && (
              <p
                id="edit-telegram-error"
                className="text-sm text-destructive"
                role="alert"
              >
                {errors.telegramUsername}
              </p>
            )}
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isPending}
              className="flex-1"
            >
              Отмена
            </Button>
            <Button type="submit" disabled={isPending} className="flex-1">
              {isPending && (
                <Loader2
                  className="h-4 w-4 mr-2 animate-spin"
                  aria-hidden="true"
                />
              )}
              {isPending ? "Сохранение…" : "Сохранить"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
