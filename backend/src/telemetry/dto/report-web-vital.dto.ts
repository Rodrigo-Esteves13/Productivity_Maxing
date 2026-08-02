import { IsIn, IsNumber, IsString, MaxLength } from 'class-validator';

// The metrics the `web-vitals` package reports - CLS/FCP/FID/INP/LCP/TTFB.
// INP has replaced FID as the responsiveness metric in newer web-vitals
// versions, but FID is kept here too for compatibility with whichever
// version ends up installed.
const KNOWN_METRICS = ['CLS', 'FCP', 'FID', 'INP', 'LCP', 'TTFB'] as const;

export class ReportWebVitalDto {
  @IsIn(KNOWN_METRICS)
  name!: (typeof KNOWN_METRICS)[number];

  @IsNumber()
  value!: number;

  // The web-vitals library's own per-metric-instance id (distinguishes
  // repeated measurements of the same metric name within one page visit,
  // e.g. CLS can report more than once as layout keeps shifting).
  @IsString()
  @MaxLength(100)
  id!: string;

  @IsString()
  @MaxLength(500)
  url!: string;
}
