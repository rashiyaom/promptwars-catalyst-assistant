/**
 * Polypharmacy and Drug-Drug Interaction (DDI) Safety Engine.
 * Implements geriatric pharmacological safety guidelines (Beers Criteria)
 * to protect older adults from adverse drug reactions.
 */

export type InteractionSeverity = 'critical' | 'moderate' | 'caution';

export interface DrugInteraction {
  readonly drugs: readonly [string, string];
  readonly severity: InteractionSeverity;
  readonly description: string;
  readonly clinicalGuidance: string;
}

export interface DrugInteractionReport {
  readonly hasInteractions: boolean;
  readonly hasCritical: boolean;
  readonly interactions: readonly DrugInteraction[];
  readonly totalChecked: number;
}

interface InteractionRule {
  readonly drugA: RegExp;
  readonly drugB: RegExp;
  readonly severity: InteractionSeverity;
  readonly description: string;
  readonly clinicalGuidance: string;
}

const GERIATRIC_INTERACTION_RULES: readonly InteractionRule[] = [
  {
    drugA: /aspirin|ecosprin/i,
    drugB: /ibuprofen|naproxen|diclofenac|aceclofenac|combiflam/i,
    severity: 'critical',
    description: 'Combining Aspirin with NSAIDs substantially elevates gastrointestinal bleeding risk and blunts antiplatelet protection.',
    clinicalGuidance: 'Consult physician. Consider gastroprotective agents (e.g. Pantoprazole) or non-NSAID analgesia for older adults.',
  },
  {
    drugA: /warfarin|coumadin/i,
    drugB: /aspirin|ecosprin|ibuprofen|diclofenac/i,
    severity: 'critical',
    description: 'Concurrent anticoagulant and antiplatelet/NSAID therapy creates severe major hemorrhage danger in geriatric patients.',
    clinicalGuidance: 'Immediate clinician review required. Strict INR monitoring and clear indication needed.',
  },
  {
    drugA: /amlodipine|norvasc/i,
    drugB: /simvastatin|zocor/i,
    severity: 'moderate',
    description: 'Amlodipine increases serum simvastatin concentrations, raising the risk of myopathy and rhabdomyolysis.',
    clinicalGuidance: 'Simvastatin daily dose should generally not exceed 20 mg when co-administered with amlodipine.',
  },
  {
    drugA: /metformin|glycomet/i,
    drugB: /furosemide|lasix/i,
    severity: 'caution',
    description: 'Furosemide may increase metformin blood levels and alter renal excretion.',
    clinicalGuidance: 'Monitor renal function (eGFR) and blood glucose levels regularly.',
  },
  {
    drugA: /telmisartan|losartan|enalapril|ramipril/i,
    drugB: /spironolactone|aldactone|potassium/i,
    severity: 'moderate',
    description: 'RAAS inhibitors combined with potassium-sparing diuretics significantly elevate hyperkalemia danger in older adults.',
    clinicalGuidance: 'Monitor serum potassium and creatinine within 1-2 weeks of concurrent therapy.',
  },
  {
    drugA: /paracetamol|crocin|dolo|calpol/i,
    drugB: /paracetamol|crocin|dolo|calpol/i,
    severity: 'critical',
    description: 'Duplicate acetaminophen/paracetamol therapy detected. Daily doses over 2,000–3,000 mg cause severe hepatotoxicity.',
    clinicalGuidance: 'Do not combine multiple paracetamol-containing brands. Check all cold/fever medications.',
  },
];

/**
 * Analyze an array of medications for dangerous drug-drug interactions.
 *
 * @param medications - List of medications currently taken or being prescribed
 * @returns Detailed interaction report with severity and clinical guidance
 */
export function checkDrugInteractions(
  medications: ReadonlyArray<{ readonly name: string; readonly dosage?: string }>,
): DrugInteractionReport {
  const found: DrugInteraction[] = [];
  const count = medications.length;

  for (let i = 0; i < count; i++) {
    for (let j = i + 1; j < count; j++) {
      const medA = medications[i];
      const medB = medications[j];

      for (const rule of GERIATRIC_INTERACTION_RULES) {
        const matchesForward = rule.drugA.test(medA.name) && rule.drugB.test(medB.name);
        const matchesReverse = rule.drugA.test(medB.name) && rule.drugB.test(medA.name);

        if (matchesForward || matchesReverse) {
          found.push({
            drugs: [medA.name, medB.name],
            severity: rule.severity,
            description: rule.description,
            clinicalGuidance: rule.clinicalGuidance,
          });
        }
      }
    }
  }

  return {
    hasInteractions: found.length > 0,
    hasCritical: found.some((item) => item.severity === 'critical'),
    interactions: found,
    totalChecked: count,
  };
}
