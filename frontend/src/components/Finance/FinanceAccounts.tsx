import { useState, type FormEvent } from 'react';
import Card from '../UI/Card';
import Input from '../UI/Input';
import Select from '../UI/Select';
import FinanceSubmitButton from './FinanceSubmitButton';
import Money from './Money';
import IconButton from '../UI/IconButton';
import { PencilIcon, TrashIcon } from '../UI/Icons';
import {
  FINANCE_ACCOUNT_NAME_MAX_LENGTH,
  FINANCE_ACCOUNT_TYPES,
  type FinanceAccount,
  type FinanceAccountInput,
  type FinanceAccountType,
} from '../../api/financeService';
import { centsToInput, parseMoneyInput } from '../../lib/money';
import type { SubmitOutcome } from '../../lib/idempotency';
import { useIdempotentSubmit } from '../../hooks/useIdempotentSubmit';
import { usePrivateInputClass } from '../../hooks/usePrivacyMode';
import { useI18n } from '../../i18n/useI18n';

interface AccountFormProps {
  initial?: FinanceAccount;
  /** `key` e a Idempotency-Key da tentativa (ignorada ao editar). */
  onSubmit: (input: FinanceAccountInput, key: string) => Promise<SubmitOutcome>;
  onCancel?: () => void;
}

// Formulario unico para criar e editar uma conta.
function AccountForm({ initial, onSubmit, onCancel }: AccountFormProps) {
  const { t } = useI18n();
  const { submit, isSubmitting } = useIdempotentSubmit();
  const privateInput = usePrivateInputClass();
  const [name, setName] = useState(initial?.name ?? '');
  const [type, setType] = useState<FinanceAccountType>(initial?.type ?? 'BANK');
  const [balance, setBalance] = useState(initial ? centsToInput(initial.balanceCents) : '');
  const [formError, setFormError] = useState('');

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const balanceCents = parseMoneyInput(balance || '0');
    if (!name.trim() || balanceCents === null) {
      setFormError(t('finance.invalidAccount'));
      return;
    }
    setFormError('');
    if (await submit((key) => onSubmit({ name: name.trim(), type, balanceCents }, key))) {
      if (!initial) {
        setName('');
        setBalance('');
      }
      onCancel?.();
    }
  };

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Input label={t('finance.accountName')} maxLength={FINANCE_ACCOUNT_NAME_MAX_LENGTH} value={name} onChange={(e) => setName(e.target.value)} />
        <Select label={t('finance.accountType')} value={type} onChange={(e) => setType(e.target.value as FinanceAccountType)}>
          {FINANCE_ACCOUNT_TYPES.map((value) => (
            <option key={value} value={value}>
              {t(`finance.bucket.${value}`)}
            </option>
          ))}
        </Select>
        <Input className={privateInput} label={t('finance.accountBalance')} inputMode="decimal" placeholder="0.00" value={balance} onChange={(e) => setBalance(e.target.value)} />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <FinanceSubmitButton isSubmitting={isSubmitting}>{initial ? t('finance.save') : t('finance.addAccount')}</FinanceSubmitButton>
        {onCancel && (
          <button type="button" onClick={onCancel} className="px-3 py-2 text-sm text-neutral-400 hover:text-white">
            {t('common.cancel')}
          </button>
        )}
        {formError && <p className="text-sm text-red-400">{formError}</p>}
      </div>
    </form>
  );
}

interface FinanceAccountsProps {
  accounts: FinanceAccount[];
  currency: string;
  onAdd: (input: FinanceAccountInput, key: string) => Promise<SubmitOutcome>;
  onUpdate: (id: string, changes: Partial<FinanceAccountInput>) => Promise<boolean>;
  onRemove: (account: FinanceAccount) => void;
}

// Contas escritas a mao (banco, dia a dia, corretora, cripto, dinheiro vivo).
// O saldo de uma conta so muda quando a pessoa o edita aqui.
export default function FinanceAccounts({ accounts, currency, onAdd, onUpdate, onRemove }: FinanceAccountsProps) {
  const { t } = useI18n();
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <Card className="mb-6">
      <h3 className="mb-1 text-sm font-semibold text-neutral-200">{t('finance.accounts')}</h3>
      <p className="mb-3 text-xs text-neutral-500">{t('finance.accountsHelp')}</p>
      {accounts.length === 0 ? (
        <p className="mb-3 text-sm text-neutral-500">{t('finance.noAccounts')}</p>
      ) : (
        <ul className="mb-4 divide-y divide-neutral-800">
          {accounts.map((account) =>
            editingId === account.id ? (
              <li key={account.id} className="py-3">
                <AccountForm initial={account} onSubmit={(input) => onUpdate(account.id, input)} onCancel={() => setEditingId(null)} />
              </li>
            ) : (
              <li key={account.id} className="flex items-center gap-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-neutral-200">{account.name}</p>
                  <p className="text-xs text-neutral-500">{t(`finance.bucket.${account.type}`)}</p>
                </div>
                <Money
                  cents={account.balanceCents}
                  currency={account.currency ?? currency}
                  className={`text-sm font-medium tabular-nums ${account.balanceCents < 0 ? 'text-red-400' : 'text-neutral-200'}`}
                />
                <IconButton label={t('finance.editAccount')} onClick={() => setEditingId(account.id)}>
                  <PencilIcon className="h-4 w-4" />
                </IconButton>
                <IconButton label={t('finance.deleteAccount')} tone="danger" onClick={() => onRemove(account)}>
                  <TrashIcon className="h-4 w-4" />
                </IconButton>
              </li>
            ),
          )}
        </ul>
      )}
      <AccountForm onSubmit={onAdd} />
    </Card>
  );
}
