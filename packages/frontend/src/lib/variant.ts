/**
 * Build variant detection.
 *
 * With the cookie-based auth system, there is only one variant: "full".
 */

export type AppVariant = "full" | "mini";

export const APP_VARIANT: AppVariant = "full";

export const IS_MINI = false;
