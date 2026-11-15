import { useLanguage } from '../../i18n/LanguageContext.js';
import React, { useState } from 'react';
import type { Medication } from '@sanjeevani/shared/types/medication';
import { medicationInputSchema, type MedicationInput } from '@sanjeevani/shared/schemas/medication';
import { Modal } from '../common/Modal.js';
import { useCare } from '../../context/CareContext.js';

interface MedicationModalProps {
  readonly onClose: () => void;
  readonly medication?: Medication;
}

/** Shared create/edit form; callers mount a fresh instance for each editing session. */
export function MedicationModal({ onClose, medication }: MedicationModalProps): React.JSX.Element {
  const { t, language } = useLanguage();
  const { addMedication, updateMedication, today } = useCare();
  const [name, setName] = useState(medication?.name ?? '');
  const [dosage, setDosage] = useState(medication?.dosage ?? '');
  const [times, setTimes] = useState<string[]>([...(medication?.times ?? ['08:00'])]);
  const [frequencyType, setFrequencyType] = useState<MedicationInput['frequency']['type']>(
    medication?.frequency.type ?? 'daily',
  );
  const [days, setDays] = useState<number[]>(
    medication?.frequency.type === 'weekdays'
      ? [...(medication.frequency.days ?? [1, 2, 3, 4, 5])]
      : [1, 2, 3, 4, 5],
  );
  const [interval, setInterval] = useState(
    medication?.frequency.type === 'interval' ? medication.frequency.everyNDays : 2,
  );
  const [startDate, setStartDate] = useState(medication?.startDate ?? today);
  const [endDate, setEndDate] = useState(medication?.endDate ?? '');
  const [imageUrl, setImageUrl] = useState(medication?.imageUrl ?? '');
  const [notes, setNotes] = useState(medication?.notes ?? '');
  const [active, setActive] = useState(medication?.active ?? true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    const parsed = medicationInputSchema.safeParse({
      name,
      dosage,
      times: [...new Set(times)].sort(),
      frequency:
        frequencyType === 'daily'
          ? { type: 'daily' }
          : frequencyType === 'weekdays'
            ? { type: 'weekdays', days }
            : { type: 'interval', everyNDays: interval },
      startDate,
      endDate: endDate || null,
      notes,
      active,
      imageUrl,
    });
    if (!parsed.success) {
      setError(
        (language === 'en' ? parsed.error.issues[0]?.message : undefined) ??
          t('Check your schedule.'),
      );
      return;
    }
    if (endDate && endDate < startDate) {
      setError(t('End date must be on or after the start date.'));
      return;
    }
    setBusy(true);
    try {
      if (medication) await updateMedication(medication.id, parsed.data);
      else await addMedication(parsed.data);
      onClose();
    } catch (err) {
      setError(
        language === 'en' && err instanceof Error
          ? err.message
          : t('Could not save medication. Please retry.'),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={medication ? t('Edit Medication Schedule') : t('Add Medication Schedule')}
      dismissible={!busy}
    >
      <form className="care-form" onSubmit={submit} aria-busy={busy}>
        {error && (
          <p className="error-message" role="alert">
            {error}
          </p>
        )}
        <label htmlFor="med-name">
          {t('Medication name')}
          <input
            id="med-name"
            required
            maxLength={120}
            value={name}
            onChange={(e) => {
              setName(e.target.value);
            }}
          />
        </label>
        <label htmlFor="med-dosage">
          {t('Prescribed dosage')}
          <input
            id="med-dosage"
            required
            maxLength={80}
            value={dosage}
            onChange={(e) => {
              setDosage(e.target.value);
            }}
          />
        </label>
        <fieldset>
          <legend>{t('Daily dose times (profile timezone)')}</legend>
          {times.map((time, index) => (
            <div className="form-row" key={index}>
              <label htmlFor={`med-time-${index}`}>
                {t('Time')} {index + 1}
                <input
                  id={`med-time-${index}`}
                  type="time"
                  required
                  value={time}
                  onChange={(e) => {
                    setTimes(times.map((value, i) => (i === index ? e.target.value : value)));
                  }}
                />
              </label>
              <button
                className="btn-skip"
                type="button"
                disabled={times.length === 1}
                aria-label={t('Remove time {0}', index + 1)}
                onClick={() => {
                  setTimes(times.filter((_, i) => i !== index));
                }}
              >
                {t('Remove')}
              </button>
            </div>
          ))}
          <button
            className="chip"
            type="button"
            disabled={times.length >= 12}
            onClick={() => {
              setTimes([...times, '20:00']);
            }}
          >
            {t('+ Add dose time')}
          </button>
        </fieldset>
        <label htmlFor="med-freq">
          {t('Frequency')}
          <select
            id="med-freq"
            value={frequencyType}
            onChange={(e) => {
              setFrequencyType(e.target.value as MedicationInput['frequency']['type']);
            }}
          >
            <option value="daily">{t('Every day')}</option>
            <option value="weekdays">{t('Selected weekdays')}</option>
            <option value="interval">{t('Every N days')}</option>
          </select>
        </label>
        {frequencyType === 'weekdays' && (
          <fieldset>
            <legend>{t('Days of the week')}</legend>
            <div className="weekday-options">
              {[t('Sun'), t('Mon'), t('Tue'), t('Wed'), t('Thu'), t('Fri'), t('Sat')].map(
                (day, index) => (
                  <label key={day}>
                    <input
                      type="checkbox"
                      checked={days.includes(index)}
                      onChange={(e) => {
                        setDays(
                          e.target.checked
                            ? [...days, index]
                            : days.filter((value) => value !== index),
                        );
                      }}
                    />
                    {day}
                  </label>
                ),
              )}
            </div>
          </fieldset>
        )}
        {frequencyType === 'interval' && (
          <label htmlFor="med-interval">
            {t('Days between doses')}
            <input
              id="med-interval"
              type="number"
              min={1}
              max={365}
              required
              value={interval}
              onChange={(e) => {
                setInterval(Number(e.target.value));
              }}
            />
          </label>
        )}
        <div className="form-grid">
          <label htmlFor="med-start">
            {t('Start date')}
            <input
              id="med-start"
              type="date"
              required
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
              }}
            />
          </label>
          <label htmlFor="med-end">
            {t('End date (optional)')}
            <input
              id="med-end"
              type="date"
              min={startDate}
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
              }}
            />
          </label>
        </div>
        <label htmlFor="med-notes">
          {t('Care instructions')}
          <textarea
            id="med-notes"
            maxLength={500}
            value={notes}
            onChange={(e) => {
              setNotes(e.target.value);
            }}
          />
        </label>
        <label htmlFor="med-photo">
          {t('Medicine package photo URL (optional, HTTPS)')}
          <input
            id="med-photo"
            type="url"
            value={imageUrl}
            onChange={(e) => {
              setImageUrl(e.target.value);
            }}
            placeholder="https://…"
          />
        </label>
        <label className="check-label">
          <input
            type="checkbox"
            checked={active}
            onChange={(e) => {
              setActive(e.target.checked);
            }}
          />
          {t('Schedule is active')}
        </label>
        <div className="action-row">
          <button className="btn-skip" type="button" disabled={busy} onClick={onClose}>
            {t('Cancel')}
          </button>
          <button className="send-button" disabled={busy}>
            {busy ? t('Saving…') : t('Save Medication')}
          </button>
        </div>
      </form>
    </Modal>
  );
}
