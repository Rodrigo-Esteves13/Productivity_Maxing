// Estado dos blocos de salario e de dinheiro em divida do formulario de entradas.
import type { FinanceInterestKind } from '../api/financeService';

export interface SalaryState {
  received: 'yes' | 'no';
  arrearsOn: boolean;
  arrearsMonths: number;
  withheldOn: boolean;
  withheld: string;
}

export const DEFAULT_SALARY: SalaryState = { received: 'no', arrearsOn: false, arrearsMonths: 1, withheldOn: false, withheld: '' };

export interface OwedState {
  on: boolean;
  debtor: string;
  expectedDate: string;
  riskPct: number;
  rate: string;
  interestKind: FinanceInterestKind;
}

export const DEFAULT_OWED: OwedState = { on: false, debtor: '', expectedDate: '', riskPct: 0, rate: '', interestKind: 'SIMPLE' };

