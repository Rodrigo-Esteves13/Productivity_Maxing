import { useEffect, useState } from 'react';
import PageLayout from '../components/Layout/PageLayout';
import PageHeader from '../components/Layout/PageHeader';
import StatusBadge from '../components/UI/StatusBadge';
import DifficultyBadge from '../components/UI/DifficultyBadge';
import { getUserTasks } from '../api/userService';
import type { Task } from '../types/models';

export default function Dashboard() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const data = await getUserTasks();
        setTasks(data);
      } catch (err) {
        console.error('Erro ao carregar dashboard', err);
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, []);

  return (
    <PageLayout>
      <PageHeader 
        title="Dashboard Analítica" 
        description="Visão global de todas as tuas atividades, notas e progressos." 
      />

      {isLoading ? (
        <div className="flex justify-center py-10">
          <p className="text-neutral-400 animate-pulse">A compilar dados...</p>
        </div>
      ) : (
        <div className="bg-neutral-900/50 border border-neutral-800 rounded-xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-neutral-300 whitespace-nowrap">
              <thead className="text-xs text-neutral-400 uppercase bg-neutral-950/50 border-b border-neutral-800">
                <tr>
                  <th className="px-4 py-3 font-medium">Data</th>
                  <th className="px-4 py-3 font-medium">Área</th>
                  <th className="px-4 py-3 font-medium">Título / Tópicos</th>
                  <th className="px-4 py-3 font-medium">Tipo</th>
                  <th className="px-4 py-3 font-medium">Peso</th>
                  <th className="px-4 py-3 font-medium">Dificuldade</th>
                  <th className="px-4 py-3 font-medium text-center">Status</th>
                  <th className="px-4 py-3 font-medium text-center">Nota Alvo</th>
                  <th className="px-4 py-3 font-medium text-center">Nota Real</th>
                </tr>
              </thead>
              <tbody>
                {tasks.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-neutral-500">
                      Nenhuma tarefa encontrada.
                    </td>
                  </tr>
                ) : (
                  tasks.map((task) => (
                    <tr key={task.id} className="border-b border-neutral-800 hover:bg-neutral-800/30 transition-colors">
                      <td className="px-4 py-3">{new Date(task.date).toLocaleDateString()}</td>
                      <td className="px-4 py-3 font-medium text-white">{task.area?.name || '—'}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-neutral-200">{task.title}</div>
                        {task.topics && <div className="text-xs text-neutral-500 mt-0.5">{task.topics}</div>}
                      </td>
                      <td className="px-4 py-3 text-xs">{task.type.replace(/_/g, ' ')}</td>
                      <td className="px-4 py-3">{task.weightPercentage ? `${task.weightPercentage}%` : '—'}</td>
                      <td className="px-4 py-3"><DifficultyBadge difficulty={task.difficulty} /></td>
                      <td className="px-4 py-3 text-center"><StatusBadge status={task.progressStatus} /></td>
                      <td className="px-4 py-3 text-center font-medium text-blue-400">{task.targetGrade ?? '—'}</td>
                      <td className="px-4 py-3 text-center font-bold text-green-400">{task.realGrade ?? '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </PageLayout>
  );
}