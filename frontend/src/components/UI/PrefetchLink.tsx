import { Link, type LinkProps } from 'react-router-dom';
import { preloadRoute } from '../../routes/pages';

// <Link> que comeca a descarregar a pagina de destino ao passar o rato, ao
// focar com o teclado ou ao tocar: quando o clique chega, o JS ja esta la.
export default function PrefetchLink({ to, onPointerEnter, onFocus, onTouchStart, ...rest }: LinkProps) {
  const path = typeof to === 'string' ? to : (to.pathname ?? '');
  return (
    <Link
      to={to}
      onPointerEnter={(e) => {
        preloadRoute(path);
        onPointerEnter?.(e);
      }}
      onFocus={(e) => {
        preloadRoute(path);
        onFocus?.(e);
      }}
      onTouchStart={(e) => {
        preloadRoute(path);
        onTouchStart?.(e);
      }}
      {...rest}
    />
  );
}
