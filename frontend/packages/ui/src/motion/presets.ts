export const motionDurations = {
  instant: 0,
  fast: 0.16,
  normal: 0.28,
  slow: 0.44
} as const;

export const motionEasings = {
  standard: [0.16, 1, 0.3, 1],
  enter: [0.22, 1, 0.36, 1],
  exit: [0.4, 0, 1, 1]
} as const;

export const fadeUp = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: 4 },
  transition: {
    duration: motionDurations.normal,
    ease: motionEasings.standard
  }
} as const;

export const fadeIn = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: {
    duration: motionDurations.fast,
    ease: motionEasings.standard
  }
} as const;

export const scaleIn = {
  initial: { opacity: 0, scale: 0.98 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.98 },
  transition: {
    duration: motionDurations.normal,
    ease: motionEasings.standard
  }
} as const;

export function staggerChildren(delay = 0.04) {
  return {
    animate: {
      transition: {
        staggerChildren: delay
      }
    }
  } as const;
}
