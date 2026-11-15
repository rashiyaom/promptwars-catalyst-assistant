import { httpsCallable } from 'firebase/functions';
import { collection, getDocs } from 'firebase/firestore';
import { getFirebaseClients } from '../../lib/firebase.js';
import type { ElderProfileInput, InvitationInput, AcceptInvitationInput } from '@sanjeevani/shared/schemas/profile';
import type { CareInvitation } from '@sanjeevani/shared/types/profile';
import { isMemberRole } from '@sanjeevani/shared/types/access';
import { Timestamp } from 'firebase/firestore';

async function call<Input, Output>(name: string, input: Input): Promise<Output> {
  const clients = getFirebaseClients();
  if (!clients) throw new Error('This action needs a connected Firebase account.');
  return (await httpsCallable<Input, Output>(clients.functions, name)(input)).data;
}
export const createCareProfile = (input: ElderProfileInput) => call<ElderProfileInput, { profileId: string }>('createCareProfile', input);
export const createCareInvitation = (input: InvitationInput) => call<InvitationInput, AcceptInvitationInput & { expiresAt: string }>('createCareInvitation', input);
export const acceptCareInvitation = (input: AcceptInvitationInput) => call<AcceptInvitationInput, { profileId: string }>('acceptCareInvitation', input);
export const removeCareMember = (profileId: string, memberUid: string) => call('removeCareMember', { profileId, memberUid });
export const revokeCareInvitation = (profileId: string, invitationId: string) => call('revokeCareInvitation', { profileId, invitationId });
export async function listInvitations(profileId: string): Promise<CareInvitation[]> {
  const clients = getFirebaseClients();
  if (!clients) return [];
  const result = await getDocs(collection(clients.db, 'profiles', profileId, 'invitations'));
  return result.docs.flatMap((document): CareInvitation[] => {
    const data = document.data();
    if (!isMemberRole(data.role)) return [];
    return [{ id: document.id, email: String(data.email), role: data.role, status: data.status === 'accepted' || data.status === 'revoked' ? data.status : 'pending', expiresAt: data.expiresAt instanceof Timestamp ? data.expiresAt.toDate().toISOString() : '' }];
  });
}
