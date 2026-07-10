import React from 'react';
import { useDataExport } from '../../hooks/useDataExport';
import Button from '../UI/Button';
import FormError from '../UI/FormError';

export const DataExportSection: React.FC = () => {
  // Consumimos a lógica abstraída do hook
  const { isExporting, error, handleExport } = useDataExport();

  return (
    <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          Portabilidade de Dados (GDPR)
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          Descarrega uma cópia de toda a informação que a plataforma guarda sobre ti, incluindo o teu perfil, tarefas e configurações. O ficheiro será guardado no formato JSON.
        </p>
      </div>

      {error && (
        <div className="mb-4">
          <FormError message={error} />
        </div>
      )}

      <Button
        onClick={handleExport}
        disabled={isExporting}
        variant="secondary"
        className="w-full sm:w-auto"
      >
        {isExporting ? 'A preparar exportação...' : 'Exportar os meus dados'}
      </Button>
    </div>
  );
};