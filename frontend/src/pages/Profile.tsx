import { useEffect, useState } from 'react';
import PageLayout from '../components/Layout/PageLayout';
import PageHeader from '../components/Layout/PageHeader';
import Avatar from '../components/Profile/Avatar';
import ProfileStat from '../components/Profile/ProfileStat';
import EditProfileModal from '../components/Profile/EditProfileModal';
import ActionButton from '../components/UI/ActionButton';
import { PencilIcon } from '../components/UI/Icons';
import { getUserTasks, getTaskMetadata } from '../api/userService';
import { useAuth } from '../context/useAuth';
import type { Task, TaskTypeOption } from '../types/models';

// "Project" não é uma Area — é um TaskType como outro qualquer (ex: "PROJETO"),
// configurável pelo admin em /admin/task-types. Como a key exata é dinâmica,
// identificamos aqui por key/label que contenha "proj". Se o teu TaskType de
// projeto tiver uma key diferente (ex: "TRABALHO_FINAL"), troca este regex.
const PROJECT_TYPE_PATTERN = /proj/i;

// Chave de dia em fuso horário LOCAL (não UTC). "toISOString()" converte
// para UTC antes de cortar a data, o que dá o dia errado sempre que a hora
// local estiver perto da meia-noite e o fuso não for UTC+0 (ex: 00:30 em
// Lisboa/Porto no horário de verão vira "ontem" em UTC). Isto causava
// streaks a partir ou a quebrar sozinhas perto da meia-noite.
function toLocalDayKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function computeStats(tasks: Task[], projectTypeKeys: Set<string>) {
  const completedTasks = tasks.filter((t) => t.progressStatus === 'COMPLETED');
  const completed = completedTasks.length;
  const active = tasks.length - completed;
  const projects = tasks.filter((t) => projectTypeKeys.has(t.type)).length;

  // Agora o backend guarda "completedAt" (o momento real em que a task
  // passou a COMPLETED), por isso o streak deixa de depender da "date"
  // (que é só o prazo/alvo). Tasks antigas, concluídas antes desta
  // funcionalidade existir, não têm "completedAt", para essas continuamos
  // a usar a "date" como fallback, para não fazer a streak desaparecer.
  const doneDayKeys = new Set(
    completedTasks.map((t) =>
      toLocalDayKey(new Date(t.completedAt ?? t.date))
    )
  );
  let streak = 0;
  const cursor = new Date();
  const todayKey = toLocalDayKey(cursor);

  // Se ainda não completaste nada hoje, isso não deve "zerar" a streak
  // um streak normal só quebra quando um dia inteiro passa sem atividade.
  // Por isso só começamos a contar a partir de hoje se hoje já tiver algo;
  // caso contrário começamos em ontem, e o streak de dias anteriores
  // mantém-se visível até à meia-noite.
  if (!doneDayKeys.has(todayKey)) {
    cursor.setDate(cursor.getDate() - 1);
  }

  while (true) {
    const key = toLocalDayKey(cursor);
    if (doneDayKeys.has(key)) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    } else {
      break;
    }
  }

  return { completed, active, projects, streak };
}

export default function Profile() {
  const { user, isLoadingUser, updateUser } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [taskTypes, setTaskTypes] = useState<TaskTypeOption[]>([]);
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const [isEditOpen, setIsEditOpen] = useState(false);

  useEffect(() => {
    async function fetchStats() {
      try {
        const [tasksData, metaData] = await Promise.all([getUserTasks(), getTaskMetadata()]);
        setTasks(tasksData);
        setTaskTypes(metaData.taskTypes);
      } catch (err) {
        console.error('Failed to fetch profile stats:', err);
      } finally {
        setIsLoadingStats(false);
      }
    }
    fetchStats();
  }, []);

  if (isLoadingUser || !user) {
    return (
      <PageLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-neutral-400 animate-pulse">Loading profile...</p>
        </div>
      </PageLayout>
    );
  }

  const initials = user.name ? user.name.substring(0, 2).toUpperCase() : user.email.substring(0, 2).toUpperCase();

  const projectTypeKeys = new Set(
    taskTypes.filter((t) => PROJECT_TYPE_PATTERN.test(t.key) || PROJECT_TYPE_PATTERN.test(t.label)).map((t) => t.key)
  );
  const { completed, active, projects, streak } = computeStats(tasks, projectTypeKeys);

  return (
    <PageLayout>
      <PageHeader
        title="User Profile"
        description="Manage your personal information and settings."
        action={
          <ActionButton onClick={() => setIsEditOpen(true)} className="flex items-center gap-2">
            <PencilIcon />
            Edit Profile
          </ActionButton>
        }
      />

      <div className="bg-neutral-900/50 border border-neutral-800 rounded-xl p-8 max-w-3xl">
        <div className="flex flex-col sm:flex-row items-center gap-6 mb-8">
          <Avatar initials={initials} avatarUrl={user.avatarUrl} alt="Avatar" size="lg" />

          <div className="text-center sm:text-left">
            <h2 className="text-2xl font-bold text-white">{user.name || 'Anonymous User'}</h2>
            <p className="text-neutral-400">{user.email}</p>
            <span className="inline-block mt-2 px-3 py-1 bg-neutral-800 text-xs font-medium rounded-md text-neutral-300">
              {user.role}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-8 pt-8 border-t border-neutral-800">
          <ProfileStat label="Completed Tasks" value={isLoadingStats ? '-' : completed} />
          <ProfileStat label="Active Tasks" value={isLoadingStats ? '-' : active} />
          <ProfileStat label="Projects" value={isLoadingStats ? '-' : projects} />
          <ProfileStat label="Streak" value={isLoadingStats ? '-' : `${streak}d`} />
        </div>
      </div>

      <EditProfileModal
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        user={user}
        onSaved={(updatedUser) => {
          updateUser(updatedUser);
          setIsEditOpen(false);
        }}
      />
    </PageLayout>
  );
}
