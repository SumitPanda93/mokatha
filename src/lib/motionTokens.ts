/** Shared interaction timing — Apple-adjacent calm springs + editorial ease */
export const SHEET_SPRING = { type: "spring" as const, damping: 34, stiffness: 280, mass: 0.92 };
export const SHEET_SPRING_SOFT = { type: "spring" as const, damping: 36, stiffness: 260, mass: 0.95 };
export const EASE_CINEMA = [0.22, 1, 0.36, 1] as const;
export const FADE_STANDARD = { duration: 0.45, ease: EASE_CINEMA };
