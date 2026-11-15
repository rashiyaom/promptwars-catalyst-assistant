import { expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
  token: vi.fn().mockResolvedValue('fresh'),
  write: vi.fn(),
  signIn: vi.fn(),
}));
vi.mock('firebase/auth', () => ({
  createUserWithEmailAndPassword: vi.fn(),
  onIdTokenChanged: vi.fn(),
  reload: vi.fn(),
  sendEmailVerification: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
  signInWithEmailAndPassword: mocks.signIn,
  signOut: vi.fn(),
  updateProfile: vi.fn(),
}));
vi.mock('firebase/firestore', () => ({ doc: vi.fn(), setDoc: mocks.write }));
vi.mock('../web/src/lib/firebase.js', () => ({
  getFirebaseClients: () => ({
    auth: {
      currentUser: {
        uid: 'user',
        email: 'user@example.test',
        emailVerified: true,
        getIdToken: mocks.token,
      },
    },
    db: {},
  }),
}));
import { ensureCareAccount, signInMember } from '../web/src/features/auth/authService';
it('refreshes verification claims before Firestore access', async () => {
  await ensureCareAccount();
  expect(mocks.token).toHaveBeenCalledWith(true);
  expect(mocks.token.mock.invocationCallOrder[0]).toBeLessThan(
    mocks.write.mock.invocationCallOrder[0],
  );
});
it('leaves account synchronization to the profile loader instead of racing two writes', async () => {
  mocks.write.mockClear();
  await signInMember(' user@example.test ', 'password');
  expect(mocks.signIn).toHaveBeenCalled();
  expect(mocks.write).not.toHaveBeenCalled();
});
