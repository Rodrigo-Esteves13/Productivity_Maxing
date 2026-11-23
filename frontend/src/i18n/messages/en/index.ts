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
import { fileIndicator } from './fileIndicator';
import { procrastination } from './procrastination';
import { taskTags } from './taskTags';
import { flashcards } from './flashcards';
import { streakFreeze } from './streakFreeze';
import { dailyDigest } from './dailyDigest';
import { paletteActions } from './paletteActions';
import { fase7c } from './fase7c';
import { meds } from './meds';
import { readiness } from './readiness';
import { finance } from './finance';
import { integration } from './integration';
import { devices } from './devices';
import { approvalRules } from './approvalRules';
import { risk } from './risk';
import { teacher } from './teacher';
import { ratings } from './ratings';
import { status } from './status';
import { packUpdatesWidget } from './packUpdatesWidget';
import { distractionStats } from './distractionStats';
import { financeExport } from './financeExport';
import { medReminderStatus } from './medReminderStatus';
import { moneySnapshot } from './moneySnapshot';
import { ambientGlobal } from './ambientGlobal';
import { financeFixes } from './financeFixes';
import { focusHours } from './focusHours';
import { auditL10n } from './auditL10n';
import { financeImport } from './financeImport';
import { wakeLock } from './wakeLock';
import { confirmGuards } from './confirmGuards';
import { startFive } from './startFive';
import { energyMatch } from './energyMatch';
import { flashcardTest } from './flashcardTest';
import { flashcardForecast } from './flashcardForecast';
import { ectsWorkload } from './ectsWorkload';
import { financeNoSpend } from './financeNoSpend';
import { paletteShortcuts } from './paletteShortcuts';
import { eisenhower } from './eisenhower';
import { replan } from './replan';
import { flashcardImport } from './flashcardImport';
import { lighterDay } from './lighterDay';
import { typeBalance } from './typeBalance';
import { taskBlocker } from './taskBlocker';
import { checklistFromTopics } from './checklistFromTopics';
import { areaSuggestion } from './areaSuggestion';
import { difficultySuggestion } from './difficultySuggestion';
import { taskHistory } from './taskHistory';
import { timeline } from './timeline';
import { pushKinds } from './pushKinds';
import { avatarTier } from './avatarTier';
import { badges } from './badges';
import { financeUndo } from './financeUndo';
import { widgetOrder } from './widgetOrder';
import { singleTaskMode } from './singleTaskMode';
import { xpLevel } from './xpLevel';
import { periodReview } from './periodReview';
import { areaConsistency } from './areaConsistency';
import { statusSummary } from './statusSummary';
import { securityExport } from './securityExport';
import { chartExport } from './chartExport';
import { weeklyChallenge } from './weeklyChallenge';
import { accentColor } from './accentColor';
import { medFollowUp } from './medFollowUp';
import { greeting } from './greeting';
import { weightVsGrade } from './weightVsGrade';
import { quizzes } from './quizzes';
import { quizGenerators } from './quizGenerators';
import { quickWins } from './quickWins';
import { undoDelete } from './undoDelete';
import { uxSearch } from './uxSearch';
import { ux4Tasks } from './ux4Tasks';
import { ux4Packs } from './ux4Packs';
import { ux4Areas } from './ux4Areas';
import { ux4Notes } from './ux4Notes';
import { ux4Study } from './ux4Study';
import { ux4Finance } from './ux4Finance';
import { ux4Wellbeing } from './ux4Wellbeing';
import { ux4Schedule } from './ux4Schedule';
import { ux4Admin } from './ux4Admin';
import { ux4Admin2 } from './ux4Admin2';
import { ux4Social } from './ux4Social';
import { ux4Global } from './ux4Global';

export const en: Record<string, string> = {
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
  ...fileIndicator,
  ...procrastination,
  ...taskTags,
  ...flashcards,
  ...streakFreeze,
  ...dailyDigest,
  ...paletteActions,
  ...fase7c,
  ...meds,
  ...readiness,
  ...finance,
  ...integration,
  ...devices,
  ...approvalRules,
  ...risk,
  ...teacher,
  ...ratings,
  ...status,
  ...packUpdatesWidget,
  ...distractionStats,
  ...financeExport,
  ...medReminderStatus,
  ...moneySnapshot,
  ...ambientGlobal,
  ...financeFixes,
  ...focusHours,
  ...auditL10n,
  ...financeImport,
  ...wakeLock,
  ...confirmGuards,
  ...startFive,
  ...energyMatch,
  ...flashcardTest,
  ...flashcardForecast,
  ...ectsWorkload,
  ...financeNoSpend,
  ...paletteShortcuts,
  ...eisenhower,
  ...replan,
  ...flashcardImport,
  ...lighterDay,
  ...typeBalance,
  ...taskBlocker,
  ...checklistFromTopics,
  ...areaSuggestion,
  ...difficultySuggestion,
  ...taskHistory,
  ...timeline,
  ...pushKinds,
  ...avatarTier,
  ...badges,
  ...financeUndo,
  ...widgetOrder,
  ...singleTaskMode,
  ...xpLevel,
  ...periodReview,
  ...areaConsistency,
  ...statusSummary,
  ...securityExport,
  ...chartExport,
  ...weeklyChallenge,
  ...accentColor,
  ...medFollowUp,
  ...greeting,
  ...weightVsGrade,
  ...quizzes,
  ...quizGenerators,
  ...quickWins,
  ...undoDelete,
  ...uxSearch,
  ...ux4Tasks,
  ...ux4Packs,
  ...ux4Areas,
  ...ux4Notes,
  ...ux4Study,
  ...ux4Finance,
  ...ux4Wellbeing,
  ...ux4Schedule,
  ...ux4Admin,
  ...ux4Admin2,
  ...ux4Social,
  ...ux4Global,
};
