import { describe, expect, it } from 'vitest';
import { decide } from '../src/core/decision_engine.js';

describe('DecisionEngine', () => {
  describe('Urgent Safety Detection', () => {
    it('flags chest pain as urgent safety requiring human support', () => {
      const result = decide('I am having severe chest pain right now');
      expect(result.intent).toBe('urgent_safety');
      expect(result.urgency).toBe('urgent');
      expect(result.needsHumanSupport).toBe(true);
      expect(result.reason).toContain('Potential emergency language detected');
    });

    it('flags difficulty breathing as urgent', () => {
      const result = decide("Grandma cannot breathe properly and can't breathe");
      expect(result.intent).toBe('urgent_safety');
      expect(result.urgency).toBe('urgent');
      expect(result.needsHumanSupport).toBe(true);
    });

    it('flags suspected overdose or unconsciousness as urgent', () => {
      const result = decide('Patient is unconscious after taking extra pills');
      expect(result.intent).toBe('urgent_safety');
      expect(result.urgency).toBe('urgent');
      expect(result.needsHumanSupport).toBe(true);
    });

    it('flags severe allergic reactions as urgent', () => {
      const result = decide('He has a severe allergic reaction to the new medication');
      expect(result.intent).toBe('urgent_safety');
      expect(result.urgency).toBe('urgent');
      expect(result.needsHumanSupport).toBe(true);
    });
  });

  describe('Missed Dose Detection', () => {
    it('detects missed dose queries within range', () => {
      const result = decide('I missed my morning blood pressure dose');
      expect(result.intent).toBe('missed_dose');
      expect(result.urgency).toBe('routine');
      expect(result.needsHumanSupport).toBe(true);
    });

    it('detects forgotten medication variations', () => {
      const result = decide('Mom forgot her evening medicine today');
      expect(result.intent).toBe('missed_dose');
      expect(result.urgency).toBe('routine');
      expect(result.needsHumanSupport).toBe(true);
    });

    it('detects late pill queries', () => {
      const result = decide('I am running 3 hours late for my diabetic pill');
      expect(result.intent).toBe('missed_dose');
      expect(result.urgency).toBe('routine');
      expect(result.needsHumanSupport).toBe(true);
    });
  });

  describe('Appointment Coordination Detection', () => {
    it('detects doctor visit queries', () => {
      const result = decide('When is my next doctor appointment?');
      expect(result.intent).toBe('appointment');
      expect(result.urgency).toBe('routine');
      expect(result.needsHumanSupport).toBe(false);
    });

    it('detects clinic visit questions', () => {
      const result = decide('Do we have a clinic visit scheduled for Friday?');
      expect(result.intent).toBe('appointment');
      expect(result.urgency).toBe('routine');
      expect(result.needsHumanSupport).toBe(false);
    });
  });

  describe('General Inquiries', () => {
    it('classifies general care messages appropriately', () => {
      const result = decide('Hello, how can I see my daily routine?');
      expect(result.intent).toBe('general');
      expect(result.urgency).toBe('routine');
      expect(result.needsHumanSupport).toBe(false);
    });

    it('handles ambiguous input gracefully', () => {
      const result = decide('Thank you for helping us with care coordination today.');
      expect(result.intent).toBe('general');
      expect(result.urgency).toBe('routine');
      expect(result.needsHumanSupport).toBe(false);
    });
  });
});
