import * as React from "react";
import type { DomainError } from "@ssot/ssot";
import { toast } from "@ssot/ui";

type StepperDisplayError = Partial<Pick<DomainError, "code" | "message" | "severity">>;

export function getStepperErrorMessage(
  error: StepperDisplayError | undefined,
  fallbackMessage = "—"
) {
  if (!error) return fallbackMessage;

  if ("code" in error && error.code === "USER_REJECTED") {
    return error.message || fallbackMessage;
  }

  if ("code" in error && error.code === "ALLOWANCE_NOT_CONFIRMED") {
    return error.message || fallbackMessage;
  }

  return fallbackMessage;
}

export function useBetStepperFailureToast({
  status,
  error,
  fallbackMessage
}: {
  status: string;
  error: DomainError | undefined;
  fallbackMessage?: string;
}) {
  const prevStatusRef = React.useRef<string>("");

  React.useEffect(() => {
    if (status === "failed" && prevStatusRef.current !== "failed") {
      toast.error(getStepperErrorMessage(error, fallbackMessage));
    }
    prevStatusRef.current = status;
  }, [status, error, fallbackMessage]);
}

export function useVrfTimeoutToast(isSoftTimeout: boolean, message = "—") {
  const shownRef = React.useRef(false);

  React.useEffect(() => {
    if (!isSoftTimeout) {
      shownRef.current = false;
      return;
    }
    if (!shownRef.current) {
      shownRef.current = true;
      toast.warning(message, {
        duration: 20000,
        id: "vrf-timeout"
      });
    }
  }, [isSoftTimeout, message]);
}
