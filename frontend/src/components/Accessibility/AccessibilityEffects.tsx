import { useAccessibilityPrefs } from '../../hooks/useAccessibilityPrefs';

// Renders nothing - just mounts useAccessibilityPrefs once at the app
// root so a saved font-size/contrast preference is re-applied to <html>
// on every fresh page load, not only when the user visits Profile (where
// the actual toggles live).
export default function AccessibilityEffects() {
  useAccessibilityPrefs();
  return null;
}
