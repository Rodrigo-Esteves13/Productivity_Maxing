import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

const OFF_VALUE = 'off';

// ?<nome>=on / ?<nome>=off (paleta Ctrl+K) liga ou desliga um modo e sai do
// URL, para nao lutar com o botao depois. `apply` tem de ser estavel.
export function useOnOffSearchParam(name: string, apply: (isOn: boolean) => void) {
  const [searchParams, setSearchParams] = useSearchParams();
  const value = searchParams.get(name);

  useEffect(() => {
    if (value === null) return;
    apply(value !== OFF_VALUE);
    setSearchParams(
      (params) => {
        params.delete(name);
        return params;
      },
      { replace: true },
    );
  }, [value, name, apply, setSearchParams]);
}
