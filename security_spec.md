# Security Specification & Threat Model — MOSTAMSAKATI Cloud Vault

## 1. Data Invariants
1. **Strict Owner Isolation**: Every user document, group, image asset chunk, trusted IP record, device record, and cloud backup resides under `/users/{userId}/...` and requires `request.auth != null`, `request.auth.uid == userId`, and `request.auth.token.email_verified == true`.
2. **PII Isolation**: User emails and IP labels exist solely inside owner-scoped `/users/{userId}` and `/users/{userId}/trustedIps/{ipHash}` documents. There is NO `/users` list rule and no cross-user `get` access.
3. **Immutable Ownership & Timestamps**: On `create`, `ownerUid == request.auth.uid`, `createdAt == request.time`, and `updatedAt == request.time`. On `update`, `ownerUid` and `createdAt` are immutable, and `updatedAt == request.time`.
4. **Parent Existence**: Subcollection records (`trustedIps`, `devices`, `groups`, `documents`, `backups`) require `/users/{userId}` to exist. `assetChunks` require the parent `docId` to exist (`existsAfter`), and `backupChunks` require the parent `backupId` to exist (`existsAfter`).
5. **Volumetric & Key Hardening**: Every ID matches `^[a-zA-Z0-9_\-]+$` (<= 128 chars), every string enforces `.size()` limits, every `create` enforces `hasAll` + `hasOnly`, and every `update` enforces action-scoped `affectedKeys().hasOnly(...)`.

## 2. The "Dirty Dozen" Attack Payloads (Expected: PERMISSION_DENIED)
1. **Unauthenticated read/write** to `/users/{userId}/documents/{docId}` (`request.auth == null`).
2. **Cross-tenant read/list** on `/users/{otherUid}/documents` by authenticated User B (`uid != otherUid`).
3. **Email spoofing** with `email_verified: false` attempting to create `/users/{userId}` or `/users/{userId}/documents/{docId}`.
4. **Shadow/ghost field injection** (`isAdmin: true` or `extraField: "hack"`) on `create` or `update` of `VaultDocument` or `UserProfile`.
5. **Owner spoofing** on `create` (`ownerUid: "victim_uid"` while authenticated as `"attacker_uid"`).
6. **Immutable field mutation** on `update` (changing `ownerUid` or `createdAt` of a `VaultDocument` or `TrustedIp`).
7. **Timestamp forging** (`createdAt` or `updatedAt` set to a client-chosen past/future timestamp instead of `request.time`).
8. **ID Poisoning** (`docId` containing `/`, `.`, spaces, or > 128 chars).
9. **Denial-of-Wallet oversized string** (`notes` > 1000 chars or `AssetChunk.data` > 600000 chars).
10. **Orphaned AssetChunk** referencing a non-existent `docId`.
11. **User collection enumeration** (`list` on `/users` to scrape emails).
12. **Type confusion** (`sidesCount: "two"` or `widthMm: "85"` or `trusted: "yes"`).
