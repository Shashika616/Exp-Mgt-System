// Spring presets from docs/design.md §5. Use with `motion` (Framer Motion v12+).
import type { Transition } from "motion/react";

export const springDefault: Transition = { type: "spring", bounce: 0, duration: 0.3 };
export const springSheet: Transition = { type: "spring", bounce: 0.15, duration: 0.35 };
export const springDrop: Transition = { type: "spring", bounce: 0.2, duration: 0.4 };
export const springToast: Transition = { type: "spring", bounce: 0, duration: 0.35 };
export const fadeReduced: Transition = { duration: 0.15, ease: "easeOut" };

/** Choose the spring unless the user prefers reduced motion (then a 150 ms cross-fade). */
export const pick = (spring: Transition, reduced: boolean): Transition => (reduced ? fadeReduced : spring);
