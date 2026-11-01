import { useState, type FormEvent } from 'react';
import Card from '../UI/Card';
import Input from '../UI/Input';
import Select from '../UI/Select';
import Modal from '../UI/Modal';
import FinanceSubmitButton from './FinanceSubmitButton';
import Money from './Money';
import IconButton from '../UI/IconButton';
import ProgressBar from '../UI/ProgressBar';
import SegmentedControl from '../UI/SegmentedControl';
import { PencilIcon, RefreshIcon, TrashIcon } from '../UI/Icons';
import {
  FINANCE_SYMBOL_MAX_LENGTH,
  type FinanceAccount,
  type FinanceHolding,
  type FinanceHoldingInput,
  type FinanceHoldingUpdate,
} from '../../api/financeService';
import { formatPercent, formatQuantity, formatRelativeTime, parseMoneyInput, parseQuantity } from '../../lib/money';
import type { SubmitOutcome } from '../../lib/idempotency';
import { useIdempotentSubmit } from '../../hooks/useIdempotentSubmit';
import { useI18n } from '../../i18n/useI18n';

type AmountMode = 'invested' | 'quantity';
const FULL_SHARE_PERCENT = 100;
const NO_ACCOUNT = '';

interface HoldingRowProps {
  holding: FinanceHolding;
  currency: string;
  onEdit: (holding: FinanceHolding) => void;
  onRemove: (holding: FinanceHolding) => void;
}

function HoldingRow({ holding, currency, onEdit, onRemove }: HoldingRowProps) {
  const { t, lang } = useI18n();
  const gain = holding.gainCents;
  // valueCents e gainCents vem na moeda da cotacao (USD para AAPL), nao na das definicoes.
  const priceCurrency = holding.priceCurrency ?? currency;
  const label = holding.percentOfFullShare < FULL_SHARE_PERCENT
    ? t('finance.shareOf', { percent: formatPercent(holding.percentOfFullShare, lang), symbol: holding.symbol })
    : t('finance.sharesOwned', { quantity: formatQuantity(holding.quantity, lang), symbol: holding.symbol });

  return (
    <li className="grid grid-cols-2 gap-x-4 gap-y-2 py-3 md:grid-cols-[minmax(0,1.4fr)_repeat(4,minmax(0,1fr))_auto] md:items-center">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-neutral-100">{holding.symbol}</p>
        {holding.name !== holding.symbol && <p className="truncate text-xs text-neutral-500">{holding.name}</p>}
      </div>
      <div>
        <p className="text-xs text-neutral-500 md:hidden">{t('finance.quantity')}</p>
        <p className="text-sm tabular-nums text-neutral-200">{formatQuantity(holding.quantity, lang)}</p>
      </div>
      <div>
        <p className="text-xs text-neutral-500 md:hidden">{t('finance.lastPrice')}</p>
        <p className="text-sm tabular-nums text-neutral-200">
          {holding.lastPriceCents === null ? t('finance.noPrice') : <Money cents={holding.lastPriceCents} currency={priceCurrency} />}
        </p>
      </div>
      <div>
        <p className="text-xs text-neutral-500 md:hidden">{t('finance.value')}</p>
        <p className="text-sm font-medium tabular-nums text-neutral-100">
          {holding.valueCents === null ? t('finance.noPrice') : <Money cents={holding.valueCents} currency={priceCurrency} />}
        </p>
      </div>
      <div>
        <p className="text-xs text-neutral-500 md:hidden">{t('finance.gain')}</p>
        <p className={`text-sm tabular-nums ${gain === null ? 'text-neutral-500' : gain < 0 ? 'text-red-400' : 'text-cyan-400'}`}>
          {gain === null ? t('finance.noPrice') : <Money cents={gain} currency={priceCurrency} prefix={gain < 0 ? '' : '+'} />}
          {holding.gainPercent !== null && <span className="ml-1 text-xs">({formatPercent(holding.gainPercent, lang)})</span>}
        </p>
      </div>
      <div className="flex justify-self-end">
        <IconButton label={t('finance.editHolding')} onClick={() => onEdit(holding)}>
          <PencilIcon className="h-4 w-4" />
        </IconButton>
        <IconButton label={t('finance.deleteHolding')} tone="danger" onClick={() => onRemove(holding)}>
          <TrashIcon className="h-4 w-4" />
        </IconButton>
      </div>
      <div className="col-span-2 md:col-span-6">
        <ProgressBar percent={holding.percentOfFullShare} thickness="md" label={label} />
        <p className="mt-1 flex flex-wrap justify-between gap-x-3 text-xs text-neutral-500">
          <span>{label}</span>
          <span>
            {holding.priceUpdatedAt
              ? t('finance.priceUpdated', { when: formatRelativeTime(holding.priceUpdatedAt, lang) })
              : t('finance.priceNeverUpdated')}
          </span>
        </p>
      </div>
    </li>
  );
}

interface FinanceHoldingsProps {
  holdings: FinanceHolding[];
  accounts: FinanceAccount[];
  currency: string;
  isRefreshing: boolean;
  onRefresh: () => void;
  onAdd: (input: FinanceHoldingInput, key: string) => Promise<SubmitOutcome>;
  onUpdate: (id: string, changes: FinanceHoldingUpdate) => Promise<boolean>;
  onRemove: (holding: FinanceHolding) => void;
}

// Posicoes: simbolo + quantidade (ou valor investido), preco e valor
// atuais (atualizados de hora a hora), ganho e quanto de uma unidade inteira se tem.
export default function FinanceHoldings({ holdings, accounts, currency, isRefreshing, onRefresh, onAdd, onUpdate, onRemove }: FinanceHoldingsProps) {
  const { t } = useI18n();
  const { submit, isSubmitting } = useIdempotentSubmit();
  const [editing, setEditing] = useState<FinanceHolding | null>(null);
  const [symbol, setSymbol] = useState('');
  const [mode, setMode] = useState<AmountMode>('invested');
  const [amount, setAmount] = useState('');
  const [accountId, setAccountId] = useState(NO_ACCOUNT);
  const [formError, setFormError] = useState('');
  const investmentAccounts = accounts.filter((a) => a.type === 'INVESTMENT' || a.type === 'CRYPTO');

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const cleanSymbol = symbol.trim().toUpperCase();
    const parsed = mode === 'invested' ? parseMoneyInput(amount) : parseQuantity(amount);
    if (!cleanSymbol || parsed === null || (mode === 'invested' && Number(parsed) <= 0)) {
      setFormError(t(mode === 'invested' ? 'finance.invalidHoldingInvested' : 'finance.invalidHoldingQuantity'));
      return;
    }
    setFormError('');
    const input: FinanceHoldingInput = {
      symbol: cleanSymbol,
      accountId: accountId || null,
      ...(mode === 'invested' ? { investedCents: parsed as number } : { quantity: parsed as string }),
    };
    if (await submit((key) => onAdd(input, key))) {
      setSymbol('');
      setAmount('');
    }
  };

  return (
    <Card className="mb-6">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-neutral-200">{t('finance.holdings')}</h3>
        <button
          type="button"
          onClick={onRefresh}
          disabled={isRefreshing || holdings.length === 0}
          className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-700 px-3 py-1.5 text-sm text-neutral-200 hover:border-neutral-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RefreshIcon className={`h-4 w-4 ${isRefreshing ? 'animate-spin motion-reduce:animate-none' : ''}`} />
          {isRefreshing ? t('finance.refreshing') : t('finance.refreshPrices')}
        </button>
      </div>
      <p className="mb-3 text-xs text-neutral-500">{t('finance.holdingsHelp')}</p>

      {holdings.length === 0 ? (
        <p className="mb-4 text-sm text-neutral-500">{t('finance.noHoldings')}</p>
      ) : (
        <>
          <div className="hidden grid-cols-[minmax(0,1.4fr)_repeat(4,minmax(0,1fr))_auto] gap-x-4 border-b border-neutral-800 pb-2 text-xs text-neutral-500 md:grid" aria-hidden="true">
            <span>{t('finance.symbol')}</span>
            <span>{t('finance.quantity')}</span>
            <span>{t('finance.lastPrice')}</span>
            <span>{t('finance.value')}</span>
            <span>{t('finance.gain')}</span>
            <span className="w-8" />
          </div>
          <ul className="mb-4 divide-y divide-neutral-800">
            {holdings.map((holding) => (
              <HoldingRow key={holding.id} holding={holding} currency={currency} onEdit={setEditing} onRemove={onRemove} />
            ))}
          </ul>
        </>
      )}

      <form id="finance-holding-form" onSubmit={(e) => void handleSubmit(e)} className="space-y-3">
        <SegmentedControl
          options={[
            { value: 'invested', label: t('finance.modeInvested') },
            { value: 'quantity', label: t('finance.modeQuantity') },
          ]}
          value={mode}
          onChange={(next) => {
            setMode(next);
            setAmount('');
          }}
          size="sm"
        />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Input
            id="finance-holding-symbol"
            label={t('finance.symbol')}
            placeholder="VWCE.DE"
            maxLength={FINANCE_SYMBOL_MAX_LENGTH}
            autoCapitalize="characters"
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
          />
          <Input
            label={mode === 'invested' ? t('finance.amountInvested') : t('finance.quantity')}
            inputMode="decimal"
            placeholder={mode === 'invested' ? '0.00' : '0.000000'}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <Select label={t('finance.account')} value={accountId} onChange={(e) => setAccountId(e.target.value)}>
            <option value={NO_ACCOUNT}>{t('finance.noAccount')}</option>
            {investmentAccounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
        </div>
        <p className="text-xs text-neutral-500">{t('finance.holdingFormHelp')}</p>
        <div className="flex flex-wrap items-center gap-3">
          <FinanceSubmitButton isSubmitting={isSubmitting}>{t('finance.addHolding')}</FinanceSubmitButton>
          {formError && <p className="text-sm text-red-400">{formError}</p>}
        </div>
      </form>

      <Modal isOpen={editing !== null} onClose={() => setEditing(null)} title={t('finance.editHolding')}>
        {editing && <HoldingEditForm holding={editing} accounts={investmentAccounts} onSubmit={(changes) => onUpdate(editing.id, changes)} onDone={() => setEditing(null)} />}
      </Modal>
    </Card>
  );
}

interface HoldingEditFormProps {
  holding: FinanceHolding;
  accounts: FinanceAccount[];
  onSubmit: (changes: FinanceHoldingUpdate) => Promise<boolean>;
  onDone: () => void;
}

// Editar uma posicao: quantidade OU valor investido (nunca os dois) e conta.
function HoldingEditForm({ holding, accounts, onSubmit, onDone }: HoldingEditFormProps) {
  const { t } = useI18n();
  const { submit, isSubmitting } = useIdempotentSubmit();
  const [mode, setMode] = useState<AmountMode>('quantity');
  const [amount, setAmount] = useState(holding.quantity);
  const [accountId, setAccountId] = useState(holding.accountId ?? NO_ACCOUNT);
  const [formError, setFormError] = useState('');

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const parsed = mode === 'invested' ? parseMoneyInput(amount) : parseQuantity(amount);
    if (parsed === null || (mode === 'invested' && Number(parsed) <= 0)) {
      setFormError(t(mode === 'invested' ? 'finance.invalidHoldingInvested' : 'finance.invalidHoldingQuantity'));
      return;
    }
    setFormError('');
    const changes: FinanceHoldingUpdate = {
      accountId: accountId || null,
      ...(mode === 'invested' ? { investedCents: parsed as number } : { quantity: parsed as string }),
    };
    if (await submit(() => onSubmit(changes))) onDone();
  };

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="space-y-3">
      <p className="text-sm text-neutral-300">{holding.symbol}</p>
      <SegmentedControl
        options={[
          { value: 'quantity', label: t('finance.modeQuantity') },
          { value: 'invested', label: t('finance.modeInvested') },
        ]}
        value={mode}
        onChange={(next) => {
          setMode(next);
          setAmount(next === 'quantity' ? holding.quantity : '');
        }}
        size="sm"
      />
      <Input
        label={mode === 'invested' ? t('finance.amountInvested') : t('finance.quantity')}
        inputMode="decimal"
        placeholder={mode === 'invested' ? '0.00' : '0.000000'}
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
      />
      <Select label={t('finance.account')} value={accountId} onChange={(e) => setAccountId(e.target.value)}>
        <option value={NO_ACCOUNT}>{t('finance.noAccount')}</option>
        {accounts.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name}
          </option>
        ))}
      </Select>
      <div className="flex flex-wrap items-center gap-3">
        <FinanceSubmitButton isSubmitting={isSubmitting}>{t('finance.save')}</FinanceSubmitButton>
        <button type="button" onClick={onDone} className="px-3 py-2 text-sm text-neutral-400 hover:text-white">
          {t('common.cancel')}
        </button>
        {formError && <p className="text-sm text-red-400">{formError}</p>}
      </div>
    </form>
  );
}
