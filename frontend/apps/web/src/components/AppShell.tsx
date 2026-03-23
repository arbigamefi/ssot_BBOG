"use client";

import * as React from "react";

import { TrustShell } from "./TrustShell";

export function AppShell({ children }: { children: React.ReactNode }) {
  return <TrustShell>{children}</TrustShell>;
}
