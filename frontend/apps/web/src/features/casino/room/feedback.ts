import * as React from "react";
import type { DomainError } from "@ssot/ssot";
import { toast } from "@ssot/ui";

export function getStepperErrorMessage(
  error: DomainError | undefined,
  fallbackMessage = "Transaction failed. Please try again."
) {
  return error?.message ?? fallbackMessage;
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

export function useVrfTimeoutToast(
  isSoftTimeout: boolean,
  message = "Waiting for oracle... VRF resolution can take 30-120s on testnets."
) {
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
