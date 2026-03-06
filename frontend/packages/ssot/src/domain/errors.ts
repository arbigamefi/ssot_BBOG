export type DomainErrorSeverity = "info" | "warning" | "error";

export interface DomainError {
  code: string;
  message: string;
  severity: DomainErrorSeverity;
  retryable?: boolean;
  details?: Record<string, unknown>;
}
