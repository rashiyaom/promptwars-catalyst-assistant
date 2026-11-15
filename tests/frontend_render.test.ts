import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { App } from '../web/src/app/App.js';
import { CareProvider } from '../web/src/context/CareContext.js';
import { MedicationTimeline } from '../web/src/components/medications/MedicationTimeline.js';
import { MedicationModal } from '../web/src/components/medications/MedicationModal.js';
import { AppointmentCard } from '../web/src/components/appointments/AppointmentCard.js';
import { EmergencyDrawer } from '../web/src/components/emergency/EmergencyDrawer.js';

// Rendering checks must never initialize Firebase or access the network.
vi.mock('../web/src/lib/firebase.js', () => ({ getFirebaseClients: () => null }));

function renderInDemo(child: React.ReactNode): string {
  return renderToStaticMarkup(React.createElement(CareProvider, { children: child }));
}

describe('Offline frontend rendering', () => {
  it('renders the application with account-free demo and an always available SOS control', () => {
    const html = renderToStaticMarkup(React.createElement(App));
    expect(html).toContain('Offline demo · no account needed');
    expect(html).toContain('SOS · Emergency help');
    expect(html).toContain('Skip to care content');
    expect(html).toContain('Medication Schedule (0/4)');
  });
  it('renders two independent Metformin doses and all four timeline groups', () => {
    const html = renderInDemo(React.createElement(MedicationTimeline, { onEdit: () => undefined }));
    expect((html.match(/aria-label="Mark Metformin at/g) ?? [])).toHaveLength(2);
    for (const period of ['Morning', 'Afternoon', 'Evening', 'Night']) expect(html).toContain(`aria-label="${period} doses"`);
    expect(html).toContain('Sample history');
    expect(html).toContain('All medication schedules');
  });
  it('prefills all schedule fields when editing without dropping additional times or custom frequency', () => {
    const html = renderInDemo(React.createElement(MedicationModal, { onClose: () => undefined, medication: {
      id: 'edit-med', name: 'Existing medicine', dosage: 'Existing dose', times: ['08:00', '14:00', '21:00'],
      frequency: { type: 'interval', everyNDays: 5 }, startDate: '2026-11-01', endDate: '2026-12-31', notes: 'Existing notes', active: false,
    } }));
    expect(html).toContain('Edit Medication Schedule');
    for (const value of ['08:00', '14:00', '21:00', '5', '2026-12-31']) expect(html).toContain(`value="${value}"`);
    expect(html).toContain('value="interval" selected=""');
    expect(html).not.toContain('checked=""');
  });
  it('renders preparation notes as safe text and offers both calendar formats and directions', () => {
    const html = renderInDemo(React.createElement(AppointmentCard, { appointment: { id: 'test', doctorName: 'Doctor', specialty: 'Review', dateTime: '2026-11-20T10:30:00+05:30', location: 'Clinic & Ward', notes: '<script>alert(1)</script>\nBring ECG report' } }));
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
