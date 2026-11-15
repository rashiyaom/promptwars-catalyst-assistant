import { describe, expect, it } from 'vitest';
import { checkDrugInteractions } from '../src/core/drug_interactions.js';

describe('Geriatric Polypharmacy & Drug-Drug Interaction Safety Engine', () => {
  it('detects no interactions in clean regimens', () => {
    const cleanRegimen = [
      { name: 'Metformin 500mg' },
      { name: 'Atorvastatin 10mg' },
      { name: 'Vitamin B12' },
    ];
    const report = checkDrugInteractions(cleanRegimen);
    expect(report.hasInteractions).toBe(false);
    expect(report.hasCritical).toBe(false);
    expect(report.interactions).toHaveLength(0);
    expect(report.totalChecked).toBe(3);
  });

  it('flags critical Aspirin + NSAID interaction', () => {
    const regimen = [{ name: 'Ecosprin 75mg' }, { name: 'Combiflam (Ibuprofen + Paracetamol)' }];
    const report = checkDrugInteractions(regimen);
    expect(report.hasInteractions).toBe(true);
    expect(report.hasCritical).toBe(true);
    const aspirinNsaid = report.interactions.find((i) => i.severity === 'critical');
    expect(aspirinNsaid).toBeDefined();
    expect(aspirinNsaid?.description).toMatch(/bleeding/i);
    expect(aspirinNsaid?.clinicalGuidance).toMatch(/physician/i);
  });

  it('flags critical Warfarin + Aspirin interaction', () => {
    const regimen = [{ name: 'Warfarin 2mg' }, { name: 'Aspirin 81mg' }];
    const report = checkDrugInteractions(regimen);
    expect(report.hasInteractions).toBe(true);
    expect(report.hasCritical).toBe(true);
    const warf = report.interactions.find((i) => i.severity === 'critical');
    expect(warf).toBeDefined();
    expect(warf?.description).toMatch(/hemorrhage/i);
  });

  it('flags moderate Amlodipine + Simvastatin interaction', () => {
    const regimen = [{ name: 'Amlodipine 5mg' }, { name: 'Simvastatin 40mg' }];
    const report = checkDrugInteractions(regimen);
    expect(report.hasInteractions).toBe(true);
    expect(report.hasCritical).toBe(false);
    const statin = report.interactions.find((i) => i.severity === 'moderate');
    expect(statin).toBeDefined();
    expect(statin?.description).toMatch(/myopathy/i);
  });

  it('flags caution Metformin + Furosemide interaction', () => {
    const regimen = [{ name: 'Glycomet 500' }, { name: 'Lasix 40mg' }];
    const report = checkDrugInteractions(regimen);
    expect(report.hasInteractions).toBe(true);
    expect(report.hasCritical).toBe(false);
    const furo = report.interactions.find((i) => i.severity === 'caution');
    expect(furo).toBeDefined();
    expect(furo?.clinicalGuidance).toMatch(/eGFR/i);
  });

  it('detects duplicate Paracetamol therapy across brand names', () => {
    const regimen = [{ name: 'Dolo 650' }, { name: 'Crocin Advance 500mg' }];
    const report = checkDrugInteractions(regimen);
    expect(report.hasInteractions).toBe(true);
    expect(report.hasCritical).toBe(true);
    const dup = report.interactions.find((i) => i.severity === 'critical');
    expect(dup).toBeDefined();
    expect(dup?.description).toMatch(/Duplicate acetaminophen/i);
  });
});
