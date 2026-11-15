import React, { useState } from 'react';
import { Modal } from '../common/Modal.js';
import { useCare } from '../../context/CareContext.js';
import { appointmentInputSchema, type AppointmentInput } from '@sanjeevani/shared/schemas/appointment';

export interface AppointmentModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
}

/** Base foundation modal for scheduling a doctor visit or clinic checkup. */
export function AppointmentModal({ isOpen, onClose }: AppointmentModalProps): React.JSX.Element {
  const { addAppointment } = useCare();
  const [doctorName, setDoctorName] = useState('');
  const [specialty, setSpecialty] = useState('General Physician');
  const [dateTimeLocal, setDateTimeLocal] = useState('2026-11-25T10:30');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    // Convert local datetime to ISO with offset
    const dateObj = new Date(dateTimeLocal);
    const isoDateTime = dateObj.toISOString();

    const inputData: AppointmentInput = {
      doctorName: doctorName.trim(),
      specialty: specialty.trim(),
      dateTime: isoDateTime,
      location: location.trim(),
      notes: notes.trim(),
    };

    const parsed = appointmentInputSchema.safeParse(inputData);
    if (!parsed.success) {
      setValidationError(parsed.error.issues[0]?.message ?? 'Please check appointment details.');
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
      setValidationError(err instanceof Error ? err.message : 'Failed to schedule appointment.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Schedule Doctor Appointment">
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

        <div>
          <label htmlFor="appt-doctor" style={{ display: 'block', fontWeight: 650, color: '#16463e', marginBottom: '6px' }}>
            Doctor / Clinician Name *
          </label>
          <input
            id="appt-doctor"
            type="text"
            className="chat-input"
            style={{ width: '100%' }}
            placeholder="e.g. Dr. Asha Sharma"
            value={doctorName}
            onChange={(e) => setDoctorName(e.target.value)}
            required
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div>
            <label htmlFor="appt-specialty" style={{ display: 'block', fontWeight: 650, color: '#16463e', marginBottom: '6px' }}>
              Specialty *
            </label>
            <input
              id="appt-specialty"
              type="text"
              className="chat-input"
              style={{ width: '100%' }}
              placeholder="e.g. Cardiologist, Neurologist"
              value={specialty}
              onChange={(e) => setSpecialty(e.target.value)}
              required
            />
          </div>
          <div>
            <label htmlFor="appt-date" style={{ display: 'block', fontWeight: 650, color: '#16463e', marginBottom: '6px' }}>
              Date & Time *
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
          <label htmlFor="appt-location" style={{ display: 'block', fontWeight: 650, color: '#16463e', marginBottom: '6px' }}>
            Hospital / Clinic Location
          </label>
          <input
            id="appt-location"
            type="text"
            className="chat-input"
            style={{ width: '100%' }}
            placeholder="e.g. Apollo Care Clinic, 3rd Floor, Room 302"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
          />
        </div>

        <div>
          <label htmlFor="appt-notes" style={{ display: 'block', fontWeight: 650, color: '#16463e', marginBottom: '6px' }}>
            Preparation Notes & Reminders
          </label>
          <textarea
            id="appt-notes"
            className="chat-input"
            style={{ width: '100%', minHeight: '70px', resize: 'vertical' }}
            placeholder="e.g. Bring fasting blood sugar test and previous prescriptions."
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
            disabled={isSubmitting || !doctorName.trim()}
          >
            {isSubmitting ? 'Scheduling...' : 'Confirm Appointment'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
