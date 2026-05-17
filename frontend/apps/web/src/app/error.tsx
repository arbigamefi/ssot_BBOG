"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { Button, Card, CardContent, CardFooter, CardHeader, CardTitle } from "@ssot/ui";

export default function ErrorPage({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations();

  useEffect(() => {
    console.error("[ErrorBoundary]", error);
    (
      window as Window & { __ssotCaptureException?: (error: unknown) => void }
    ).__ssotCaptureException?.(error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{t("app.errors.boundaryTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{t("app.errors.unexpected")}</p>
          {error.digest && (
            <p className="mt-2 font-mono text-xs text-muted-foreground">
              {t("app.errors.errorId", { digest: error.digest })}
            </p>
          )}
        </CardContent>
        <CardFooter>
          <Button onClick={reset} variant="outline" size="sm">
            {t("app.errors.tryAgain")}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
