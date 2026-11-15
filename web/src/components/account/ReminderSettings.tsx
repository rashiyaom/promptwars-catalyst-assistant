import React, { useEffect, useState } from 'react';
import { useLanguage } from '../../i18n/LanguageContext.js';
import { useCare } from '../../context/CareContext.js';
import { enablePushNotifications } from '../../lib/notificationService.js';
import {
  loadEscalationSettings,
  saveEscalationSettings,
} from '../../features/profiles/notificationSettingsService.js';
import type { EscalationSettings } from '@sanjeevani/shared/types/notification';

export function ReminderSettings(): React.JSX.Element {
  const { language, t } = useLanguage();
  const { isDemo, activeProfile, currentMember, user, canEdit } = useCare();
  const [feedback, setFeedback] = useState('');
  const [settings, setSettings] = useState<EscalationSettings>({
    enabled: false,
    email: '',
    smsNumber: '',
    consentConfirmed: false,
  });

  useEffect(() => {
    if (!activeProfile.id) return;
    let cancelled = false;
    void loadEscalationSettings(activeProfile.id).then((loaded) => {
      if (!cancelled) setSettings(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, [activeProfile.id]);

  const requestNotifications = async () => {
    if (isDemo || !activeProfile.id) return;
    const uid = user?.uid ?? currentMember?.uid ?? '';
    try {
      const ok = await enablePushNotifications(activeProfile.id, uid);
      setFeedback(
        ok
          ? t('Push notifications enabled for this device.')
          : t('Notification permission was not granted.'),
      );
    } catch {
      setFeedback(t('Notification setup could not be completed.'));
    }
  };

  const handleSaveEscalation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProfile.id) return;
    try {
      await saveEscalationSettings(activeProfile.id, settings);
      setFeedback(t('Escalation settings saved successfully.'));
    } catch {
      setFeedback(t('Could not save escalation settings.'));
    }
  };

  return (
    <section className="card">
      <h2>{language === 'hi' ? 'रिमाइंडर और एस्केलेशन सेटिंग्स' : 'Reminder & Escalation Settings'}</h2>
      <p>
        {language === 'hi'
          ? 'ताऊस पेज खुला रहने पर याद दिला सकता है। अपने फ़ोन में अलार्म भी लगाएँ। अपने-आप ईमेल भेजना और बैकग्राउंड रिमाइंडर अभी उपलब्ध नहीं हैं।'
          : 'Taus can remind you while the page is open. Also set an alarm on your phone. Automatic email delivery and background reminders are unavailable on this plan.'}
      </p>
      {canEdit && activeProfile.id && (
        <form onSubmit={(e) => void handleSaveEscalation(e)} className="care-form">
          <label className="check-label">
            <input
              type="checkbox"
              checked={settings.enabled}
              onChange={(e) => {
                setSettings((s) => ({ ...s, enabled: e.target.checked }));
              }}
            />
            {language === 'hi'
              ? 'मिस्ड डोज़ एस्केलेशन अलर्ट चालू करें'
              : 'Enable missed-dose escalation alerts'}
          </label>
          {settings.enabled && (
            <>
              <label htmlFor="escalation-email">
                {language === 'hi' ? 'केयरगिवर ईमेल पता' : 'Caregiver email address'}
                <input
                  id="escalation-email"
                  type="email"
                  value={settings.email}
                  onChange={(e) => {
                    setSettings((s) => ({ ...s, email: e.target.value }));
                  }}
                  placeholder="caregiver@example.com"
                />
              </label>
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={settings.consentConfirmed}
                  onChange={(e) => {
                    setSettings((s) => ({ ...s, consentConfirmed: e.target.checked }));
                  }}
                />
                {language === 'hi'
                  ? 'केयरगिवर अलर्ट भेजने की सहमति है'
                  : 'I confirm consent to send missed dose notifications'}
              </label>
            </>
          )}
          <button type="submit" className="send-button">
            {language === 'hi' ? 'सेटिंग्स सुरक्षित करें' : 'Save escalation settings'}
          </button>
        </form>
      )}
      {!isDemo && activeProfile.id && (
        <div style={{ marginTop: '1rem' }}>
          <button type="button" className="btn-skip" onClick={() => void requestNotifications()}>
            {language === 'hi' ? 'ब्राउज़र पुश सूचनाएँ चालू करें' : 'Enable browser push notifications'}
          </button>
        </div>
      )}
      {feedback && (
        <p role="status" className="small-note">
          {feedback}
        </p>
      )}
    </section>
  );
}
