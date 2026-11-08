import { useContext } from 'react';
import { AmbientSoundContext } from './ambient-sound-context';

export function useAmbientSound() {
  const context = useContext(AmbientSoundContext);
  if (context === undefined) {
    throw new Error('useAmbientSound must be used within an AmbientSoundProvider');
  }
  return context;
}
