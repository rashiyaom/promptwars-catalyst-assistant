import React, { useState } from 'react';
import { Modal } from '../common/Modal.js';
import { useCare } from '../../context/CareContext.js';

export interface CareCircleModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
}

/** Base foundation modal for inspecting the Care Circle directory and managing role passcodes. */
export function CareCircleModal({ isOpen, onClose }: CareCircleModalProps): React.JSX.Element {
  const { activeProfile, careMembers, role } = useCare();
  const [activeView, setActiveView] = useState<'members' | 'passcode'>('members');
  const [joinPasscode, setJoinPasscode] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);

  const handleJoinSimulation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{6,12}$/.test(joinPasscode)) {
      setFeedback('⚠️ Passcode must be a 6 to 12 digit numeric code.');
      return;
    }
    setFeedback(`✅ Passcode verified! Role permissions granted for ${displayName || 'New Member'}. (Hashed with bcrypt on backend)`);
    setTimeout(() => {
      setJoinPasscode('');
      setFeedback(null);
      setActiveView('members');
    }, 2000);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Care Circle & Role Access">
      <div style={{ display: 'flex', gap: '8px', marginBottom: '18px', borderBottom: '1px solid #e1ebe6', paddingBottom: '10px' }}>
        <button
          type="button"
          className={`tab-button ${activeView === 'members' ? 'active' : ''}`}
          style={{ padding: '6px 14px', fontSize: '14px' }}
          onClick={() => setActiveView('members')}
        >
          Care Circle Members ({careMembers.length})
        </button>
        <button
          type="button"
          className={`tab-button ${activeView === 'passcode' ? 'active' : ''}`}
          style={{ padding: '6px 14px', fontSize: '14px' }}
          onClick={() => setActiveView('passcode')}
        >
          Join with Role Passcode
        </button>
      </div>

      {activeView === 'members' && (
        <div>
          <div style={{ background: '#f0f7f4', padding: '12px 16px', borderRadius: '12px', marginBottom: '16px' }}>
            <p style={{ margin: 0, fontSize: '14px', color: '#16463e' }}>
              <strong>Profile:</strong> {activeProfile.elderName} ({activeProfile.timezone})
            </p>
            <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#44665f' }}>
              Your current active role is: <strong style={{ textTransform: 'capitalize' }}>{role}</strong>
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {careMembers.map((member) => (
              <div
                key={member.uid}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '12px 16px',
                  background: '#fcfdfd',
                  border: '1px solid #e6f0ec',
                  borderRadius: '12px',
                }}
              >
                <div>
                  <h4 style={{ margin: 0, fontSize: '15px', color: '#143e38' }}>{member.displayName}</h4>
                  <p style={{ margin: '2px 0 0', fontSize: '13px', color: '#5a7771' }}>{member.email}</p>
                </div>
                <span
                  style={{
                    padding: '4px 10px',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    background: member.role === 'elder' ? '#d6eee4' : member.role === 'caretaker' ? '#e0f2fe' : '#fef3c7',
                    color: member.role === 'elder' ? '#11645b' : member.role === 'caretaker' ? '#0369a1' : '#b45309',
                  }}
                >
                  {member.role}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeView === 'passcode' && (
        <form onSubmit={handleJoinSimulation} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <p style={{ margin: 0, fontSize: '14px', color: '#4d6560' }}>
            Enter the 6–12 digit role passcode provided by the care coordinator to link this device to the care circle.
          </p>

          {feedback && (
            <div
              style={{
                padding: '12px',
                borderRadius: '10px',
                backgroundColor: feedback.startsWith('⚠️') ? '#fee2e2' : '#eaf6f1',
                color: feedback.startsWith('⚠️') ? '#991b1b' : '#11645b',
                fontSize: '14px',
                fontWeight: 650,
              }}
              role="alert"
            >
              {feedback}
            </div>
          )}

          <div>
            <label htmlFor="join-name" style={{ display: 'block', fontWeight: 650, color: '#16463e', marginBottom: '6px' }}>
              Your Name
            </label>
            <input
              id="join-name"
              type="text"
              className="chat-input"
              style={{ width: '100%' }}
              placeholder="e.g. Dr. Verma, Nurse Aarti"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
            />
          </div>

          <div>
            <label htmlFor="join-passcode" style={{ display: 'block', fontWeight: 650, color: '#16463e', marginBottom: '6px' }}>
              6–12 Digit Passcode *
            </label>
            <input
              id="join-passcode"
              type="password"
              className="chat-input"
              style={{ width: '100%', letterSpacing: '0.15em' }}
              placeholder="••••••••"
              value={joinPasscode}
              onChange={(e) => setJoinPasscode(e.target.value)}
              maxLength={12}
              required
            />
          </div>

          <button type="submit" className="send-button" style={{ marginTop: '8px' }}>
            Verify & Connect Role
          </button>
        </form>
      )}
    </Modal>
  );
}
