/**
 * Feature flags for controlling feature availability.
 *
 * - `functionCalling`: Gates all function calling UI and logic. Set to `true` when the feature is complete.
 * - `debugMode`: Enabled in development, disabled in production.
 */
const features = {
  functionCalling: false,
  debugMode: import.meta.env.DEV,
} as const;

export default features;
