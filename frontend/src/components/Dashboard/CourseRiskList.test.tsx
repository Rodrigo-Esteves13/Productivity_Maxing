import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import CourseRiskList from './CourseRiskList';
import { risk as en } from '../../i18n/messages/en/risk';
import type { CourseRisk, RiskReasonCode } from '../../types/models';

const t = (key: string, params?: Record<string, string | number>) =>
  key + (params ? ` ${JSON.stringify(params)}` : '');

function course(areaId: string, over: Partial<CourseRisk> = {}): CourseRisk {
  return {
    areaId,
    areaName: `Course ${areaId}`,
    colorHex: '#7c3aed',
    score: 70,
    level: 'high',
    track: 'CONTINUOUS',
    reasons: [],
    currentAverage: 8,
    gradedWeightPct: 50,
    remainingWeightPct: 50,
    neededOnRemaining: 12,
    ...over,
  };
}

describe('CourseRiskList', () => {
  it('renders no rows for an empty list', () => {
    const html = renderToStaticMarkup(<CourseRiskList risks={[]} t={t} lang="en" />);
    expect(html).not.toContain('course-risk-row');
  });

  it('renders level, track and reasons by code with params', () => {
    const html = renderToStaticMarkup(
      <CourseRiskList
        risks={[
          course('a', {
            level: 'extreme',
            track: 'EXAM',
            reasons: [{ code: 'ABSENCE_OVER_LIMIT', params: { share: 30, limit: 25 } }],
          }),
        ]}
        t={t}
        lang="en"
      />,
    );
    expect(html).toContain('courseRisk.level.extreme');
    expect(html).toContain('courseRisk.track.EXAM');
    expect(html).toContain('data-reason="ABSENCE_OVER_LIMIT"');
    expect(html).toContain('courseRisk.reason.ABSENCE_OVER_LIMIT');
    expect(html).toContain('&quot;share&quot;:&quot;30&quot;');
  });

  it('keeps the given course order and reason order', () => {
    const html = renderToStaticMarkup(
      <CourseRiskList
        risks={[
          course('first', {
            reasons: [
              { code: 'POSTPONED_TASKS', params: { count: 2 } },
              { code: 'LOW_STUDY_TIME', params: {} },
            ],
          }),
          course('second'),
        ]}
        t={t}
        lang="en"
      />,
    );
    expect(html.indexOf('Course first')).toBeLessThan(html.indexOf('Course second'));
    expect(html.indexOf('data-reason="POSTPONED_TASKS"')).toBeLessThan(html.indexOf('data-reason="LOW_STUDY_TIME"'));
  });

  it('formats reason numbers with the decimal separator of the active language', () => {
    const risks = [
      course('a', {
        reasons: [{ code: 'HIGH_NEED_ON_REMAINING', params: { needed: 17.7, remaining: 40, label: 'Exam 1.5' } }],
      }),
    ];
    const pt = renderToStaticMarkup(<CourseRiskList risks={risks} t={t} lang="pt" />);
    const en = renderToStaticMarkup(<CourseRiskList risks={risks} t={t} lang="en" />);
    expect(pt).toContain('&quot;needed&quot;:&quot;17,7&quot;');
    expect(en).toContain('&quot;needed&quot;:&quot;17.7&quot;');
    expect(pt).toContain('&quot;remaining&quot;:&quot;40&quot;');
    expect(pt).toContain('Exam 1.5');
  });

  it('has an English message for every reason code, level and track', () => {
    const codes: RiskReasonCode[] = [
      'COMPONENT_BELOW_MIN', 'TOO_MANY_BELOW_SECOND_THRESHOLD', 'IMPOSSIBLE_ON_REMAINING',
      'HIGH_NEED_ON_REMAINING', 'LOW_AVERAGE_SO_FAR', 'LOW_STUDY_TIME', 'ABSENCE_NEAR_LIMIT',
      'ABSENCE_OVER_LIMIT', 'POSTPONED_TASKS', 'TEACHER_HISTORY_LOWER', 'ONLY_EXAM_TRACK_LEFT',
    ];
    for (const code of codes) expect(en[`courseRisk.reason.${code}`]).toBeTruthy();
    for (const k of ['low', 'medium', 'high', 'extreme']) expect(en[`courseRisk.level.${k}`]).toBeTruthy();
    for (const k of ['CONTINUOUS', 'EXAM', 'RESIT']) expect(en[`courseRisk.track.${k}`]).toBeTruthy();
  });
});
