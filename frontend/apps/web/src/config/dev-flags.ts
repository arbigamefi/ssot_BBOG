function devOnlyFlag(value: string | undefined, nodeEnv = process.env.NODE_ENV) {
  return nodeEnv !== "production" && value === "true";
}

export const DISABLE_AGE_GATE_IN_DEV = devOnlyFlag(process.env.NEXT_PUBLIC_DEV_DISABLE_AGE_GATE);

export const DISABLE_ONBOARDING_IN_DEV = devOnlyFlag(
  process.env.NEXT_PUBLIC_DEV_DISABLE_ONBOARDING
);

export const __test__ = {
  devOnlyFlag
};
