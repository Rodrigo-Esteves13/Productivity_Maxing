import { packs } from './packs';
import { social } from './social';
import { layout } from './layout';
import { footer } from './footer';
import { common } from './common';
import { auth } from './auth';
import { feedback } from './feedback';
import { grades } from './grades';
import { insights } from './insights';
import { nav } from './nav';
import { notebook } from './notebook';
import { onboarding } from './onboarding';
import { prefs } from './prefs';
import { review } from './review';
import { schedule } from './schedule';
import { share } from './share';
import { tasks } from './tasks';
import { auto } from './auto';
import { extra } from './extra';
import { fase7 } from './fase7';
import { fase7b } from './fase7b';
import { fase7c } from './fase7c';
import { meds } from './meds';

export const zh: Record<string, string> = {
  ...packs,
  ...social,
  ...layout,
  ...footer,
  ...common,
  ...auth,
  ...feedback,
  ...grades,
  ...insights,
  ...nav,
  ...notebook,
  ...onboarding,
  ...prefs,
  ...review,
  ...schedule,
  ...share,
  ...tasks,
  ...auto,
  ...extra,
  ...fase7,
  ...fase7b,
  ...fase7c,
  ...meds,
};
