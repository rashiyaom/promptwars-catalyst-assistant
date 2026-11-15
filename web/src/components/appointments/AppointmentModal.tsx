import { useLanguage } from '../../i18n/LanguageContext.js';
import React, { useState } from 'react';
import { addDays, zonedInstant } from '../../features/medications/schedule.js';
import { Modal } from '../common/Modal.js';
import { useCare } from '../../context/CareContext.js';
import { appointmentInputSchema, type AppointmentInput } from '@sanjeevani/shared/schemas/appointment';

export interface AppointmentModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
}

/** Base foundation modal for scheduling a doctor visit or clinic checkup. */
export function AppointmentModal({ isOpen, onClose }: AppointmentModalProps): React.JSX.Element {
  const { t, language } = useLanguage();
  const { addAppointment, activeProfile, today, careMembers } = useCare();
  const [doctorUid, setDoctorUid] = useState('');
  const [doctorName, setDoctorName] = useState('');
  const [specialty, setSpecialty] = useState('General Physician');
  const [dateTimeLocal, setDateTimeLocal] = useState(`${addDays(today, 7)}T10:30`);
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    const [date, time] = dateTimeLocal.split('T');
    const dateObj = zonedInstant(date, time, activeProfile.timezone);
    if (!dateObj) { setValidationError(t("Choose a valid date and time in the profile timezone.")); return; }
    const isoDateTime = dateObj.toISOString();

    const inputData: AppointmentInput = {
      doctorName: doctorName.trim(),
      doctorUid: doctorUid || null,
      specialty: specialty.trim(),
      dateTime: isoDateTime,
      location: location.trim(),
      notes: notes.trim(),
    };

    const parsed = appointmentInputSchema.safeParse(inputData);
    if (!parsed.success) {
      setValidationError((language === 'en' ? parsed.error.issues[0]?.message : undefined) ?? t("Please check appointment details."));
      return;
    }

    try {
      setIsSubmitting(true);
      await addAppointment(parsed.data);
      setDoctorName('');
      setLocation('');
      setNotes('');
      onClose();
    } catch (err) {
      setValidationError(language === 'en' && err instanceof Error ? err.message : t("Failed to schedule appointment."));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t("Schedule Doctor Appointment")} dismissible={!isSubmitting}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {validationError && (
          <div
            style={{
              padding: '12px',
              borderRadius: '10px',
              backgroundColor: '#fee2e2',
              color: '#991b1b',
              fontSize: '14px',
              fontWeight: 650,
            }}
            role="alert"
          >
            {validationError}
          </div>
        )}

        <label className="care-form" htmlFor="linked-doctor">{t('Connected doctor')}<select id="linked-doctor" value={doctorUid} onChange={(e) => { setDoctorUid(e.target.value); const doctor = careMembers.find((member) => member.uid === e.target.value); if (doctor) setDoctorName(doctor.displayName); }}><option value="">{t('External doctor (no account access)')}</option>{careMembers.filter((member) => member.role === 'doctor').map((doctor) => <option key={doctor.uid} value={doctor.uid}>{doctor.displayName}</option>)}</select></label>
        <div>
          <label htmlFor="appt-doctor" style={{ display: 'block', fontWeight: 650, color: '#16463e', marginBottom: '6px' }}>{t("Doctor / Clinician Name *")} </label>
          <input
            id="appt-doctor"
            type="text"
            className="chat-input"
            style={{ width: '100%' }}
            placeholder={t("e.g. Dr. Asha Sharma")}
            value={doctorName}
            onChange={(e) => setDoctorName(e.target.value)}
            required
          />
        </div>

        <div className="form-grid">
          <div>
            <label htmlFor="appt-specialty" style={{ display: 'block', fontWeight: 650, color: '#16463e', marginBottom: '6px' }}>{t("Specialty *")} </label>
            <input
              id="appt-specialty"
              type="text"
              className="chat-input"
              style={{ width: '100%' }}
              placeholder={t("e.g. Cardiologist, Neurologist")}
              value={specialty}
              onChange={(e) => setSpecialty(e.target.value)}
              required
            />
          </div>
          <div>
            <label htmlFor="appt-date" style={{ display: 'block', fontWeight: 650, color: '#16463e', marginBottom: '6px' }}>
              {t('Date & Time')} ({activeProfile.timezone}) *
            </label>
            <input
              id="appt-date"
              type="datetime-local"
              className="chat-input"
              style={{ width: '100%' }}
              value={dateTimeLocal}
              onChange={(e) => setDateTimeLocal(e.target.value)}
              required
            />
          </div>
        </div>

        <div>
          <label htmlFor="appt-location" style={{ display: 'block', fontWeight: 650, color: '#16463e', marginBottom: '6px' }}>{t("Hospital / Clinic Location")} </label>
          <input
            id="appt-location"
            type="text"
            className="chat-input"
            style={{ width: '100%' }}
            placeholder={t("e.g. Apollo Care Clinic, 3rd Floor, Room 302")}
            value={location}
            onChange={(e) => setLocation(e.target.value)}
          />
        </div>

        <div>
          <label htmlFor="appt-notes" style={{ display: 'block', fontWeight: 650, color: '#16463e', marginBottom: '6px' }}>{t("Prep Checklist — one instruction per line")} </label>
          <textarea
            id="appt-notes"
            className="chat-input"
            style={{ width: '100%', minHeight: '70px', resize: 'vertical' }}
            placeholder={t("e.g. Bring recent ECG report. Only add fasting instructions provided by your clinician.")}
            maxLength={1000}
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
          >{t("Cancel")} </button>
          <button
            type="submit"
            className="send-button"
            disabled={isSubmitting || !doctorName.trim()}
          >
            {isSubmitting ? t("Scheduling...") : t("Confirm Appointment")}
          </button>
        </div>
      </form>
    </Modal>
  );
}
