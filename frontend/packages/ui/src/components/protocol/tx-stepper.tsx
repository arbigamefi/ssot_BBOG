"use client";

import * as React from "react";
import { CheckCircle2, Circle, Loader2, XCircle } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";

export type StepState = "todo" | "active" | "done" | "error";

export type TxStepItem = {
  title: string;
  description?: string;
  state: StepState;
  right?: React.ReactNode;
};

export type TxStepperProps = {
  title: string;
  subtitle?: string;
  steps: TxStepItem[];
  footer?: React.ReactNode;
  className?: string;
};

function StepIcon({ state }: { state: StepState }) {
  switch (state) {
    case "done":
      return <CheckCircle2 className="h-5 w-5" />;
    case "error":
      return <XCircle className="h-5 w-5" />;
    case "active":
      return <Loader2 className="h-5 w-5 animate-spin" />;
    default:
      return <Circle className="h-5 w-5 opacity-60" />;
  }
}

export function TxStepper({ title, subtitle, steps, footer, className }: TxStepperProps) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-3">
          <span>{title}</span>
        </CardTitle>
        {subtitle ? <div className="text-sm text-fg-muted">{subtitle}</div> : null}
      </CardHeader>
      <CardContent>
        <div className="space-y-3" role="list" aria-label={title}>
          {steps.map((s, idx) => (
            <div
              key={`${idx}-${s.title}`}
              className="flex items-start justify-between gap-3"
              role="listitem"
              aria-current={s.state === "active" ? "step" : undefined}
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5" aria-hidden="true">
                  <StepIcon state={s.state} />
                </div>
                <div>
                  <div className="font-medium">{s.title}</div>
                  {s.description ? (
                    <div className="text-sm text-fg-muted">{s.description}</div>
                  ) : null}
                </div>
              </div>
              {s.right ? <div className="shrink-0">{s.right}</div> : null}
            </div>
          ))}
          {footer ? <div className="pt-2">{footer}</div> : null}
        </div>
      </CardContent>
    </Card>
  );
}
