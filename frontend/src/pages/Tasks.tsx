import PageLayout from '../components/Layout/PageLayout';
import PageHeader from '../components/Layout/PageHeader';
import TaskCard from '../components/Tasks/TaskCard';

export default function Tasks() {
  // Dados falsos (Mock) só para visualizares a estrutura até ligarmos à API
  const mockTasks = [
    { id: 1, title: 'Configurar Client Axios', description: 'Adicionar JWT interceptor no cliente HTTP.', status: 'pending' as const },
    { id: 2, title: 'Criar Rotas Protegidas', description: 'Implementar a lógica do AppRouter com o token.', status: 'completed' as const },
  ];

  // Exemplo de um botão que podemos injetar no cabeçalho
  const NewTaskButton = (
    <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors shadow-sm">
      + New Task
    </button>
  );

  return (
    <PageLayout>
      <PageHeader 
        title="My Tasks" 
        description="Manage your daily productivity and goals." 
        action={NewTaskButton} 
      />
      
      {/* Grid de Tarefas */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {mockTasks.map(task => (
          <TaskCard 
            key={task.id} 
            title={task.title} 
            description={task.description} 
            status={task.status} 
          />
        ))}
      </div>
    </PageLayout>
  );
}