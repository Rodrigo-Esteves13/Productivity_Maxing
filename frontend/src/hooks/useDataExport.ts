import { useState } from 'react';
// 1. Atualiza a importação aqui:
import { exportMyData } from '../api/userService'; 
import { downloadJson } from '../utils/downloadJson';

interface UseDataExportReturn {
  isExporting: boolean;
  error: string | null;
  handleExport: () => Promise<void>;
}

export function useDataExport(): UseDataExportReturn {
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleExport = async () => {
    setIsExporting(true);
    setError(null);

    try {
      // 2. Chama a nova função aqui:
      const data = await exportMyData();
      
      const dateStr = new Date().toISOString().split('T')[0];
      const filename = `pmaxing_export_${dateStr}.json`;
      
      downloadJson(data, filename);
    } catch (err) {
      console.error('Error exporting data:', err);
      setError('An error occurred while preparing your export. Please try again later.');
    } finally {
      setIsExporting(false);
    }
  };

  return { isExporting, error, handleExport };
}