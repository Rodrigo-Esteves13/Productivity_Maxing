// src/api/approvalRulesService.ts
import api from './client';
import type { ApprovalRules, ApprovalRulesScope } from '../lib/approvalRules';

const SCOPE_PATH: Record<ApprovalRulesScope, string> = {
  program: '/approval-rules/programs',
  area: '/approval-rules/areas',
};

export interface ApprovalRulesPreset {
  key: string;
  rules: ApprovalRules;
}

// Tolera o servidor devolver as regras diretamente ou embrulhadas em { rules }.
type MaybeWrapped<T> = T | { rules: T };

function unwrap<T>(value: MaybeWrapped<T>): T {
  return value && typeof value === 'object' && 'rules' in value
    ? (value as { rules: T }).rules
    : (value as T);
}

export const getApprovalPresets = async (): Promise<ApprovalRulesPreset[]> => {
  const response = await api.get<Array<MaybeWrapped<ApprovalRules> & { key?: string }>>(
    '/approval-rules/presets',
  );
  return response.data.map((item) => {
    const rules = unwrap<ApprovalRules>(item);
    const key = item.key ?? rules.presetKey ?? '';
    return { key, rules: { ...rules, presetKey: key } };
  });
};

export const getApprovalRules = async (
  scope: ApprovalRulesScope,
  id: string,
): Promise<ApprovalRules> => {
  const response = await api.get<MaybeWrapped<ApprovalRules>>(`${SCOPE_PATH[scope]}/${id}`);
  return unwrap(response.data);
};

export const saveApprovalRules = async (
  scope: ApprovalRulesScope,
  id: string,
  rules: ApprovalRules,
): Promise<ApprovalRules> => {
  const response = await api.put<MaybeWrapped<ApprovalRules>>(`${SCOPE_PATH[scope]}/${id}`, rules);
  return unwrap(response.data);
};

/** Programa: volta ao preset generico. Cadeira: remove o override. */
export const resetApprovalRules = async (scope: ApprovalRulesScope, id: string): Promise<void> => {
  await api.delete(`${SCOPE_PATH[scope]}/${id}`);
};
