"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod/v4";
import { createMonitorSchema } from "@acme/validators";
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

type FormData = z.infer<typeof createMonitorSchema>;

interface AddMonitorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddMonitorDialog({
  open,
  onOpenChange,
}: AddMonitorDialogProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [errors, setErrors] = useState<Record<string, string>>({});

  const {
    register,
    handleSubmit,
    reset,
    formState: { isDirty },
  } = useForm<FormData>();

  const createMutation = trpc.monitor.create.mutationOptions({
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: trpc.monitor.getAll.queryKey(),
      });
      toast.success("Монитор успешно добавлен");
      reset();
      setErrors({});
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error(error.message || "Не удалось создать монитор");
    },
  });

  const { mutate: createMonitor, isPending } = useMutation(createMutation);

  const onSubmit = (data: FormData) => {
    setErrors({});

    const result = createMonitorSchema.safeParse(data);

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

    createMonitor(result.data);
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen && isDirty) {
      if (confirm("У вас есть несохраненные изменения. Закрыть форму?")) {
        reset();
        setErrors({});
        onOpenChange(false);
      }
    } else {
      reset();
      setErrors({});
      onOpenChange(newOpen);
    }
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent className="sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Добавить монитор</SheetTitle>
          <SheetDescription>
            Укажите ссылку на поиск Avito и Telegram username для уведомлений
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 mt-6">
          <div className="space-y-2">
            <Label htmlFor="url">
              Ссылка на поиск Avito{" "}
              <span aria-label="обязательное поле">*</span>
            </Label>
            <Input
              id="url"
              type="url"
              placeholder="https://www.avito.ru/rossiya?q=…"
              autoComplete="url"
              spellCheck={false}
              {...register("url")}
              aria-invalid={!!errors.url}
              aria-describedby={errors.url ? "url-error" : undefined}
              style={{ fontSize: "16px" }}
            />
            {errors.url && (
              <p
                id="url-error"
                className="text-sm text-destructive"
                role="alert"
              >
                {errors.url}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Скопируйте ссылку из адресной строки браузера после настройки
              фильтров поиска
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="telegramUsername">
              Telegram username <span aria-label="обязательное поле">*</span>
            </Label>
            <Input
              id="telegramUsername"
              type="text"
              placeholder="@username или username"
              autoComplete="username"
              spellCheck={false}
              {...register("telegramUsername")}
              aria-invalid={!!errors.telegramUsername}
              aria-describedby={
                errors.telegramUsername ? "telegram-error" : undefined
              }
              style={{ fontSize: "16px" }}
            />
            {errors.telegramUsername && (
              <p
                id="telegram-error"
                className="text-sm text-destructive"
                role="alert"
              >
                {errors.telegramUsername}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Уведомления о новых объявлениях будут отправлены на этот аккаунт
            </p>
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
              {isPending ? "Добавление…" : "Добавить"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
