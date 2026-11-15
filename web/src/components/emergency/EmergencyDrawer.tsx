import { useLanguage } from '../../i18n/LanguageContext.js';
import React, { useEffect, useRef, useState } from 'react';
import { Modal } from '../common/Modal.js';
import { useCare } from '../../context/CareContext.js';

/** Emergency calling stays real; care-circle broadcast is explicitly a simulation. */
export function EmergencyDrawer({ onClose }: { readonly onClose: () => void }): React.JSX.Element {
  const { t } = useLanguage();
  const { careMembers, activeProfile, speakText } = useCare();
  const [region, setRegion] = useState<'112' | '911'>('112');
  const [broadcast, setBroadcast] = useState<'idle' | 'sending' | 'complete'>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const contacts = careMembers.filter((member) => member.role === 'caretaker' || member.role === 'family');
  const instructions = [t('If this is an emergency, call now.'), t('Tell the operator where you are and what happened.'), t('Follow the emergency operator’s instructions.'), t('For comfort, breathe gently at your own pace if comfortable. Do not force or hold your breath.')].join(' ');
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const notify = () => {
    setBroadcast('sending');
    timer.current = setTimeout(() => setBroadcast('complete'), 900);
  };
  return <Modal isOpen onClose={onClose} title={t("Emergency help")} drawer>
    <p className="emergency-lead">{t("If this is an emergency, call now.")}</p>
    <p>{t("This app cannot dispatch help or confirm that help is on the way.")}</p>
    <label className="care-form" htmlFor="emergency-region">{t("Your current location")}<select id="emergency-region" value={region} onChange={(e) => setRegion(e.target.value as '112' | '911')}><option value="112">{t("India · 112")}</option><option value="911">{t("United States / Canada · 911")}</option></select></label>
    <a className="emergency-call" href={`tel:${region}`}>{t('Call {0} now', region)}</a>
    <p className="small-note">{t("Opens your device’s phone dialer. Elsewhere, call your local emergency number.")}</p>
    <section className="emergency-steps"><h3>{t("While you wait for help")}</h3><ol><li>{t("Tell the operator where you are and what happened.")}</li><li>{t("Follow the emergency operator’s instructions.")}</li><li>{t("For comfort, breathe gently at your own pace if comfortable. Do not force or hold your breath.")}</li></ol><button className="chip" onClick={() => speakText(instructions)}>{t("Listen to these steps")}</button></section>
    <section className="broadcast-panel"><h3>{t("Notify Care Circle")} <span className="simulation-label">{t("Simulation")}</span></h3>
      <p>{t("No SMS or push messages will be sent. This demonstrates an urgent alert for")} {activeProfile.elderName}.</p>
      <button className="send-button" disabled={broadcast !== 'idle' || !contacts.length} onClick={notify}>{broadcast === 'idle' ? t("Simulate urgent broadcast") : broadcast === 'sending' ? t("Simulating alerts…") : t("Simulation complete")}</button>
      <div role="status" aria-live="polite" aria-atomic="true">{broadcast === 'sending' && <p>{t("Simulating SMS and push alerts…")}</p>}{broadcast === 'complete' && <p>{t("Demo complete. Nobody has been contacted. Call emergency services directly.")}</p>}</div>
      <ul className="broadcast-list">{contacts.map((member) => <li key={member.uid}><strong>{member.displayName}</strong><span>{t(member.role)} · {broadcast === 'complete' ? t("SMS + push simulated") : t("Demo recipient")}</span></li>)}</ul>
      {!contacts.length && <p>{t("No caretaker or family members in this profile.")}</p>}
    </section>
    <p className="small-note">{t("References:")} <a href="https://www.mha.gov.in/emergency-response-support-system-erss" target="_blank" rel="noopener noreferrer">{t("India emergency services")}</a> · <a href="https://www.nhs.uk/mental-health/self-help/guides-tools-and-activities/breathing-exercises-for-stress/" target="_blank" rel="noopener noreferrer">{t("Gentle breathing for stress")}</a></p>
  </Modal>;
}
