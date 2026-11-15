import { speak, stopSpeech, isSpeaking } from '../../lib/speech.js';
import { FREE_PLAN } from '../../lib/plan.js';
import React, { useEffect, useRef, useState } from 'react';
import { decide, runAgent, validateInput } from '@sanjeevani/core';
import type { DoseLog } from '@sanjeevani/shared/types/doseLog';
import type { AlertDelivery } from '@sanjeevani/shared/types/notification';
import type { MedicationInput } from '@sanjeevani/shared/schemas/medication';
import { parsePrescriptionFromText } from '../../features/prescription/prescriptionService.js';
import { useCare } from '../../context/CareContext.js';
import { useLanguage } from '../../i18n/LanguageContext.js';
import { listAlertDeliveries } from '../../features/profiles/notificationSettingsService.js';
import { doseAnswer } from '../../features/taus/dialogue.js';

interface Recognition {
  lang: string; continuous: boolean; interimResults: boolean;
  onresult: ((event: { results: { [index: number]: { [index: number]: { transcript: string } } } }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void; abort(): void;
}
type SpeechWindow = Window & { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };

/** Contextual voice agent with bounded tools: named-dose confirmation, snooze, and read-only care context. */
export function TausAgent({ onEmergency }: { readonly onEmergency: () => void }): React.JSX.Element {
  const { t, locale, language } = useLanguage();
  const { activeProfile, medications, appointments, todayDoses, doseLogs, careMembers, canLogDose, logDose, snoozeDose, refreshData, isDemo, user, currentMember, addMedication, canManageMedication } = useCare();
  const [message, setMessage] = useState(''); const [transcript, setTranscript] = useState(''); const [input, setInput] = useState('');
  const [askedId, setAskedId] = useState<string | null>(null); const [busy, setBusy] = useState(false); const [listening, setListening] = useState(false); const [voiceOn, setVoiceOn] = useState(false);
  const [pendingMed, setPendingMed] = useState<MedicationInput | null>(null);
  const [deliveries, setDeliveries] = useState<AlertDelivery[]>([]); const [alertError, setAlertError] = useState(false); const [imageFailed, setImageFailed] = useState(false);
  const recognition = useRef<Recognition | null>(null); const handsFree = useRef(false); const mounted = useRef(true); const speakingVersion = useRef(0); const locked = useRef(false);
  const listenAgain = useRef<() => void>(() => undefined); const handleText = useRef<(value: string) => Promise<void>>(async () => undefined);
  const prompted = useRef(new Set<string>()); const askNext = useRef<() => void>(() => undefined);
  const refresh = useRef(refreshData); refresh.current = refreshData;
  const due = todayDoses.filter((dose) => (dose.status === 'pending' || dose.status === 'missed') && Date.parse(dose.scheduledFor) <= Date.now());
  const target = todayDoses.find((dose) => dose.id === askedId) ?? due[0];
  const medication = medications.find((item) => item.id === target?.medicationId);
  const canRecord = Boolean(target && canLogDose && (isDemo || FREE_PLAN || doseLogs.some((dose) => dose.id === target.id)));
  useEffect(() => { setImageFailed(false); }, [medication?.imageUrl]);
  useEffect(() => {
    mounted.current = true;
    const fetchAlerts = () => { void listAlertDeliveries(activeProfile.id).then((value) => { if (mounted.current) { setDeliveries(value); setAlertError(false); } }).catch(() => { if (mounted.current) setAlertError(true); }); };
    fetchAlerts();
    const interval = window.setInterval(() => { if (document.hidden) return; fetchAlerts(); if (!isDemo && !FREE_PLAN && !locked.current) void refresh.current(); }, 300_000);
    return () => { mounted.current = false; handsFree.current = false; speakingVersion.current += 1; recognition.current?.abort(); window.clearInterval(interval); stopSpeech(); };
  }, [activeProfile.id, isDemo]);
  useEffect(() => { handsFree.current = false; setVoiceOn(false); recognition.current?.abort(); stopSpeech(); }, [locale]);
  const say = (text: string) => {
    if (!mounted.current) return;
    setMessage(text); recognition.current?.abort();
    if (!handsFree.current) return;
    const version = ++speakingVersion.current;
    void speak(text, locale,
      () => { if (mounted.current && handsFree.current && version === speakingVersion.current) listenAgain.current(); },
      () => { if (mounted.current && version === speakingVersion.current) { handsFree.current = false; setVoiceOn(false); } },
    );
  };
  const ask = () => {
    const dose = due.find((item) => !item.nextReminderAt || Date.parse(item.nextReminderAt) <= Date.now());
    if (!dose) { setAskedId(null); say(t('No medicine is waiting for confirmation right now. Ask me about your schedule or appointments.')); return; }
    const med = medications.find((item) => item.id === dose.medicationId);
    if (!med) return;
    prompted.current.add(`${dose.id}:${dose.snoozeCount ?? 0}`);
    setAskedId(dose.id);
    say(t('Have you taken {0}, {1}, scheduled at {2}? Say yes only if you have taken this dose, or say not yet.', med.name, med.dosage, new Intl.DateTimeFormat(locale, { timeZone: activeProfile.timezone, hour: 'numeric', minute: '2-digit' }).format(new Date(dose.scheduledFor))));
  };
  askNext.current = ask;
  // A foreground voice session prompts again when a saved follow-up becomes due.
  const nextPrompt = due.find((dose) => (!dose.nextReminderAt || Date.parse(dose.nextReminderAt) <= Date.now()) && !prompted.current.has(`${dose.id}:${dose.snoozeCount ?? 0}`));
  useEffect(() => {
    if (voiceOn && !askedId && !busy && nextPrompt) {
      const timer = window.setTimeout(() => { if (!locked.current) askNext.current(); }, 7_000);
      return () => window.clearTimeout(timer);
    }
  }, [voiceOn, askedId, busy, nextPrompt?.id, nextPrompt?.snoozeCount]);
  const respond = async (answer: 'taken' | 'later', dose: DoseLog | undefined) => {
    if (!dose || locked.current || !canLogDose || !['pending', 'missed'].includes(dose.status)) { say(t('Let us review one specific dose first.')); return; }
    locked.current = true; setBusy(true);
    try {
      if (answer === 'taken') { await logDose(dose, 'taken'); setAskedId(null); say(t('Recorded as taken. Thank you. Say next to review another medicine.')); }
      else { const next = await snoozeDose(dose); setAskedId(null); say(t('I saved a follow-up for {0} on this screen. Keep this page open; no background email is sent.', new Intl.DateTimeFormat(locale, { timeZone: activeProfile.timezone, hour: 'numeric', minute: '2-digit' }).format(new Date(next)))); }
    } catch (err) { say(language === 'en' && err instanceof Error ? err.message : t('I could not save that response. Please check with your care circle.')); }
    finally { locked.current = false; if (mounted.current) setBusy(false); }
  };
  handleText.current = async (text) => {
    if (locked.current) return;
    setTranscript(text);
    if (!validateInput(text).accepted) { say(t('Please rephrase your message and try again.')); return; }
    if (decide(text).urgency === 'urgent') { handsFree.current = false; setVoiceOn(false); recognition.current?.abort(); onEmergency(); return; }

    if (pendingMed) {
      if (/^(yes|haan|हाँ|जी हां|यस|confirm|add|जोड़ो|करो)[.!।]?$/i.test(text.trim())) {
        const toAdd = pendingMed;
        setPendingMed(null);
        locked.current = true;
        setBusy(true);
        try {
          await addMedication(toAdd);
          say(t('Added {0} {1} to your medication schedule.', toAdd.name, toAdd.dosage));
        } catch (err) {
          say(err instanceof Error ? err.message : t('Could not add medication.'));
        } finally {
          locked.current = false;
          if (mounted.current) setBusy(false);
        }
        return;
      }
      if (/^(no|cancel|नहीं|मत जोड़ो|रद्द)[.!।]?$/i.test(text.trim())) {
        setPendingMed(null);
        say(t('Prescription cancelled.'));
        return;
      }
    }

    if (/(?:add|new)\s*(?:a\s*)?(?:prescription|medicine|medication)|दवा\s*जोड़ो|नई\s*दवा|प्रिस्क्रिप्शन|पर्चे\s*से/i.test(text)) {
      setBusy(true);
      try {
        const result = await parsePrescriptionFromText(text);
        if (result.success && result.medications.length > 0) {
          const med = result.medications[0];
          setPendingMed(med);
          say(t('I found {0} {1}, scheduled at {2}. Should I add this to {3}’s schedule? Say yes to confirm.', med.name, med.dosage, med.times.join(', '), activeProfile.elderName));
        } else {
          say(t('Please tell me the medicine name, dosage, and when to take it, for example: "Add prescription for Metformin 500mg twice a day at 8am and 8pm".'));
        }
      } catch (err) {
        say(err instanceof Error ? err.message : t('Could not parse prescription.'));
      } finally {
        if (mounted.current) setBusy(false);
      }
      return;
    }

    const answer = doseAnswer(text);
    if (answer) { if (askedId) await respond(answer, todayDoses.find((dose) => dose.id === askedId)); else say(t('Let us review one specific dose first.')); return; }
    if (/^(next|start|अगली|शुरू|अगला)[.!।]?$/i.test(text.trim())) { ask(); return; }
    if (/my name|who am i|मेरा नाम|मैं कौन/i.test(text)) { say(t('I am helping {0}. This profile has {1} medicines and {2} care-circle members.', activeProfile.elderName, medications.filter((med) => med.active).length, careMembers.length)); return; }
    if (/reminder|email|sms|mail|ईमेल|मेल|संदेश|रिमाइंडर/i.test(text)) {
      say(alertError ? t('I could not load alert status. Please try again.') : deliveries.length ? deliveries.map((item) => `${t(item.channel)}: ${t(item.status)}`).join('. ') : t('No alert delivery records yet. A caretaker controls the reminder contacts.')); return;
    }
    if (decide(text).intent === 'appointment') {
      const next = appointments.filter((item) => Date.parse(item.dateTime) >= Date.now()).sort((a, b) => Date.parse(a.dateTime) - Date.parse(b.dateTime))[0];
      say(next ? t('Your next appointment is with {0} on {1}, at {2}.', next.doctorName, new Intl.DateTimeFormat(locale, { timeZone: activeProfile.timezone, dateStyle: 'medium', timeStyle: 'short' }).format(new Date(next.dateTime)), next.location) : t('There are no upcoming appointments in this profile.')); return;
    }
    if (/medicine|schedule|दवा|दवाई|खुराक|दवाईयाँ/i.test(text) && decide(text).intent !== 'missed_dose') { ask(); return; }
    const result = await runAgent({ sessionId: `taus:${user?.uid ?? currentMember?.uid ?? 'demo'}:${activeProfile.id}`, message: text });
    say(t(result.message));
  };
  listenAgain.current = () => {
    if (!handsFree.current || !mounted.current || isSpeaking()) return;
    const Constructor = (window as SpeechWindow).SpeechRecognition ?? (window as SpeechWindow).webkitSpeechRecognition;
    if (!Constructor) { handsFree.current = false; setVoiceOn(false); say(t('Voice recognition is unavailable in this browser. You can type or use the large buttons.')); return; }
    const instance = new Constructor(); recognition.current = instance; instance.lang = locale; instance.continuous = false; instance.interimResults = false;
    instance.onresult = (event) => { const text = event.results[0]?.[0]?.transcript; if (text) void handleText.current(text); };
    instance.onerror = (event) => { if (event.error !== 'aborted' && mounted.current) { handsFree.current = false; setVoiceOn(false); setMessage(t('Microphone could not hear you. Check permissions or use the buttons.')); } };
    instance.onend = () => { if (mounted.current) setListening(false); };
    try { instance.start(); setListening(true); } catch { handsFree.current = false; setVoiceOn(false); setMessage(t('Microphone could not hear you. Check permissions or use the buttons.')); }
  };
  return <section className="card taus-agent" aria-labelledby="taus-title"><div className="section-heading"><div><p className="eyebrow">{t('YOUR PERSONAL CARE COMPANION')}</p><h2 id="taus-title">{t('Namaste, I’m Taus.')}</h2><p>{activeProfile.elderName} · {t('Only this care profile is in context.')}</p></div><span className={`taus-orb${listening ? ' listening' : ''}`} aria-hidden="true">✳</span></div>
    <div className="taus-message" role="status" aria-live="polite">{message || t('Talk to me about your medicines and appointments. We will take it one step at a time.')}</div>
    <div className="action-row"><button className="send-button" disabled={busy} onClick={() => { if (voiceOn) { handsFree.current = false; setVoiceOn(false); speakingVersion.current += 1; recognition.current?.abort(); stopSpeech(); } else { handsFree.current = true; setVoiceOn(true); ask(); } }}>{t(voiceOn ? 'Stop voice conversation' : 'Start voice conversation')}</button><button className="btn-skip" disabled={busy} onClick={ask}>{t('Review my next medicine')}</button>{voiceOn && <button className="btn-skip" disabled={busy || listening} onClick={() => listenAgain.current()}>{t('Listen again')}</button>}</div>
    <p className="small-note">{t('Microphone access is optional. Your browser may use an online speech service. Buttons and typing work without it.')}</p>
    {target && medication && <article className="taus-dose"><div className="medicine-photo">{medication.imageUrl && !imageFailed ? <img src={medication.imageUrl} referrerPolicy="no-referrer" alt={t('Caregiver-provided photo of {0}', medication.name)} onError={() => setImageFailed(true)} /> : <span aria-hidden="true">✚</span>}</div><div><span className="eyebrow">{t('CONFIRM THIS DOSE')}</span><h3>{medication.name} · {medication.dosage}</h3><p>{new Intl.DateTimeFormat(locale, { timeZone: activeProfile.timezone, hour: 'numeric', minute: '2-digit' }).format(new Date(target.scheduledFor))}</p><p>{medication.notes}</p><p className="small-note">{t('Use the name and prescribed instructions. A picture does not verify a medicine.')}</p><div className="action-row"><button className="btn-taken" disabled={busy || !canRecord} onClick={() => void respond('taken', target)}>{t('Yes, I took this dose')}</button><button className="btn-skip" disabled={busy || !canRecord || target.status !== 'pending'} onClick={() => void respond('later', target)}>{t('Not yet · remind me')}</button></div>{!canRecord && <p>{t('Dose recording needs elder/caretaker access and a generated dose log.')}</p>}</div></article>}
    {pendingMed && (
      <div className="pending-prescription-card" role="status">
        <span className="eyebrow">{t('VOICE PRESCRIPTION INTAKE')}</span>
        <h3>📋 {t('Confirm New Prescription')}</h3>
        <p><strong>{pendingMed.name}</strong> · {pendingMed.dosage}</p>
        <p className="times-badge">⏰ {pendingMed.times.join(', ')} · {pendingMed.frequency.type}</p>
        <p className="notes-text">📝 {pendingMed.notes}</p>
        <div className="action-row">
          <button
            className="btn-taken"
            disabled={busy || !canManageMedication}
            onClick={async () => {
              setBusy(true);
              try {
                const med = pendingMed;
                setPendingMed(null);
                await addMedication(med);
                say(t('Added {0} {1} to your medication schedule.', med.name, med.dosage));
              } catch (err) {
                say(err instanceof Error ? err.message : t('Could not add medication.'));
              } finally {
                if (mounted.current) setBusy(false);
              }
            }}
          >
            ✓ {t('Add to Schedule')}
          </button>
          <button
            className="btn-skip"
            onClick={() => {
              setPendingMed(null);
              say(t('Prescription cancelled.'));
            }}
          >
            ✕ {t('Cancel')}
          </button>
        </div>
      </div>
    )}
    {transcript && <p className="small-note">{t('You said:')} {transcript}</p>}
    <form className="chat-input-form" onSubmit={(e) => { e.preventDefault(); const text = input.trim(); if (text) { setInput(''); void handleText.current(text); } }}><input className="chat-input" aria-label={t('Ask Taus')} placeholder={t('Ask in English or Hindi…')} value={input} onChange={(e) => setInput(e.target.value)} /><button className="send-button" disabled={busy || !input.trim()}>{t('Send')}</button></form>
    <details className="taus-context"><summary>{t('What Taus can see')}</summary><p>{t('This profile’s medicines, dose responses, appointments, care-circle members and alert delivery records. Taus cannot read your personal email inbox.')}</p><p>{medications.length} {t('Medication Schedule')} · {appointments.length} {t('Appointments')} · {careMembers.length} {t('Members')}</p><h3>{t('Recent alert status')}</h3>{alertError ? <p role="alert">{t('I could not load alert status. Please try again.')}</p> : !deliveries.length ? <p>{t('No alert delivery records yet. A caretaker controls the reminder contacts.')}</p> : <ul>{deliveries.map((item) => <li key={item.id}>{t(item.channel)} · {t(item.status)}</li>)}</ul>}<p className="small-note">{t('Accepted means the provider queued the message, not that someone read it. Unknown or failed alerts need caretaker attention.')}</p></details>
    {isDemo && <p className="small-note">{t('Demo mode: dose responses are local; no email or SMS is sent.')}</p>}
  </section>;
}
