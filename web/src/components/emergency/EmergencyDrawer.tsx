import React, { useEffect, useRef, useState } from 'react';
import { Modal } from '../common/Modal.js';
import { useCare } from '../../context/CareContext.js';

/** Emergency calling stays real; care-circle broadcast is explicitly a simulation. */
export function EmergencyDrawer({ onClose }: { readonly onClose: () => void }): React.JSX.Element {
  const { careMembers, activeProfile, speakText } = useCare();
  const [region, setRegion] = useState<'112' | '911'>('112');
  const [broadcast, setBroadcast] = useState<'idle' | 'sending' | 'complete'>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const contacts = careMembers.filter((member) => member.role !== 'elder');
  const instructions = 'Call emergency services now if you need urgent help. Tell the operator your location and what happened. Follow their instructions. For comfort while waiting, breathe gently at your own pace if comfortable; do not force or hold your breath.';
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const notify = () => {
    setBroadcast('sending');
    timer.current = setTimeout(() => setBroadcast('complete'), 900);
  };
  return <Modal isOpen onClose={onClose} title="Emergency help" drawer>
    <p className="emergency-lead">If this is an emergency, call now.</p>
    <p>This app cannot dispatch help or confirm that help is on the way.</p>
    <label className="care-form" htmlFor="emergency-region">Your current location<select id="emergency-region" value={region} onChange={(e) => setRegion(e.target.value as '112' | '911')}><option value="112">India · 112</option><option value="911">United States / Canada · 911</option></select></label>
    <a className="emergency-call" href={`tel:${region}`}>Call {region} now</a>
    <p className="small-note">Opens your device’s phone dialer. Elsewhere, call your local emergency number.</p>
    <section className="emergency-steps"><h3>While you wait for help</h3><ol><li>Tell the operator where you are and what happened.</li><li>Follow the emergency operator’s instructions.</li><li>For comfort, breathe gently at your own pace if comfortable. Do not force or hold your breath.</li></ol><button className="chip" onClick={() => speakText(instructions)}>Listen to these steps</button></section>
    <section className="broadcast-panel"><h3>Notify Care Circle <span className="simulation-label">Simulation</span></h3>
      <p>No SMS or push messages will be sent. This demonstrates an urgent alert for {activeProfile.elderName}.</p>
      <button className="send-button" disabled={broadcast !== 'idle' || !contacts.length} onClick={notify}>{broadcast === 'idle' ? 'Simulate urgent broadcast' : broadcast === 'sending' ? 'Simulating alerts…' : 'Simulation complete'}</button>
      <div role="status" aria-live="polite" aria-atomic="true">{broadcast === 'sending' && <p>Simulating SMS and push alerts…</p>}{broadcast === 'complete' && <p>Demo complete. Nobody has been contacted. Call emergency services directly.</p>}</div>
      <ul className="broadcast-list">{contacts.map((member) => <li key={member.uid}><strong>{member.displayName}</strong><span>{member.role} · {broadcast === 'complete' ? 'SMS + push simulated' : 'Demo recipient'}</span></li>)}</ul>
      {!contacts.length && <p>No caretaker or family members in this profile.</p>}
    </section>
    <p className="small-note">References: <a href="https://www.mha.gov.in/emergency-response-support-system-erss" target="_blank" rel="noopener noreferrer">India emergency services</a> · <a href="https://www.nhs.uk/mental-health/self-help/guides-tools-and-activities/breathing-exercises-for-stress/" target="_blank" rel="noopener noreferrer">Gentle breathing for stress</a></p>
  </Modal>;
}
