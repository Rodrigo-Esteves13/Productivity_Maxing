import { lazyWithPreload } from '../lib/lazyWithPreload';

// Todas as paginas lazy da app, num so sitio. lazyWithPreload deixa os
// links (PrefetchLink) e o RoutePrefetcher descarregar o chunk antes do
// clique, por isso mudar de pagina nao passa pelo esqueleto de carregamento.

export const Dashboard = lazyWithPreload(() => import('../pages/Dashboard'));
export const Tasks = lazyWithPreload(() => import('../pages/Tasks'));
export const Focus = lazyWithPreload(() => import('../pages/Focus'));
export const Schedule = lazyWithPreload(() => import('../pages/Schedule'));
export const Notebook = lazyWithPreload(() => import('../pages/Notebook'));
export const Profile = lazyWithPreload(() => import('../pages/Profile'));
export const Developer = lazyWithPreload(() => import('../pages/Developer'));
export const Devices = lazyWithPreload(() => import('../pages/Devices'));
export const Agent = lazyWithPreload(() => import('../pages/Agent'));
export const Areas = lazyWithPreload(() => import('../pages/Areas'));
export const Social = lazyWithPreload(() => import('../pages/Social'));
export const FriendNotes = lazyWithPreload(() => import('../pages/FriendNotes'));
export const FriendProfile = lazyWithPreload(() => import('../pages/FriendProfile'));
export const FriendLink = lazyWithPreload(() => import('../pages/FriendLink'));
export const FriendNoteEntry = lazyWithPreload(() => import('../pages/FriendNoteEntry'));
export const TaskPacks = lazyWithPreload(() => import('../pages/TaskPacks'));
export const ImportTaskPack = lazyWithPreload(() => import('../pages/ImportTaskPack'));
export const Users = lazyWithPreload(() => import('../pages/Users'));
export const Security = lazyWithPreload(() => import('../pages/Security'));
export const Appeals = lazyWithPreload(() => import('../pages/Appeals'));
export const FeedbackAdmin = lazyWithPreload(() => import('../pages/FeedbackAdmin'));
export const MyFeedback = lazyWithPreload(() => import('../pages/MyFeedback'));
export const PersonalNotes = lazyWithPreload(() => import('../pages/PersonalNotes'));
export const Finance = lazyWithPreload(() => import('../pages/Finance'));
export const FriendCodeRequestsAdmin = lazyWithPreload(() => import('../pages/FriendCodeRequestsAdmin'));
export const AdminUserProfile = lazyWithPreload(() => import('../pages/AdminUserProfile'));
export const TaskTypes = lazyWithPreload(() => import('../pages/TaskTypes'));
export const PrivacyPolicy = lazyWithPreload(() => import('../pages/PrivacyPolicy'));
export const SharedNotebookEntry = lazyWithPreload(() => import('../pages/SharedNotebookEntry'));
export const TermsOfService = lazyWithPreload(() => import('../pages/TermsOfService'));
export const Eula = lazyWithPreload(() => import('../pages/Eula'));
export const DmcaPolicy = lazyWithPreload(() => import('../pages/DmcaPolicy'));
export const WeeklyReview = lazyWithPreload(() => import('../pages/WeeklyReview'));
export const Wellbeing = lazyWithPreload(() => import('../pages/Wellbeing'));
export const ReportCard = lazyWithPreload(() => import('../pages/ReportCard'));
export const Ratings = lazyWithPreload(() => import('../pages/Ratings'));
export const CourseRisk = lazyWithPreload(() => import('../pages/CourseRisk'));
export const Pad = lazyWithPreload(() => import('../pages/Pad'));
export const PadsAdmin = lazyWithPreload(() => import('../pages/PadsAdmin'));
export const Turmas = lazyWithPreload(() => import('../pages/Turmas'));
export const TurmaPage = lazyWithPreload(() => import('../pages/TurmaPage'));
export const TurmaNote = lazyWithPreload(() => import('../pages/TurmaNote'));
export const TurmaSubjectEntry = lazyWithPreload(() => import('../pages/TurmaSubjectEntry'));
export const Changelog = lazyWithPreload(() => import('../pages/Changelog'));
export const NotFound = lazyWithPreload(() => import('../pages/NotFound'));
export const ResetPassword = lazyWithPreload(() => import('../pages/ResetPassword'));
export const VerifyEmail = lazyWithPreload(() => import('../pages/VerifyEmail'));
export const SetPassword = lazyWithPreload(() => import('../pages/SetPassword'));
export const LoginTwoFactor = lazyWithPreload(() => import('../pages/LoginTwoFactor'));

// Primeiro segmento do caminho -> pagina, para pre-carregar a partir de um link.
const BY_SECTION: Record<string, { preload: () => Promise<unknown> }> = {
  dashboard: Dashboard,
  tasks: Tasks,
  focus: Focus,
  schedule: Schedule,
  notebook: Notebook,
  areas: Areas,
  social: Social,
  profile: Profile,
  review: WeeklyReview,
  wellbeing: Wellbeing,
  'report-card': ReportCard,
  ratings: Ratings,
  risk: CourseRisk,
  pad: Pad,
  turmas: Turmas,
  changelog: Changelog,
  agent: Agent,
  developer: Developer,
  devices: Devices,
  'task-packs': TaskPacks,
  privacy: PrivacyPolicy,
  terms: TermsOfService,
  eula: Eula,
  dmca: DmcaPolicy,
  users: Users,
  'task-types': TaskTypes,
  security: Security,
  appeals: Appeals,
  feedback: FeedbackAdmin,
  'my-feedback': MyFeedback,
  notes: PersonalNotes,
  finance: Finance,
  'friend-code-requests': FriendCodeRequestsAdmin,
};

export function preloadRoute(path: string): void {
  const section = path.split(/[?#]/)[0].split('/')[1] ?? '';
  // Falhar aqui nao interessa: o clique volta a pedir o chunk.
  BY_SECTION[section]?.preload().catch(() => undefined);
}

// As paginas mais usadas: pre-carregadas no tempo livre logo apos entrar.
export const PRIMARY_PAGES = [Dashboard, Tasks, Focus, Schedule];
