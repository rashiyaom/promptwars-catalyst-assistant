import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { LanguageProvider, translate } from '../web/src/i18n/LanguageContext.js';
import { HomePage } from '../web/src/components/home/HomePage.js';
import { decide } from '../src/core/decision_engine.js';
import { runAgent } from '../src/core/agent.js';
import { App } from '../web/src/app/App.js';
import { CareProvider } from '../web/src/context/CareContext.js';
import { MedicationTimeline } from '../web/src/components/medications/MedicationTimeline.js';
import { MedicationModal } from '../web/src/components/medications/MedicationModal.js';
import { AppointmentCard } from '../web/src/components/appointments/AppointmentCard.js';
import { EmergencyDrawer } from '../web/src/components/emergency/EmergencyDrawer.js';
import { AuthPage } from '../web/src/components/auth/AuthPage.js';
import { TausAgent } from '../web/src/components/taus/TausAgent.js';
import { ReminderSettings } from '../web/src/components/account/ReminderSettings.js';

// Rendering checks must never initialize Firebase or access the network.
vi.mock('../web/src/lib/firebase.js', () => ({ getFirebaseClients: () => null }));

function renderInDemo(child: React.ReactNode): string {
  return renderToStaticMarkup(React.createElement(CareProvider, { children: child }));
}

describe('Offline frontend rendering', () => {
  it('keeps demo sign-in explicit and hides contact editors from the elder', () => {
    const html = renderInDemo(
      React.createElement(
        React.Fragment,
        null,
        React.createElement(AuthPage),
        React.createElement(ReminderSettings),
      ),
    );
    expect(html).toContain('Explore offline demo');
    expect(html).toContain('doctor');
    expect(html).toContain('Automatic email delivery and background reminders are unavailable');
    expect(html).toContain('type="password"');
    expect(html).not.toContain('Rameshwar');
    expect(html).not.toContain('type="tel"');
  });
  it('renders the Hindi Taus controls, context boundary and local-demo disclosure', () => {
    const html = renderToStaticMarkup(
      React.createElement(LanguageProvider, {
        initialLanguage: 'hi',
        children: React.createElement(CareProvider, {
          children: React.createElement(TausAgent, { onEmergency: () => undefined }),
        }),
      }),
    );
    expect(html).toContain('नमस्ते, मैं ताऊस हूँ।');
    expect(html).toContain('बोलकर बात शुरू करें');
    expect(html).toContain('ताऊस आपका निजी ईमेल इनबॉक्स नहीं पढ़ सकता।');
    expect(html).toContain('ईमेल या SMS नहीं भेजे जाते।');
    expect(html).not.toContain('Start voice conversation');
  });
  it('renders the application with account-free demo and an always available SOS control', () => {
    const html = renderToStaticMarkup(React.createElement(App));
    expect(html).toContain('Offline Demo');
    expect(html).toContain('SOS · Emergency help');
    expect(html).toContain('Skip to care content');
    expect(html).toContain('Get started with Taus');
    expect(html).not.toContain('0 / 4');
    expect(html).toContain('Your care starts here');
    expect(html).not.toContain('Amlodipine');
  });
  it('renders two independent Metformin doses and all four timeline groups', () => {
    const html = renderInDemo(React.createElement(MedicationTimeline, { onEdit: () => undefined }));
    expect(html.match(/aria-label="Mark Metformin at/g) ?? []).toHaveLength(2);
    for (const period of ['Morning', 'Afternoon', 'Evening', 'Night'])
      expect(html).toContain(`aria-label="${period} doses"`);
    expect(html).toContain('Sample history');
    expect(html).toContain('All medication schedules');
  });
  it('prefills all schedule fields when editing without dropping additional times or custom frequency', () => {
    const html = renderInDemo(
      React.createElement(MedicationModal, {
        onClose: () => undefined,
        medication: {
          id: 'edit-med',
          name: 'Existing medicine',
          dosage: 'Existing dose',
          times: ['08:00', '14:00', '21:00'],
          frequency: { type: 'interval', everyNDays: 5 },
          startDate: '2026-11-01',
          endDate: '2026-12-31',
          notes: 'Existing notes',
          active: false,
        },
      }),
    );
    expect(html).toContain('Edit Medication Schedule');
    for (const value of ['08:00', '14:00', '21:00', '5', '2026-12-31'])
      expect(html).toContain(`value="${value}"`);
    expect(html).toContain('value="interval" selected=""');
    expect(html).not.toContain('checked=""');
  });
  it('renders preparation notes as safe text and offers both calendar formats and directions', () => {
    const html = renderInDemo(
      React.createElement(AppointmentCard, {
        appointment: {
          id: 'test',
          doctorName: 'Doctor',
          specialty: 'Review',
          dateTime: '2026-11-20T10:30:00+05:30',
          location: 'Clinic & Ward',
          notes: '<script>alert(1)</script>\nBring ECG report',
        },
      }),
    );
    expect(html).not.toContain('<script>');
    expect(html).toContain('Bring ECG report');
    expect(html).toContain('Checkmarks stay on this device');
    expect(html).toContain('Download iCal (.ics)');
    expect(html).toContain('calendar.google.com');
    expect(html).toContain('destination=Clinic%20%26%20Ward');
  });
  it('makes the emergency simulation explicit and lists both demo recipients', () => {
    const html = renderInDemo(React.createElement(EmergencyDrawer, { onClose: () => undefined }));
    expect(html).toContain('href="tel:112"');
    expect(html).toContain('No SMS or push messages will be sent');
    expect(html).toContain('Priya Sharma');
    expect(html).toContain('Rohan Sharma');
    expect(html).toContain('cannot dispatch help');
    expect(html).toContain('aria-modal="true"');
  });
});

describe('Hindi care experience', () => {
  it('renders the homepage, medicine form and emergency guidance in Hindi without altering medicine names', () => {
    const content = React.createElement(
      React.Fragment,
      null,
      React.createElement(HomePage, { onOpen: () => undefined, onCircle: () => undefined }),
      React.createElement(MedicationModal, { onClose: () => undefined }),
      React.createElement(EmergencyDrawer, { onClose: () => undefined }),
    );
    const html = renderToStaticMarkup(
      React.createElement(LanguageProvider, {
        initialLanguage: 'hi',
        children: React.createElement(CareProvider, { children: content }),
      }),
    );
    expect(html).toContain('अपनों जैसी।');
    expect(html).toContain('दवाई का नाम');
    expect(html).toContain('अभी 112 पर कॉल करें');
    expect(html).toContain('कोई SMS या पुश संदेश नहीं भेजा जाएगा');
    expect(html).not.toContain('Amlodipine');
    expect(html).not.toContain('CARE THAT');
  });
  it('interpolates user values once and preserves unknown care text', () => {
    expect(translate('hi', 'Edit {0}', 'Medicine {1}')).toBe('Medicine {1} बदलें');
    expect(translate('en', 'Edit {0}', 'Medicine')).toBe('Edit Medicine');
    expect(translate('hi', 'Untranslated prescription text')).toBe(
      'Untranslated prescription text',
    );
  });
  it.each([
    'मेरे सीने में तेज दर्द है',
    'साँस नहीं आ रही',
    'सांस लेने में दिक्कत है',
    'वह बेहोश हैं',
    'saans nahi aa rahi',
  ])('prioritizes Hindi emergency language: %s', (message) => {
    expect(decide(message).intent).toBe('urgent_safety');
  });
  it('recognizes Hindi missed-dose and appointment questions', () => {
    expect(decide('मैं सुबह की दवा लेना भूल गया').intent).toBe('missed_dose');
    expect(decide('डॉक्टर के साथ मेरी मुलाकात कब है?').intent).toBe('appointment');
  });
  it('returns a translatable offline response for a Hindi emergency', async () => {
    const response = await runAgent({ sessionId: 'hindi-regression', message: 'मेरे सीने में दर्द है' });
    expect(response.urgency).toBe('urgent');
    expect(translate('hi', response.message)).toContain('स्थानीय आपातकालीन सेवाओं');
  });
});
