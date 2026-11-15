import React, { useEffect, useRef, useState } from 'react';
import { useLanguage } from '../../i18n/LanguageContext.js';
import { useCare } from '../../context/CareContext.js';
import { buildTavusContext, TAVUS_DEPLOYMENT_ID, TAVUS_MAX_CALL_SECONDS } from '../../features/taus/tavusContext.js';
import { stopSpeech } from '../../lib/speech.js';

type TavusElement = HTMLElement & { endConversation?: () => void; sendMessage?: (message: object) => void };

/** Explicit consent, bounded profile context and lifecycle cleanup for the real Tavus PAL. */
export function TavusConversation(): React.JSX.Element {
  const { language } = useLanguage(); const hi = language === 'hi';
  const { activeProfile, medications, todayDoses, appointments, isDemo } = useCare();
  const [enabled, setEnabled] = useState(false); const [consent, setConsent] = useState(false);
  const [status, setStatus] = useState('');
  const container = useRef<HTMLDivElement>(null); const elementRef = useRef<TavusElement | null>(null);
  const started = useRef(false);
  const context = buildTavusContext({ profile: activeProfile, medications, doses: todayDoses, appointments, language, now: new Date().toISOString().slice(0, 16) + ':00.000Z' });
  const contextRef = useRef(context); contextRef.current = context;
  useEffect(() => {
    if (!enabled || !container.current) return;
    const element = document.createElement('tavus-embed') as TavusElement;
    elementRef.current = element;
    element.setAttribute('deployment-id', TAVUS_DEPLOYMENT_ID);
    element.setAttribute('camera-on-start', 'off');
    element.setAttribute('conversational-context', contextRef.current);
    // No persistent per-browser patient memory, particularly on a shared elder-care device.
    element.setAttribute('override-config', JSON.stringify({ customization: { conversation: { unique_memory_tag: false }, preview: { title: 'Meet Taus', description: 'Your Sanjeevani care companion' } } }));
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const onStarted = () => { started.current = true; stopSpeech(); setStatus(hi ? 'बातचीत जुड़ गई।' : 'Conversation connected.'); timeout = setTimeout(() => element.endConversation?.(), TAVUS_MAX_CALL_SECONDS * 1000); };
    const onEnded = () => { started.current = false; clearTimeout(timeout); setStatus(hi ? 'बातचीत समाप्त।' : 'Conversation ended.'); };
    const onError = () => { setStatus(hi ? 'वीडियो उपलब्ध नहीं है। नीचे ताऊस के टेक्स्ट और आवाज़ विकल्प इस्तेमाल करें।' : 'Video is unavailable. Use Taus text and voice controls below.'); };
    element.addEventListener('tavus:conversation-started', onStarted);
    element.addEventListener('tavus:conversation-ended', onEnded);
    element.addEventListener('tavus:error', onError);
    container.current.appendChild(element);
    let script = document.querySelector<HTMLScriptElement>('script[data-tavus]');
    if (!script) { script = document.createElement('script'); script.src = 'https://unpkg.com/@tavus/embed@0.19.0'; script.async = true; script.dataset.tavus = 'true'; document.head.appendChild(script); }
    script.addEventListener('error', onError);
    return () => { clearTimeout(timeout); element.endConversation?.(); element.remove(); started.current = false; elementRef.current = null; script?.removeEventListener('error', onError); };
  }, [enabled, activeProfile.id, hi]);
  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;
    element.setAttribute('conversational-context', context);
    if (started.current) element.sendMessage?.({ event_type: 'conversation.overwrite_llm_context', properties: { context } });
  }, [context]);
  return <section className="card tavus-card" aria-labelledby="tavus-title">
    <div className="tavus-intro"><img src="/images/taus-avatar.jpg" alt={hi ? 'ताऊस का वास्तविक Tavus अवतार' : 'Taus, the actual Tavus avatar'} width="240" height="240" />
      <div><p className="eyebrow">SANJEEVANI × TAVUS</p><h2 id="tavus-title">{hi ? 'ताऊस से आमने-सामने बात करें' : 'A familiar face. Your own care context.'}</h2>
        <p>{hi ? 'ताऊस को इस प्रोफ़ाइल का नाम, दवाएँ, आज की खुराक और आने वाली अपॉइंटमेंट की जानकारी मिलेगी।' : 'Taus can read this profile’s name, medicines, today’s dose status and upcoming appointments.'}</p>
        <p className="small-note"><strong>{hi ? 'नोट:' : 'NOTE:'}</strong> {hi ? 'प्रीमियर सदस्यता में प्रतिदिन केवल एक कॉल, 4 मिनट के लिए मान्य।' : 'Only one call per day allowed for 4 minutes in premier subscription.'}</p>
        <p className="small-note">{hi ? 'यह ऐप की वीडियो उपयोग सीमा है। वीडियो बातचीत रिकॉर्ड नहीं बदलती।' : 'This is the app’s video allowance. The video agent has read-only access; use the care controls below to save changes.'}</p>
      </div></div>
    {isDemo && <p className="small-note">{hi ? 'डेमो प्रोफ़ाइल: नमूना डेटा। वीडियो शुरू करने पर असली Tavus क्रेडिट इस्तेमाल होंगे।' : 'Demo profile: fictional data. Starting video still uses real Tavus credits.'}</p>}
    {!enabled ? <><label className="consent-row"><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} />{hi ? 'मैं इस प्रोफ़ाइल की ऊपर बताई गई जानकारी Tavus के साथ साझा करने के लिए सहमत हूँ।' : 'I agree to share the listed information from this profile with Tavus for this conversation.'}</label><button className="send-button" disabled={!consent} onClick={() => { stopSpeech(); setEnabled(true); }}>{hi ? 'वीडियो बातचीत खोलें' : 'Open video conversation'}</button></> : <button className="btn-skip" onClick={() => { setEnabled(false); setConsent(false); setStatus(''); }}>{hi ? 'वीडियो बंद करें' : 'Close video'}</button>}
    {status && <p role="status">{status}</p>}<div ref={container} className={enabled ? 'tavus-frame' : undefined} />
  </section>;
}
