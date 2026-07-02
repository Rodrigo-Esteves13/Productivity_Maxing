import { useEffect, useState } from 'react';
import api from '../api/client';
import { Navbar } from '../components/Navbar';
import StatusBadge from '../components/UI/StatusBadge';
import type { Task } from '../types/task';

export default function Dashboard() {
  const [tasks, setTasks] = useState<Task[]>([]);

  useEffect(() => {
    api.get<Task[]>('/tasks').then((res) => setTasks(res.data));
  }, []);

  return (
    <div className="min-h-screen bg-neutral-950">
      <Navbar />

      <div className="p-6">
        <h1 className="text-2xl font-bold mb-4 text-white">Dashboard</h1>
        <table className="w-full text-sm text-neutral-200">
          <thead>
            <tr className="text-left border-b border-neutral-800">
              <th className="p-2">Cadeira</th>
              <th className="p-2">Título</th>
              <th className="p-2">Data</th>
              <th className="p-2">Peso</th>
              <th className="p-2">Dificuldade</th>
              <th className="p-2">Status</th>
              <th className="p-2">Nota Alvo</th>
              <th className="p-2">Nota Real</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((t) => (
              <tr key={t.id} className="border-b border-neutral-900">
                <td className="p-2">{t.area}</td>
                <td className="p-2">{t.title}</td>
                <td className="p-2">{t.date}</td>
                <td className="p-2">{t.weightPercentage}%</td>
                <td className="p-2">{t.difficulty}</td>
                <td className="p-2"><StatusBadge status={t.progressStatus} /></td>
                <td className="p-2">{t.targetGrade}</td>
                <td className="p-2">{t.realGrade ?? '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}