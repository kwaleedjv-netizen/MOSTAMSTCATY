/**
 * Firestore Security Rules Adversarial Test Specification (Dirty Dozen)
 * Verifies that all 12 attack vectors defined in security_spec.md are rejected with PERMISSION_DENIED.
 */

export interface SecurityTestCase {
  id: string;
  title: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  path: string;
  auth: { uid: string; email?: string; email_verified?: boolean } | null;
  payload?: Record<string, unknown>;
  expected: 'PERMISSION_DENIED';
}

export const DIRTY_DOZEN_TESTS: SecurityTestCase[] = [
  {
    id: 'DD-01',
    title: 'Unauthenticated read on user documents',
    operation: 'list',
    path: '/users/userA/documents',
    auth: null,
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-02',
    title: 'Cross-tenant read by another signed-in user',
    operation: 'get',
    path: '/users/userA/documents/doc_1',
    auth: { uid: 'userB', email: 'b@gmail.com', email_verified: true },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-03',
    title: 'Unverified email spoofing write',
    operation: 'create',
    path: '/users/userA',
    auth: { uid: 'userA', email: 'a@gmail.com', email_verified: false },
    payload: { uid: 'userA', email: 'a@gmail.com', displayName: 'A', requireEmailOnNewIp: true },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-04',
    title: 'Shadow field injection (isAdmin: true)',
    operation: 'create',
    path: '/users/userA',
    auth: { uid: 'userA', email: 'a@gmail.com', email_verified: true },
    payload: { uid: 'userA', email: 'a@gmail.com', displayName: 'A', requireEmailOnNewIp: true, isAdmin: true },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-05',
    title: 'Owner spoofing in document payload',
    operation: 'create',
    path: '/users/userA/groups/grp_1',
    auth: { uid: 'userA', email: 'a@gmail.com', email_verified: true },
    payload: { ownerUid: 'userB', id: 'grp_1', name: 'Test', color: '#000', icon: 'folder', isLocked: false },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-06',
    title: 'Immutable ownerUid mutation on update',
    operation: 'update',
    path: '/users/userA/groups/grp_1',
    auth: { uid: 'userA', email: 'a@gmail.com', email_verified: true },
    payload: { ownerUid: 'userB' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-07',
    title: 'Client-forged timestamp on create',
    operation: 'create',
    path: '/users/userA/trustedIps/iphash123',
    auth: { uid: 'userA', email: 'a@gmail.com', email_verified: true },
    payload: { createdAt: '2020-01-01T00:00:00Z', updatedAt: '2020-01-01T00:00:00Z' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-08',
    title: 'Invalid path ID characters',
    operation: 'create',
    path: '/users/userA/documents/invalid.id$here',
    auth: { uid: 'userA', email: 'a@gmail.com', email_verified: true },
    payload: { ownerUid: 'userA', id: 'invalid.id$here' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-09',
    title: 'Oversized AssetChunk payload (>600KB)',
    operation: 'create',
    path: '/users/userA/assetChunks/doc_1__front__0',
    auth: { uid: 'userA', email: 'a@gmail.com', email_verified: true },
    payload: { ownerUid: 'userA', docId: 'doc_1', slot: 'front', index: 0, total: 1, data: 'x'.repeat(600001) },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-10',
    title: 'Orphaned AssetChunk pointing to missing document',
    operation: 'create',
    path: '/users/userA/assetChunks/missing__front__0',
    auth: { uid: 'userA', email: 'a@gmail.com', email_verified: true },
    payload: { ownerUid: 'userA', docId: 'missing', slot: 'front', index: 0, total: 1, data: 'abc' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-11',
    title: 'Root users collection listing attempt',
    operation: 'list',
    path: '/users',
    auth: { uid: 'userA', email: 'a@gmail.com', email_verified: true },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-12',
    title: 'Type confusion on TrustedIp trusted flag',
    operation: 'create',
    path: '/users/userA/trustedIps/iphash123',
    auth: { uid: 'userA', email: 'a@gmail.com', email_verified: true },
    payload: { ownerUid: 'userA', ipHash: 'iphash123', trusted: 'yes' },
    expected: 'PERMISSION_DENIED',
  },
];
