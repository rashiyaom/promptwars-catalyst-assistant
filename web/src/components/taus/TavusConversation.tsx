import React, { useEffect, useRef, useState } from 'react';
import { useLanguage } from '../../i18n/LanguageContext.js';

/** Load the supplied public deployment only after the user chooses video conversation. */
export function TavusConversation(): React.JSX.Element {
  const { language } = useLanguage(); const hi = language === 'hi';
  const [enabled, setEnabled] = useState(false); const [failed, setFailed] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!enabled || !container.current) return;
    const element = document.createElement('tavus-embed');
    element.setAttribute('deployment-id', 'd7a059cb-5260-40d7-bcb8-26d508c505a0');
    element.setAttribute('camera-on-start', 'off');
    element.setAttribute('conversational-context', `Preferred language: ${hi ? 'Hindi' : 'English'}. No private care records or action tools are connected to this embed. Never claim to have read or changed a medication record or scheduled a reminder.`);
    container.current.appendChild(element);
    let script = document.querySelector<HTMLScriptElement>('script[data-tavus]');
    if (!script) { script = document.createElement('script'); script.src = 'https://unpkg.com/@tavus/embed@latest'; script.async = true; script.dataset.tavus = 'true'; document.head.appendChild(script); }
    const error = () => setFailed(true); script.addEventListener('error', error);
    return () => { element.remove(); script?.removeEventListener('error', error); };
  }, [enabled, hi]);
  return <section className="card"><h2>{hi ? 'ताऊस से आमने-सामने बात करें' : 'Meet Taus'}</h2><p>{hi ? 'यह बातचीत Tavus पर चलेगी। निजी देखभाल रिकॉर्ड अभी इससे जुड़े नहीं हैं।' : 'This conversation runs through Tavus. Your private care records are not connected to it yet.'}</p>{!enabled && <button className="send-button" onClick={() => setEnabled(true)}>{hi ? 'Tavus बातचीत खोलें' : 'Open Tavus conversation'}</button>}{failed && <p role="alert">{hi ? 'बातचीत नहीं खुली। पेज फिर लोड करें।' : 'Could not load the conversation. Reload to retry.'}</p>}<div ref={container} className={enabled ? 'tavus-frame' : undefined} /></section>;
}
