"use client";

import { Button, Card } from "@acme/ui";
import { AlertCircle } from "lucide-react";
import { useEffect } from "react";

export default function MonitorsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="container mx-auto py-6 px-4 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Мониторинг Avito</h1>
      </div>

      <Card className="p-8">
        <div className="flex flex-col items-center justify-center text-center space-y-4">
          <AlertCircle
            className="h-12 w-12 text-destructive"
            aria-hidden="true"
          />
          <div className="space-y-2">
            <h2 className="text-xl font-semibold">Что-то пошло не так</h2>
            <p className="text-sm text-muted-foreground max-w-md">
              Не удалось загрузить список мониторов. Попробуйте обновить
              страницу.
            </p>
          </div>
          <Button onClick={reset}>Попробовать снова</Button>
        </div>
      </Card>
    </div>
  );
}
