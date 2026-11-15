import React, { useState } from 'react';
import { Modal } from '../common/Modal.js';
import { useCare } from '../../context/CareContext.js';
import { medicationInputSchema, type MedicationInput } from '@sanjeevani/shared/schemas/medication';

export interface MedicationModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
}

/** Base foundation modal for adding a new medication schedule. */
export function MedicationModal({ isOpen, onClose }: MedicationModalProps): React.JSX.Element {
  const { addMedication } = useCare();
  const [name, setName] = useState('');
  const [dosage, setDosage] = useState('');
  const [time, setTime] = useState('08:00');
  const [frequencyType, setFrequencyType] = useState<'daily' | 'weekdays' | 'interval'>('daily');
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    const inputData: MedicationInput = {
      name: name.trim(),
      dosage: dosage.trim(),
      times: [time],
      frequency: frequencyType === 'daily'
        ? { type: 'daily' }
        : frequencyType === 'weekdays'
          ? { type: 'weekdays', days: [1, 2, 3, 4, 5] }
          : { type: 'interval', everyNDays: 2 },
      startDate,
      endDate: null,
      notes: notes.trim(),
      active: true,
    };

    const parsed = medicationInputSchema.safeParse(inputData);
    if (!parsed.success) {
      setValidationError(parsed.error.issues[0]?.message ?? 'Please check medication details.');
      return;
    }

    try {
      setIsSubmitting(true);
      await addMedication(parsed.data);
      setName('');
      setDosage('');
      setNotes('');
      onClose();
    } catch (err) {
      setValidationError(err instanceof Error ? err.message : 'Failed to save medication.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add Medication Schedule">
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {validationError && (
          <div
            style={{
              padding: '12px',
              borderRadius: '10px',
              backgroundColor: '#fee2e2',
              color: '#991b1b',
              fontSize: '14px',
              fontWeight: 600,
            }}
            role="alert"
          >
            {validationError}
          </div>
        )}

        <div>
          <label htmlFor="med-name" style={{ display: 'block', fontWeight: 650, color: '#16463e', marginBottom: '6px' }}>
            Medication Name *
          </label>
          <input
            id="med-name"
            type="text"
            className="chat-input"
            style={{ width: '100%' }}
            placeholder="e.g. Amlodipine, Metformin, Telmisartan"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div>
            <label htmlFor="med-dosage" style={{ display: 'block', fontWeight: 650, color: '#16463e', marginBottom: '6px' }}>
              Dosage *
            </label>
            <input
              id="med-dosage"
              type="text"
              className="chat-input"
              style={{ width: '100%' }}
              placeholder="e.g. 5 mg, 500 mg tablet"
              value={dosage}
              onChange={(e) => setDosage(e.target.value)}
              required
            />
          </div>
          <div>
            <label htmlFor="med-time" style={{ display: 'block', fontWeight: 650, color: '#16463e', marginBottom: '6px' }}>
              Schedule Time (24h) *
            </label>
            <input
              id="med-time"
              type="time"
              className="chat-input"
              style={{ width: '100%' }}
              value={time}
              onChange={(e) => setTime(e.target.value)}
              required
            />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div>
            <label htmlFor="med-freq" style={{ display: 'block', fontWeight: 650, color: '#16463e', marginBottom: '6px' }}>
              Frequency
            </label>
            <select
              id="med-freq"
              className="chat-input"
              style={{ width: '100%', cursor: 'pointer' }}
              value={frequencyType}
              onChange={(e) => setFrequencyType(e.target.value as 'daily' | 'weekdays' | 'interval')}
            >
              <option value="daily">Every Day</option>
              <option value="weekdays">Weekdays Only (Mon-Fri)</option>
              <option value="interval">Alternate Days (Every 2 days)</option>
            </select>
          </div>
          <div>
            <label htmlFor="med-start" style={{ display: 'block', fontWeight: 650, color: '#16463e', marginBottom: '6px' }}>
              Start Date
            </label>
            <input
              id="med-start"
              type="date"
              className="chat-input"
              style={{ width: '100%' }}
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
            />
          </div>
        </div>

        <div>
          <label htmlFor="med-notes" style={{ display: 'block', fontWeight: 650, color: '#16463e', marginBottom: '6px' }}>
            Care Instructions / Notes
          </label>
          <textarea
            id="med-notes"
            className="chat-input"
            style={{ width: '100%', minHeight: '70px', resize: 'vertical' }}
            placeholder="e.g. Take immediately after breakfast with a full glass of warm water."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
          <button
            type="button"
            className="btn-skip"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="send-button"
            disabled={isSubmitting || !name.trim() || !dosage.trim()}
          >
            {isSubmitting ? 'Saving...' : 'Save Medication'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
