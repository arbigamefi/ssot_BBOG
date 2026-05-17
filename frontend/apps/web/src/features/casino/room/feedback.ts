import * as React from "react";
import type { DomainError } from "@ssot/ssot";
import { toast } from "@ssot/ui";

export function getStepperErrorMessage(error: DomainError | undefined) {
  return error?.message ?? "Transaction failed. Please try again.";
}

export function useBetStepperFailureToast({
  status,
  error
}: {
  status: string;
  error: DomainError | undefined;
}) {
  const prevStatusRef = React.useRef<string>("");

  React.useEffect(() => {
    if (status === "failed" && prevStatusRef.current !== "failed") {
      toast.error(getStepperErrorMessage(error));
    }
    prevStatusRef.current = status;
  }, [status, error]);
}

export function useVrfTimeoutToast(isSoftTimeout: boolean) {
  const shownRef = React.useRef(false);

  React.useEffect(() => {
    if (!isSoftTimeout) {
      shownRef.current = false;
      return;
    }
    if (!shownRef.current) {
      shownRef.current = true;
      toast.warning("Waiting for oracle... VRF resolution can take 30-120s on testnets.", {
        duration: 20000,
        id: "vrf-timeout"
      });
    }
  }, [isSoftTimeout]);
}
