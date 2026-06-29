import type {ComponentType} from 'react';
import * as Sentry from '@sentry/react-native';

import {ENV} from './config';

/** True when crash/error reporting is configured (a DSN is present). */
export const monitoringEnabled = Boolean(ENV.SENTRY_DSN);

/**
 * Crash/error reporting. A no-op unless `SENTRY_DSN` is set in `.env`, so local
 * dev and un-configured builds send nothing. Call once, before the app mounts.
 */
export function initMonitoring(): void {
  if (!monitoringEnabled) {
    return;
  }
  Sentry.init({
    dsn: ENV.SENTRY_DSN,
    // Capture a modest slice of performance traces; tune once you know volume.
    tracesSampleRate: 0.2,
  });
}

/**
 * Wrap the root component with Sentry's error-boundary + performance
 * instrumentation — but only when monitoring is enabled. Calling `Sentry.wrap`
 * without a prior `Sentry.init()` makes the SDK warn ("App Start Span could not
 * be finished…"), so with no DSN we hand back the component untouched.
 */
export function wrapApp<P extends Record<string, unknown>>(
  Root: ComponentType<P>,
): ComponentType<P> {
  return monitoringEnabled ? Sentry.wrap(Root) : Root;
}

export {Sentry};
