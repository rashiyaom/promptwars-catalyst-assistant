import { useLanguage } from '../../i18n/LanguageContext.js';
import React, { useState } from 'react';
import type { Medication } from '@sanjeevani/shared/types/medication';
import { useCare } from '../../context/CareContext.js';
import { DAY_PERIODS, adherenceWeek, dayPeriod, localDate } from '../../features/medications/schedule.js';

/** Dose-level timeline and an auditable seven-day history, with explicit empty states. */
export function MedicationTimeline({ onEdit }: { readonly onEdit: (medication: Medication) => void }): React.JSX.Element {
  const { t, locale, language } = useLanguage();
  const { activeProfile, medications, doseLogs, todayDoses, today, logDose, deleteMedication, canManageMedication, canLogDose, isDemo, refreshData } = useCare();
  const [busy, setBusy] = useState<string | null>(null);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');
  const history = [...doseLogs.filter((log) => localDate(new Date(log.scheduledFor), activeProfile.timezone) !== today), ...todayDoses];
  const week = adherenceWeek(history, today, activeProfile.timezone);
  const perform = async (id: string, action: () => Promise<void>, message: string) => {
    setBusy(id); setError(''); setFeedback('');
    try { await action(); setFeedback(message); }
    catch (err) { setError(language === 'en' && err instanceof Error ? err.message : t("Could not save. Please retry.")); }
    finally { setBusy(null); }
  };
  return <>
    <section className="adherence-panel" aria-labelledby="week-title">
      <h2 id="week-title">{t("Your last 7 days")}</h2>
      <p>{isDemo ? t("Sample history · changes last for this session.") : t("Recorded dose history.")} {t("Times shown in")} {activeProfile.timezone}.</p>
      <ol className="adherence-week">{week.map((day) => <li key={day.date} className={day.total && day.taken === day.total ? 'complete-day' : ''} aria-current={day.date === today ? 'date' : undefined}>
        <time dateTime={day.date}>{new Intl.DateTimeFormat(locale, { weekday: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${day.date}T12:00:00Z`))}</time>
        <strong>{day.total ? `${day.taken}/${day.total} ${t('taken')}` : t("No records")}</strong>
        {day.missed > 0 && <span>{day.missed} {t("missed")}</span>}{day.skipped > 0 && <span>{day.skipped} {t("skipped")}</span>}{day.pending > 0 && <span>{day.pending} {t("pending")}</span>}
      </li>)}</ol>
    </section>
    <p role="status" className="feedback">{feedback}</p>
    {error && <p role="alert" className="error-message">{error}</p>}
    {!isDemo && <div className="action-row"><p>{t("New schedules become recordable when the server generates their dose logs.")}</p><button className="btn-skip" disabled={busy !== null} onClick={() => void perform('refresh', refreshData, t("Dose history refreshed."))}>{t("Refresh doses")}</button></div>}
    {DAY_PERIODS.map((period) => {
      const doses = todayDoses.filter((dose) => dayPeriod(dose.scheduledFor, activeProfile.timezone) === period);
      return <section className="timeline-period" key={period} aria-label={`${t(period)} ${t('doses')}`}>
        <h2>{t(period)}<span>{doses.length} {t(doses.length === 1 ? 'dose' : 'doses')}</span></h2>
        {!doses.length && <p className="empty-state">{t("No doses scheduled.")}</p>}
        {doses.map((dose) => {
          const medication = medications.find((med) => med.id === dose.medicationId);
          if (!medication) return null;
          const time = new Intl.DateTimeFormat(locale, { timeZone: activeProfile.timezone, hour: 'numeric', minute: '2-digit' }).format(new Date(dose.scheduledFor));
          const recordable = isDemo || doseLogs.some((log) => log.id === dose.id);
          return <article className="med-item" key={dose.id}>
            <div className="med-info"><time dateTime={dose.scheduledFor} className="dose-time">{time}</time><h3>{medication.name} — {medication.dosage}</h3><p>{medication.notes}</p></div>
            <div className="med-actions">
              <span className={`dose-status ${dose.status}`}>{dose.status === 'pending' && !recordable ? t("Awaiting server schedule") : t(dose.status)}</span>
              {(dose.status === 'pending' || dose.status === 'missed') && canLogDose && <>
                <button className="btn-taken" disabled={busy !== null || !recordable} aria-label={t('Mark {0} at {1} taken', medication.name, time)} onClick={() => void perform(dose.id, () => logDose(dose, 'taken'), t('{0} at {1} marked taken.', medication.name, time))}>{t("Mark taken")}</button>
                <button className="btn-skip" disabled={busy !== null || !recordable} aria-label={t('Skip {0} at {1}', medication.name, time)} onClick={() => void perform(dose.id, () => logDose(dose, 'skipped'), t('{0} at {1} marked skipped.', medication.name, time))}>{t("Skip")}</button>
              </>}
            </div>
          </article>;
        })}
      </section>;
    })}
    <section className="schedule-directory" aria-labelledby="all-schedules"><h2 id="all-schedules">{t("All medication schedules")}</h2>
      {!medications.length && <p>{t("No medication schedules yet.")}</p>}
      {medications.map((med) => <div className="med-item" key={med.id}><div><h3>{med.name}</h3><p>{med.times.join(', ')} · {med.frequency.type === 'interval' ? t('Every {0} days', med.frequency.everyNDays) : med.frequency.type === 'weekdays' ? t("Selected weekdays") : t("Daily")}{!med.active && t(" · Paused")}</p></div>
        {canManageMedication && <div className="action-row"><button className="btn-skip" disabled={busy !== null} onClick={() => onEdit(med)} aria-label={t('Edit {0}', med.name)}>{t("Edit")}</button><button className="btn-skip danger-text" disabled={busy !== null} aria-label={t('Delete {0}', med.name)} onClick={() => { if (window.confirm(t('Delete the {0} schedule? Dose history will be retained.', med.name))) void perform(med.id, () => deleteMedication(med.id), t('{0} schedule deleted.', med.name)); }}>{t("Delete")}</button></div>}
      </div>)}
    </section>
  </>;
}
