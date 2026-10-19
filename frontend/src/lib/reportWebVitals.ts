import { reportWebVital } from '../api/telemetryService';
import { telemetryUrl } from './telemetryUrl';

// Called once at app startup (see main.tsx). Each on*() callback fires
// whenever that metric is finalized for this page visit - web-vitals
// handles the "when is this metric actually done changing" timing
// itself, this just forwards whatever it reports.
//
// The library is loaded with a dynamic import so it stays out of the main
// bundle (nothing on screen depends on it). The URL sent is only the path,
// with secret segments redacted (see telemetryUrl.ts): the reset-password
// link carries a recovery token in its hash.
export function reportWebVitals(): void {
  const send = (metric: { name: string; value: number; id: string }) => {
    reportWebVital({ name: metric.name, value: metric.value, id: metric.id, url: telemetryUrl() });
  };

  void import('web-vitals')
    .then(({ onCLS, onFCP, onINP, onLCP, onTTFB }) => {
      onCLS(send);
      onFCP(send);
      onINP(send);
      onLCP(send);
      onTTFB(send);
    })
    .catch(() => undefined);
}
