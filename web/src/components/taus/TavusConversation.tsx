import React, { useEffect, useRef, useState } from 'react';
import { useLanguage } from '../../i18n/LanguageContext.js';
import { useCare } from '../../context/CareContext.js';
import {
  buildTavusContext,
  TAVUS_DAILY_CALLS,
  TAVUS_DEPLOYMENT_ID,
  TAVUS_MAX_CALL_SECONDS,
} from '../../features/taus/tavusContext.js';
import { stopSpeech } from '../../lib/speech.js';

interface TavusElement extends HTMLElement {
  endConversation?: () => void;
  sendMessage?: (message: Record<string, unknown>) => void;
}

/**
 * TavusConversation renders the real Tavus PAL interactive video agent.
 * Handles explicit elder consent, bounded patient context passing,
 * and deterministic lifecycle teardown to protect user privacy and API quotas.
 */
export function TavusConversation(): React.JSX.Element {
  const { language } = useLanguage();
  const isHindi = language === 'hi';
  const { activeProfile, medications, todayDoses, appointments, isDemo } = useCare();

  const [enabled, setEnabled] = useState(false);
  const [consent, setConsent] = useState(false);
  const [status, setStatus] = useState('');

  const containerRef = useRef<HTMLDivElement>(null);
  const elementRef = useRef<TavusElement | null>(null);
  const startedRef = useRef(false);

  const context = buildTavusContext({
    profile: activeProfile,
    medications,
    doses: todayDoses,
    appointments,
    language,
    now: new Date().toISOString().slice(0, 16) + ':00.000Z',
  });

  const contextRef = useRef(context);
  contextRef.current = context;

  useEffect(() => {
    if (!enabled || !containerRef.current) {
      return;
    }

    const element = document.createElement('tavus-embed') as TavusElement;
    elementRef.current = element;

    element.setAttribute('deployment-id', TAVUS_DEPLOYMENT_ID);
    element.setAttribute('camera-on-start', 'off');
    element.setAttribute('conversational-context', contextRef.current);

    // No persistent per-browser patient memory, particularly on a shared elder-care device.
    element.setAttribute(
      'override-config',
      JSON.stringify({
        customization: {
          conversation: { unique_memory_tag: false },
          preview: {
            title: 'Meet Sanjeevan',
            description: 'Your Sanjeevani care companion',
          },
        },
      }),
    );

    let callTimeout: ReturnType<typeof setTimeout> | undefined;

    const onStarted = () => {
      startedRef.current = true;
      stopSpeech();
      setStatus(isHindi ? 'बातचीत जुड़ गई।' : 'Conversation connected.');
      callTimeout = setTimeout(() => {
        element.endConversation?.();
      }, TAVUS_MAX_CALL_SECONDS * 1000);
    };

    const onEnded = () => {
      startedRef.current = false;
      if (callTimeout) {
        clearTimeout(callTimeout);
      }
      setStatus(isHindi ? 'बातचीत समाप्त।' : 'Conversation ended.');
    };

    const onError = () => {
      setStatus(
        isHindi
          ? 'वीडियो उपलब्ध नहीं है। नीचे ताऊस के टेक्स्ट और आवाज़ विकल्प इस्तेमाल करें।'
          : 'Video is unavailable. Use Taus text and voice controls below.',
      );
    };

    element.addEventListener('tavus:conversation-started', onStarted);
    element.addEventListener('tavus:conversation-ended', onEnded);
    element.addEventListener('tavus:error', onError);

    containerRef.current.appendChild(element);

    let script = document.querySelector<HTMLScriptElement>('script[data-tavus]');
    if (!script) {
      script = document.createElement('script');
      script.src = 'https://unpkg.com/@tavus/embed@0.19.0';
      script.async = true;
      script.dataset.tavus = 'true';
      document.head.appendChild(script);
    }
    script.addEventListener('error', onError);

    return () => {
      if (callTimeout) {
        clearTimeout(callTimeout);
      }
      element.endConversation?.();
      element.remove();
      startedRef.current = false;
      elementRef.current = null;
      script?.removeEventListener('error', onError);
    };
  }, [enabled, activeProfile.id, isHindi]);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) {
      return;
    }
    element.setAttribute('conversational-context', context);
    if (startedRef.current) {
      element.sendMessage?.({
        event_type: 'conversation.overwrite_llm_context',
        properties: { context },
      });
    }
  }, [context]);

  const handleOpenConversation = () => {
    stopSpeech();
    setEnabled(true);
  };

  const handleCloseConversation = () => {
    setEnabled(false);
    setConsent(false);
    setStatus('');
  };

  return (
    <section className="card tavus-card" aria-labelledby="tavus-title">
      <div className="tavus-intro">
        <img
          src="/images/taus-avatar.jpg"
          alt={isHindi ? 'ताऊस का वास्तविक Tavus अवतार' : 'Taus, the actual Tavus avatar'}
          width="240"
          height="240"
        />
        <div>
          <p className="eyebrow">SANJEEVANI × TAVUS</p>
          <h2 id="tavus-title">
            {isHindi ? 'ताऊस से आमने-सामने बात करें' : 'A familiar face. Your own care context.'}
          </h2>
          <p>
            {isHindi
              ? 'ताऊस को इस प्रोफ़ाइल का नाम, दवाएँ, आज की खुराक और आने वाली अपॉइंटमेंट की जानकारी मिलेगी।'
              : 'Taus can read this profile’s name, medicines, today’s dose status and upcoming appointments.'}
          </p>
          <p className="small-note">
            <strong>{isHindi ? 'नोट:' : 'NOTE:'}</strong>{' '}
            {isHindi
              ? `प्रीमियर सदस्यता में प्रतिदिन केवल ${TAVUS_DAILY_CALLS} कॉल, ${Math.round(TAVUS_MAX_CALL_SECONDS / 60)} मिनट के लिए मान्य।`
              : `Only ${TAVUS_DAILY_CALLS} call per day allowed for ${Math.round(TAVUS_MAX_CALL_SECONDS / 60)} minutes in premier subscription.`}
          </p>
          <p className="small-note">
            {isHindi
              ? 'यह ऐप की वीडियो उपयोग सीमा है। वीडियो बातचीत रिकॉर्ड नहीं बदलती।'
              : 'This is the app’s video allowance. The video agent has read-only access; use the care controls below to save changes.'}
          </p>
        </div>
      </div>

      {isDemo && (
        <p className="small-note">
          {isHindi
            ? 'डेमो प्रोफ़ाइल: नमूना डेटा। वीडियो शुरू करने पर असली Tavus क्रेडिट इस्तेमाल होंगे।'
            : 'Demo profile: fictional data. Starting video still uses real Tavus credits.'}
        </p>
      )}

      {!enabled ? (
        <div className="tavus-controls">
          <label className="consent-row">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => {
                setConsent(e.target.checked);
              }}
            />
            {isHindi
              ? 'मैं इस प्रोफ़ाइल की ऊपर बताई गई जानकारी Tavus के साथ साझा करने के लिए सहमत हूँ।'
              : 'I agree to share the listed information from this profile with Tavus for this conversation.'}
          </label>
          <button className="send-button" disabled={!consent} onClick={handleOpenConversation}>
            {isHindi ? 'वीडियो बातचीत खोलें' : 'Open video conversation'}
          </button>
        </div>
      ) : (
        <button className="btn-skip" onClick={handleCloseConversation}>
          {isHindi ? 'वीडियो बंद करें' : 'Close video'}
        </button>
      )}

      {status && <p role="status">{status}</p>}
      <div ref={containerRef} className={enabled ? 'tavus-frame' : undefined} />
    </section>
  );
}
