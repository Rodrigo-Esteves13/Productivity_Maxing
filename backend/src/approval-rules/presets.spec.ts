import {
  APPROVAL_PRESETS,
  APPROVAL_PRESET_KEYS,
  PRESET_GENERIC,
  PRESET_PT_PT_ISMAI,
  genericRulesForScale,
  isApprovalPresetKey,
  presetRules,
} from './presets';

describe('approval presets', () => {
  it('pt-PT-ismai: 0-20, passa com 10 arredondado, regras extra e pistas', () => {
    expect(APPROVAL_PRESETS[PRESET_PT_PT_ISMAI]).toEqual({
      presetKey: 'pt-PT-ismai',
      scaleMin: 0,
      scaleMax: 20,
      passMark: 10,
      rounding: 'UP_TO_INTEGER_AT_HALF',
      componentMinGrade: 6,
      secondThreshold: 8,
      maxBelowSecondThreshold: 1,
      hasExamTrack: true,
      hasResitTrack: true,
    });
  });

  it('generic: meio da escala, sem regras extra nem pistas', () => {
    expect(APPROVAL_PRESETS[PRESET_GENERIC]).toEqual({
      presetKey: 'generic',
      scaleMin: 0,
      scaleMax: 20,
      passMark: 10,
      rounding: 'NONE',
      componentMinGrade: null,
      secondThreshold: null,
      maxBelowSecondThreshold: null,
      hasExamTrack: false,
      hasResitTrack: false,
    });
  });

  it('generic acompanha a escala', () => {
    expect(genericRulesForScale(0, 100).passMark).toBe(50);
    expect(genericRulesForScale(1, 5).passMark).toBe(3);
  });

  it('generic arredonda a nota final se roundFinalGrade for true', () => {
    expect(genericRulesForScale(0, 20).rounding).toBe('NONE');
    expect(genericRulesForScale(0, 20, false).rounding).toBe('NONE');
    expect(genericRulesForScale(0, 20, true).rounding).toBe(
      'UP_TO_INTEGER_AT_HALF',
    );
  });

  it('lista de chaves e guarda de tipo', () => {
    expect([...APPROVAL_PRESET_KEYS]).toEqual(['pt-PT-ismai', 'generic']);
    expect(isApprovalPresetKey('generic')).toBe(true);
    expect(isApprovalPresetKey('harvard')).toBe(false);
    expect(isApprovalPresetKey(3)).toBe(false);
  });

  it('presets sao imutaveis e presetRules devolve copia', () => {
    expect(Object.isFrozen(APPROVAL_PRESETS[PRESET_PT_PT_ISMAI])).toBe(true);
    const copy = presetRules(PRESET_PT_PT_ISMAI);
    copy.passMark = 12;
    expect(APPROVAL_PRESETS[PRESET_PT_PT_ISMAI].passMark).toBe(10);
  });
});
