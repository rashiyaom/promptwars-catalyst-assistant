import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { initializeApp as adminApp } from 'firebase-admin/app';
import { getAuth as adminAuth } from 'firebase-admin/auth';
import { getFirestore as adminFirestore } from 'firebase-admin/firestore';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator, getDoc, setDoc, updateDoc, doc, Timestamp } from 'firebase/firestore';
import { getFunctions, connectFunctionsEmulator, httpsCallable } from 'firebase/functions';

// Hard stop if not launched by the local Emulator Suite. Never touch a real project.
assert.equal(process.env.GCLOUD_PROJECT, 'demo-sanjeevani');
assert.match(process.env.FIRESTORE_EMULATOR_HOST ?? '', /^(127\.0\.0\.1|localhost):8080$/);
assert.match(process.env.FIREBASE_AUTH_EMULATOR_HOST ?? '', /^(127\.0\.0\.1|localhost):9099$/);
const admin = adminApp({ projectId: 'demo-sanjeevani' });
const db = adminFirestore(admin); const auth = adminAuth(admin);
const suffix = randomUUID().slice(0, 8); const apps = [];
async function person(role, verified = true) {
  const email = `${role}-${suffix}@example.test`; const password = randomUUID();
  const account = await auth.createUser({ email, password, emailVerified: verified });
  const app = initializeApp({ projectId: 'demo-sanjeevani', apiKey: 'demo-key', authDomain: 'localhost' }, role); apps.push(app);
  const clientAuth = getAuth(app); connectAuthEmulator(clientAuth, 'http://127.0.0.1:9099', { disableWarnings: true });
  const firestore = getFirestore(app); connectFirestoreEmulator(firestore, '127.0.0.1', 8080);
  const functions = getFunctions(app); connectFunctionsEmulator(functions, '127.0.0.1', 5001);
  await signInWithEmailAndPassword(clientAuth, email, password);
  return { uid: account.uid, email, db: firestore, call: async (name, data) => (await httpsCallable(functions, name)(data)).data };
}
async function denied(action) { await assert.rejects(action, /permission|denied|invalid|already|precondition/i); }
try {
  const owner = await person('caretaker'); const elder = await person('elder'); const doctor = await person('doctor'); const outsider = await person('outsider'); const unverified = await person('unverified', false);
  const { profileId } = await owner.call('createCareProfile', { elderName: 'Test elder', relationship: 'parent', timezone: 'Asia/Kolkata' });
  async function invite(actor, recipient, role, profile = profileId) {
    const data = await actor.call('createCareInvitation', { profileId: profile, email: recipient.email, role });
    return { profileId: profile, invitationId: data.invitationId, token: data.token };
  }
  const elderInvite = await invite(owner, elder, 'elder');
  await denied(() => outsider.call('acceptCareInvitation', elderInvite));
  await elder.call('acceptCareInvitation', elderInvite);
  await denied(() => elder.call('acceptCareInvitation', elderInvite));
  await doctor.call('acceptCareInvitation', await invite(owner, doctor, 'doctor'));
  assert.equal((await db.doc(`profiles/${profileId}/members/${elder.uid}`).get()).get('role'), 'elder');
  assert.equal((await db.doc(`users/${elder.uid}/profiles/${profileId}`).get()).get('profileId'), profileId);
  await denied(() => getDoc(doc(outsider.db, `profiles/${profileId}`)));
  await denied(() => getDoc(doc(unverified.db, `profiles/${profileId}`)));
  await denied(() => updateDoc(doc(elder.db, `profiles/${profileId}/members/${elder.uid}`), { role: 'caretaker' }));
  await denied(() => updateDoc(doc(elder.db, `profiles/${profileId}`), { ownerUid: elder.uid }));
  const contacts = { enabled: true, email: owner.email, smsNumber: '', consentConfirmed: true, updatedBy: owner.uid, updatedAt: Timestamp.now() };
  const settingsPath = `profiles/${profileId}/notificationSettings/escalation`;
  await setDoc(doc(owner.db, settingsPath), contacts);
  for (const actor of [elder, doctor, outsider]) await denied(() => setDoc(doc(actor.db, settingsPath), { ...contacts, updatedBy: actor.uid }));
  await denied(() => getDoc(doc(elder.db, settingsPath)));
  const medication = { name: 'Test medicine', dosage: 'As prescribed', times: ['08:00'], frequency: { type: 'daily' }, startDate: '2026-01-01', endDate: null, active: true, notes: '', imageUrl: '', updatedBy: doctor.uid, updatedAt: Timestamp.now() };
  await setDoc(doc(doctor.db, `profiles/${profileId}/medications/m`), medication);
  await db.doc(`profiles/${profileId}/doseLogs/d`).set({ medicationId: 'm', scheduledFor: new Date(Date.now() - 120_000), status: 'pending', escalationProcessedAt: null });
  const dosePath = `profiles/${profileId}/doseLogs/d`;
  await denied(() => updateDoc(doc(doctor.db, dosePath), { status: 'taken', loggedBy: doctor.uid, loggedAt: Timestamp.now() }));
  await elder.call('snoozeDose', { profileId, doseId: 'd' });
  assert.equal((await db.doc(dosePath).get()).get('snoozeCount'), 1);
  await denied(() => updateDoc(doc(elder.db, dosePath), { nextReminderAt: Timestamp.now() }));
  await updateDoc(doc(elder.db, dosePath), { status: 'taken', loggedBy: elder.uid, loggedAt: Timestamp.now() });
  await denied(() => elder.call('snoozeDose', { profileId, doseId: 'd' }));
  const appointment = { doctorName: 'Test doctor', doctorUid: doctor.uid, specialty: 'Review', location: 'Test clinic', notes: '', dateTime: Timestamp.now(), createdBy: owner.uid };
  await setDoc(doc(owner.db, `profiles/${profileId}/appointments/a`), appointment);
  await denied(() => setDoc(doc(owner.db, `profiles/${profileId}/appointments/b`), { ...appointment, doctorUid: outsider.uid }));
  await owner.call('removeCareMember', { profileId, memberUid: elder.uid });
  assert.equal((await db.doc(`users/${elder.uid}/profiles/${profileId}`).get()).exists, false);
  await denied(() => getDoc(doc(elder.db, `profiles/${profileId}/medications/m`)));
  // A self-created elder hands administration to the first invited caretaker.
  const own = await elder.call('createCareProfile', { elderName: 'Self', relationship: 'self', timezone: 'Asia/Kolkata' });
  const oldLink = await invite(elder, doctor, 'doctor', own.profileId);
  await owner.call('acceptCareInvitation', await invite(elder, owner, 'caretaker', own.profileId));
  assert.equal((await db.doc(`profiles/${own.profileId}`).get()).get('ownerUid'), owner.uid);
  await denied(() => doctor.call('acceptCareInvitation', oldLink));
  await denied(() => invite(elder, outsider, 'caretaker', own.profileId));
  console.log('Emulator integration passed: identity, invitations, membership, ownership handoff, doctor relation, contact protection and dose actions.');
} finally { await Promise.all(apps.map((app) => deleteApp(app))); }
