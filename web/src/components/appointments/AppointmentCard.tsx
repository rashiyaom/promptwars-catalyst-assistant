import React, { useState } from 'react';
import type { Appointment } from '@sanjeevani/shared/types/appointment';
import { useCare } from '../../context/CareContext.js';
import { downloadAppointment, googleCalendarUrl } from '../../features/appointments/calendar.js';

/** Appointment directions, calendar export, and a device-local preparation checklist. */
export function AppointmentCard({ appointment }: { readonly appointment: Appointment }): React.JSX.Element {
  const { activeProfile, user, isDemo, deleteAppointment, canEdit } = useCare();
  const storageKey = `sanjeevani:prep:${isDemo ? 'demo' : user?.uid}:${activeProfile.id}:${appointment.id}`;
  const tasks = [...new Set(['Bring current medication list', 'Bring relevant reports and prescriptions', ...appointment.notes.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)])];
  const [checked, setChecked] = useState<string[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const value: unknown = JSON.parse(window.localStorage.getItem(storageKey) ?? '[]');
      return Array.isArray(value) && value.every((item): item is string => typeof item === 'string') ? value : [];
    } catch { return []; }
  });
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const toggle = (task: string, completed: boolean) => {
    const next = completed ? [...checked, task] : checked.filter((item) => item !== task);
    setChecked(next);
    try { window.localStorage.setItem(storageKey, JSON.stringify(next)); setStatus('Checklist saved on this device.'); }
    catch { setStatus('Device storage is unavailable. Checklist kept for this session.'); }
  };
  const cancel = async () => {
    if (!window.confirm(`Remove the appointment with ${appointment.doctorName}? This does not cancel your booking with the clinic.`)) return;
    setBusy(true); setError('');
    try { await deleteAppointment(appointment.id); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not remove the appointment.'); }
    finally { setBusy(false); }
  };
  return <article className="appt-item">
    <div className="section-heading"><h2>{appointment.doctorName} <span>· {appointment.specialty}</span></h2>
      {canEdit && <button className="btn-skip danger-text" disabled={busy} aria-label={`Remove appointment with ${appointment.doctorName}`} onClick={() => void cancel()}>Remove</button>}
    </div>
    <p><time dateTime={appointment.dateTime}>{new Intl.DateTimeFormat('en', { dateStyle: 'full', timeStyle: 'short', timeZone: activeProfile.timezone }).format(new Date(appointment.dateTime))}</time> ({activeProfile.timezone})</p>
    <p>{appointment.location || 'Location not provided'}</p>
    <fieldset className="prep-checklist"><legend>Prep checklist · {tasks.filter((task) => checked.includes(task)).length}/{tasks.length} ready</legend>
      <p>Follow your clinician’s instructions for fasting or medication changes. Checkmarks stay on this device.</p>
      {tasks.map((task) => <label className="check-label" key={task}><input type="checkbox" checked={checked.includes(task)} onChange={(e) => toggle(task, e.target.checked)} /><span>{task}</span></label>)}
    </fieldset>
    <div className="action-row">
      {appointment.location && <a className="chip" href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(appointment.location)}`} target="_blank" rel="noopener noreferrer">Directions ↗</a>}
      <a className="chip" href={googleCalendarUrl(appointment)} target="_blank" rel="noopener noreferrer">Google Calendar ↗</a>
      <button className="chip" onClick={() => { try { downloadAppointment(appointment); setStatus('Calendar file prepared. Import it into your calendar.'); } catch { setError('Could not export the appointment. Please retry.'); } }}>Download iCal (.ics)</button>
    </div>
    <p className="small-note">Calendar exports use a 30-minute estimate. External links require internet.</p>
    <p role="status">{status}</p>{error && <p className="error-message" role="alert">{error}</p>}
  </article>;
}
