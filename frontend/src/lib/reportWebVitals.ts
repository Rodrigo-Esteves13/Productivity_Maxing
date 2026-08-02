import { onCLS, onFCP, onINP, onLCP, onTTFB } from 'web-vitals';
import { reportWebVital } from '../api/telemetryService';

// Called once at app startup (see main.tsx). Each on*() callback fires
// whenever that metric is finalized for this page visit - web-vitals
// handles the "when is this metric actually done changing" timing
// itself, this just forwards whatever it reports.
export function reportWebVitals(): void {
  const send = (metric: { name: string; value: number; id: string }) => {
    reportWebVital({ name: metric.name, value: metric.value, id: metric.id, url: window.location.href });
  };

  onCLS(send);
  onFCP(send);
  onINP(send);
  onLCP(send);
  onTTFB(send);
}
