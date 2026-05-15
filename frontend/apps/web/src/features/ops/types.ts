export type OpsStatusTone = "default" | "success" | "warn" | "danger" | "brand";

export type OpsMetric = {
  label: string;
  value: string;
  detail: string;
  tone?: OpsStatusTone;
};

export type OpsKeyValueRow = {
  label: string;
  value: string;
  detail?: string;
  tone?: OpsStatusTone;
};

export type OpsTrailRow = {
  time: string;
  block: string;
  event: string;
  status: string;
  context: string;
  tone?: OpsStatusTone;
};
