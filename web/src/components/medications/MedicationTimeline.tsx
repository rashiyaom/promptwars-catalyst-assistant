import React, { useState } from 'react';
import type { Medication } from '@sanjeevani/shared/types/medication';
import { useCare } from '../../context/CareContext.js';
import { DAY_PERIODS, adherenceWeek, dayPeriod, localDate } from '../../features/medications/schedule.js';

/** Dose-level timeline and an auditable seven-day history, with explicit empty states. */
export function MedicationTimeline({ onEdit }: { readonly onEdit: (medication: Medication) => void }): React.JSX.Element {
  const { activeProfile, medications, doseLogs, todayDoses, today, logDose, deleteMedication, canManageMedication, isDemo, refreshData } = useCare();
  const [busy, setBusy] = useState<string | null>(null);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');
  const history = [...doseLogs.filter((log) => localDate(new Date(log.scheduledFor), activeProfile.timezone) !== today), ...todayDoses];
  const week = adherenceWeek(history, today, activeProfile.timezone);
  const perform = async (id: string, action: () => Promise<void>, message: string) => {
    setBusy(id); setError(''); setFeedback('');
    try { await action(); setFeedback(message); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not save. Please retry.'); }
    finally { setBusy(null); }
  };
  return <>
    <section className="adherence-panel" aria-labelledby="week-title">
      <h2 id="week-title">Your last 7 days</h2>
      <p>{isDemo ? 'Sample history · changes last for this session.' : 'Recorded dose history.'} Times shown in {activeProfile.timezone}.</p>
      <ol className="adherence-week">{week.map((day) => <li key={day.date} className={day.total && day.taken === day.total ? 'complete-day' : ''} aria-current={day.date === today ? 'date' : undefined}>
        <time dateTime={day.date}>{new Intl.DateTimeFormat('en', { weekday: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${day.date}T12:00:00Z`))}</time>
        <strong>{day.total ? `${day.taken}/${day.total} taken` : 'No records'}</strong>
        {day.missed > 0 && <span>{day.missed} missed</span>}{day.skipped > 0 && <span>{day.skipped} skipped</span>}{day.pending > 0 && <span>{day.pending} pending</span>}
      </li>)}</ol>
    </section>
    <p role="status" className="feedback">{feedback}</p>
    {error && <p role="alert" className="error-message">{error}</p>}
    {!isDemo && <div className="action-row"><p>New schedules become recordable when the server generates their dose logs.</p><button className="btn-skip" disabled={busy !== null} onClick={() => void perform('refresh', refreshData, 'Dose history refreshed.')}>Refresh doses</button></div>}
    {DAY_PERIODS.map((period) => {
      const doses = todayDoses.filter((dose) => dayPeriod(dose.scheduledFor, activeProfile.timezone) === period);
      return <section className="timeline-period" key={period} aria-label={`${period} doses`}>
        <h2>{period}<span>{doses.length} {doses.length === 1 ? 'dose' : 'doses'}</span></h2>
        {!doses.length && <p className="empty-state">No doses scheduled.</p>}
        {doses.map((dose) => {
          const medication = medications.find((med) => med.id === dose.medicationId);
          if (!medication) return null;
          const time = new Intl.DateTimeFormat('en', { timeZone: activeProfile.timezone, hour: 'numeric', minute: '2-digit' }).format(new Date(dose.scheduledFor));
          const recordable = isDemo || doseLogs.some((log) => log.id === dose.id);
          return <article className="med-item" key={dose.id}>
            <div className="med-info"><time dateTime={dose.scheduledFor} className="dose-time">{time}</time><h3>{medication.name} — {medication.dosage}</h3><p>{medication.notes}</p></div>
            <div className="med-actions">
              <span className={`dose-status ${dose.status}`}>{dose.status === 'pending' && !recordable ? 'Awaiting server schedule' : dose.status}</span>
              {dose.status === 'pending' && canManageMedication && <>
                <button className="btn-taken" disabled={busy !== null || !recordable} aria-label={`Mark ${medication.name} at ${time} taken`} onClick={() => void perform(dose.id, () => logDose(dose, 'taken'), `${medication.name} at ${time} marked taken.`)}>Mark taken</button>
                <button className="btn-skip" disabled={busy !== null || !recordable} aria-label={`Skip ${medication.name} at ${time}`} onClick={() => void perform(dose.id, () => logDose(dose, 'skipped'), `${medication.name} at ${time} marked skipped.`)}>Skip</button>
              </>}
            </div>
          </article>;
        })}
      </section>;
    })}
    <section className="schedule-directory" aria-labelledby="all-schedules"><h2 id="all-schedules">All medication schedules</h2>
      {!medications.length && <p>No medication schedules yet.</p>}
      {medications.map((med) => <div className="med-item" key={med.id}><div><h3>{med.name}</h3><p>{med.times.join(', ')} · {med.frequency.type === 'interval' ? `Every ${med.frequency.everyNDays} days` : med.frequency.type === 'weekdays' ? 'Selected weekdays' : 'Daily'}{!med.active && ' · Paused'}</p></div>
        {canManageMedication && <div className="action-row"><button className="btn-skip" disabled={busy !== null} onClick={() => onEdit(med)} aria-label={`Edit ${med.name}`}>Edit</button><button className="btn-skip danger-text" disabled={busy !== null} aria-label={`Delete ${med.name}`} onClick={() => { if (window.confirm(`Delete the ${med.name} schedule? Dose history will be retained.`)) void perform(med.id, () => deleteMedication(med.id), `${med.name} schedule deleted.`); }}>Delete</button></div>}
      </div>)}
    </section>
  </>;
}
