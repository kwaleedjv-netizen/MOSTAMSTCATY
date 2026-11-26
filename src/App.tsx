/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { DesktopMenuBar } from './components/DesktopMenuBar';
import { DesktopToolbar } from './components/DesktopToolbar';
import { DesktopSidebar, SidebarFilter } from './components/DesktopSidebar';
import { DocumentViewsCanvas } from './components/DocumentViewsCanvas';
import { LayoutModeProvider, useLayoutMode } from './hooks/useViewportMode';
import { MobileShell } from './components/mobile/MobileShell';
import { AddDocumentModal } from './components/AddDocumentModal';
import { DocumentDetailsModal } from './components/DocumentDetailsModal';
import { PrintStudioModal } from './components/PrintStudioModal';
import { GroupsModal } from './components/GroupsModal';
import { TrashBinModal } from './components/TrashBinModal';
import { BackupRestoreModal } from './components/BackupRestoreModal';
import { SettingsModal } from './components/SettingsModal';
import { AuditLogModal } from './components/AuditLogModal';
import { ConflictResolutionModal } from './components/ConflictResolutionModal';
import { ImportModal } from './components/ImportModal';
import { LockScreenModal } from './components/LockScreenModal';
import { ShortcutsModal } from './components/ShortcutsModal';
import { AboutModal } from './components/AboutModal';
import { UserGuideModal } from './components/UserGuideModal';
import { CustomDocumentModal } from './components/CustomDocumentModal';
import { ContextMenu, ContextMenuType } from './components/ContextMenu';

import {
  MostamsakDocument,
  DocumentGroup,
  AppSettings,
  ViewMode,
  CardSize,
  CustomTemplate,
  PrintItem,
  PrintSheetSettings,
} from './types';
import {
  getSheetDimensions,
  calculateNextPrintItemPosition,
} from './services/printEngine';
import { initializeDatabase, dbGetAll, dbPut, dbDelete, dbClear, recordAudit, loadSettings, saveSettings, calculateStorageUsage, DEFAULT_APP_SETTINGS } from './services/db';
import { syncEngine, SyncStatus } from './services/syncEngine';
import { auth, clearLocalVerifiedIpCache, detectCurrentNetworkIp, IpGateReason, NetworkIpInfo, registerTrustedIpAndDevice, registerWithEmail, removeTrustedIp, removeUserDevice, revokeTrustedIp, sanitizeFirestoreId, signInWithEmail, signInWithGooglePopup, signOutFromGoogle, subscribeCurrentIpTrust, subscribeSecurityInventory, TrustedIpRecord, updateRequireEmailOnNewIp, UserDeviceRecord, verifyNetworkAccess } from './services/firebase';
import { GoogleAuthGateModal } from './components/GoogleAuthGateModal';
import { ErrorBoundary } from './components/ErrorBoundary';
import { User, onAuthStateChanged } from 'firebase/auth';
import { readClipboardImage } from './services/imageProcessing';
import { FilePlus } from 'lucide-react';

export default function App() {
  return (
    <ErrorBoundary>
      <LayoutModeProvider>
        <AppContent />
      </LayoutModeProvider>
    </ErrorBoundary>
  );
}

function AppContent() {
  const { isMobile, isTablet, width: viewportWidth } = useLayoutMode();
  // === CORE DATA STATES ===
  const [documents, setDocuments] = useState<MostamsakDocument[]>([]);
  const [groups, setGroups] = useState<DocumentGroup[]>([]);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_APP_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);

  // === VIEW & SELECTION STATES ===
  const [searchQuery, setSearchQuery] = useState('');
  const [sidebarFilter, setSidebarFilter] = useState<SidebarFilter>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'dateAdded' | 'dateModified' | 'name' | 'type'>('dateAdded');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [cardSize, setCardSize] = useState<CardSize>('medium');
  const [selectedDocIds, setSelectedDocIds] = useState<Set<string>>(new Set());
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);

  useEffect(() => {
    if (isTablet && viewportWidth < 1024) {
      setShowSidebar(false);
    } else if (!isTablet && !isMobile) {
      setShowSidebar(true);
    }
  }, [isTablet, isMobile, viewportWidth]);

  // Clipboard for copy/cut/paste
  const [clipboardDoc, setClipboardDoc] = useState<MostamsakDocument | null>(null);

  // === SYSTEM & STORAGE STATES ===
  const [storageUsedBytes, setStorageUsedBytes] = useState(0);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(syncEngine.getStatus());
  const [isLocked, setIsLocked] = useState(false);

  // === GOOGLE AUTH & NEW IP SECURITY GATE STATES ===
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [isCheckingNetwork, setIsCheckingNetwork] = useState(true);
  const [currentIpInfo, setCurrentIpInfo] = useState<NetworkIpInfo | null>(null);
  const [ipGateReason, setIpGateReason] = useState<IpGateReason>('signin');
  const [requireEmailOnNewIp, setRequireEmailOnNewIp] = useState(true);
  const [trustedIps, setTrustedIps] = useState<TrustedIpRecord[]>([]);
  const [userDevices, setUserDevices] = useState<UserDeviceRecord[]>([]);
  const isAuthPopupActiveRef = React.useRef(false);
  const lastIpCheckTsRef = React.useRef(0);

  // === MODAL STATES ===
  const [isAddDocOpen, setIsAddDocOpen] = useState(false);
  const [editingDoc, setEditingDoc] = useState<MostamsakDocument | null>(null);
  const [pendingTemplate, setPendingTemplate] = useState<CustomTemplate | null>(null);
  const [inspectDoc, setInspectDoc] = useState<MostamsakDocument | null>(null);
  const [isPrintStudioOpen, setIsPrintStudioOpen] = useState(false);
  const [printItems, setPrintItems] = useState<PrintItem[]>([]);
  const [printSettings, setPrintSettings] = useState<PrintSheetSettings>({
    paperId: 'a4',
    customWidthMm: 210,
    customHeightMm: 297,
    orientation: 'portrait',
    marginsMm: 10,
    gridSnapMm: 5,
    showGrid: true,
    showRulers: true,
    showCutMarksAll: true,
    showLabelsAll: true,
    groupTwoSidedLock: true,
    duplexMode: 'single',
    targetDpi: 300,
  });
  const [isGroupsModalOpen, setIsGroupsModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<DocumentGroup | null>(null);
  const [isTrashOpen, setIsTrashOpen] = useState(false);
  const [isBackupOpen, setIsBackupOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'ui' | 'images' | 'storage' | 'security' | 'cloud' | 'reset'>('ui');
  const [isAuditLogOpen, setIsAuditLogOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const [isUserGuideOpen, setIsUserGuideOpen] = useState(false);
  const [isCustomDocOpen, setIsCustomDocOpen] = useState(false);

  // Context Menu State
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    menu: ContextMenuType;
  } | null>(null);

  // Refresh data from IndexedDB
  const reloadData = useCallback(async () => {
    const docs = await dbGetAll<MostamsakDocument>('documents');
    const grps = await dbGetAll<DocumentGroup>('groups');
    setDocuments(docs);
    setGroups(grps);

    const storage = await calculateStorageUsage();
    setStorageUsedBytes(storage.usedBytes);
  }, []);

  const hydrateVerifiedVault = useCallback(
    async (user: User, ipInfo: NetworkIpInfo, requireIpPrompt: boolean) => {
      const uid = sanitizeFirestoreId(user.uid);
      const prevUid = localStorage.getItem('mostamsakati_active_uid');

      if (prevUid && prevUid !== uid) {
        await dbClear('documents');
        await dbClear('groups');
        await dbClear('auditLogs');
        await dbClear('backups');
      }
      localStorage.setItem('mostamsakati_active_uid', uid);

      setRequireEmailOnNewIp(requireIpPrompt);
      setIpGateReason(null);
      syncEngine.setAccessContext(uid, true);

      if (navigator.onLine) {
        await syncEngine.syncNow();
      }

      const existingDocs = await dbGetAll<MostamsakDocument>('documents');
      const existingGrps = await dbGetAll<DocumentGroup>('groups');

      if (existingDocs.length === 0 && existingGrps.length === 0) {
        await initializeDatabase();
        if (navigator.onLine) {
          await syncEngine.syncNow();
        }
      }

      const loadedSettings = await loadSettings();
      setSettings({ ...loadedSettings, theme: 'light' });
      setViewMode(loadedSettings.viewMode || 'grid');
      setCardSize(loadedSettings.cardSize || 'medium');

      if (loadedSettings.hasMasterPassword) {
        setIsLocked(true);
      }

      await reloadData();
      await recordAudit(
        'login',
        user.email || uid,
        `تم التحقق عبر Google من عنوان الشبكة IP (${ipInfo.ip})`
      );
      setIsLoading(false);
      setIsCheckingNetwork(false);
      setAuthReady(true);
    },
    [reloadData]
  );

  const verifyUserAndIpAccess = useCallback(
    async (user: User | null) => {
      setIsCheckingNetwork(true);
      const ipInfo = await detectCurrentNetworkIp();
      setCurrentIpInfo(ipInfo);
      lastIpCheckTsRef.current = Date.now();

      if (!user || !user.emailVerified) {
        syncEngine.setAccessContext(null, false);
        setDocuments([]);
        setGroups([]);
        setTrustedIps([]);
        setUserDevices([]);
        setIpGateReason('signin');
        setAuthReady(true);
        setIsLoading(false);
        setIsCheckingNetwork(false);
        return;
      }

      try {
        const verdict = await verifyNetworkAccess(user, ipInfo);
        if (!verdict.allowed) {
          syncEngine.setAccessContext(user.uid, false);
          setDocuments([]);
          setGroups([]);
          setIpGateReason(verdict.reason || 'new_ip');
          setAuthReady(true);
          setIsLoading(false);
          setIsCheckingNetwork(false);
          return;
        }

        await hydrateVerifiedVault(
          user,
          ipInfo,
          verdict.profile?.requireEmailOnNewIp ?? true
        );
      } catch (err) {
        console.error('Network verification error:', err);
        syncEngine.setAccessContext(user.uid, false);
        setIpGateReason('new_ip');
        setAuthReady(true);
        setIsLoading(false);
        setIsCheckingNetwork(false);
      }
    },
    [hydrateVerifiedVault]
  );

  // Firebase Auth listener + SyncEngine listener
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      if (isAuthPopupActiveRef.current) {
        return;
      }
      void verifyUserAndIpAccess(user);
    });

    const unsubscribeSync = syncEngine.subscribe((status) => {
      setSyncStatus(status);
      if (status.state === 'synced') {
        void reloadData();
      }
    });

    return () => {
      unsubscribeAuth();
      unsubscribeSync();
    };
  }, [reloadData, verifyUserAndIpAccess]);

  // Real-time Firestore watch for trusted IP revocation & devices inventory
  useEffect(() => {
    if (!authReady || !firebaseUser || ipGateReason !== null) {
      return;
    }

    const unsubInventory = subscribeSecurityInventory(firebaseUser.uid, ({ trustedIps: ips, devices }) => {
      setTrustedIps(ips);
      setUserDevices(devices);
    });

    let unsubIpWatch: (() => void) | undefined;
    if (currentIpInfo && !currentIpInfo.isOffline) {
      unsubIpWatch = subscribeCurrentIpTrust(firebaseUser.uid, currentIpInfo.ipHash, (reason) => {
        syncEngine.setAccessContext(firebaseUser.uid, false);
        setDocuments([]);
        setGroups([]);
        setIpGateReason(reason);
      });
    }

    return () => {
      unsubInventory();
      unsubIpWatch?.();
    };
  }, [authReady, firebaseUser, ipGateReason, currentIpInfo]);

  // Continuous IP-change monitor on network reconnect, focus, or tab resume
  useEffect(() => {
    if (!firebaseUser || ipGateReason !== null) return;

    const checkForIpShift = async () => {
      if (Date.now() - lastIpCheckTsRef.current < 5000) return;
      lastIpCheckTsRef.current = Date.now();
      const latestIp = await detectCurrentNetworkIp();
      setCurrentIpInfo(latestIp);
      if (latestIp.isOffline) return;

      const verdict = await verifyNetworkAccess(firebaseUser, latestIp);
      if (!verdict.allowed) {
        syncEngine.setAccessContext(firebaseUser.uid, false);
        setDocuments([]);
        setGroups([]);
        setIpGateReason(verdict.reason || 'ip_changed');
      }
    };

    const handleOnline = () => void checkForIpShift();
    const handleFocus = () => void checkForIpShift();
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        void checkForIpShift();
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [firebaseUser, ipGateReason]);

  const handleAuthenticateWithGoogle = async () => {
    isAuthPopupActiveRef.current = true;
    try {
      const authedUser = await signInWithGooglePopup();
      setFirebaseUser(authedUser);
      const ipInfo = await detectCurrentNetworkIp();
      setCurrentIpInfo(ipInfo);
      await registerTrustedIpAndDevice(authedUser, ipInfo, settings.cloudDeviceName);
      await hydrateVerifiedVault(authedUser, ipInfo, true);
    } finally {
      isAuthPopupActiveRef.current = false;
    }
  };

  const handleAuthenticateWithEmail = async (
    email: string,
    password: string,
    mode: 'signin' | 'register'
  ) => {
    isAuthPopupActiveRef.current = true;
    try {
      if (mode === 'register') {
        await registerWithEmail(email, password);
        return;
      }
      const authedUser = await signInWithEmail(email, password);
      setFirebaseUser(authedUser);
      const ipInfo = await detectCurrentNetworkIp();
      setCurrentIpInfo(ipInfo);
      await registerTrustedIpAndDevice(authedUser, ipInfo, settings.cloudDeviceName);
      await hydrateVerifiedVault(authedUser, ipInfo, true);
    } finally {
      isAuthPopupActiveRef.current = false;
    }
  };

  const handleSignOutGoogle = async () => {
    syncEngine.setAccessContext(null, false);
    if (firebaseUser) {
      clearLocalVerifiedIpCache(firebaseUser.uid);
    }
    await signOutFromGoogle();
    setDocuments([]);
    setGroups([]);
    setTrustedIps([]);
    setUserDevices([]);
    setIpGateReason('signin');
  };

  // Auto-lock timer based on user settings
  useEffect(() => {
    if (!settings.hasMasterPassword || !settings.autoLockMinutes || settings.autoLockMinutes <= 0) {
      return;
    }

    let timeoutId: any;
    const resetTimer = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        setIsLocked(true);
      }, settings.autoLockMinutes * 60 * 1000);
    };

    window.addEventListener('mousemove', resetTimer);
    window.addEventListener('keydown', resetTimer);
    window.addEventListener('touchstart', resetTimer, { passive: true });
    window.addEventListener('pointerdown', resetTimer, { passive: true });
    resetTimer();

    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('mousemove', resetTimer);
      window.removeEventListener('keydown', resetTimer);
      window.removeEventListener('touchstart', resetTimer);
      window.removeEventListener('pointerdown', resetTimer);
    };
  }, [settings.hasMasterPassword, settings.autoLockMinutes]);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') {
        if (e.key === 'Escape') {
          target.blur();
        }
        return;
      }

      const isCtrlOrCmd = e.ctrlKey || e.metaKey;

      if (isCtrlOrCmd && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        setIsAddDocOpen(true);
      } else if (isCtrlOrCmd && e.key.toLowerCase() === 'g') {
        e.preventDefault();
        setEditingGroup(null);
        setIsGroupsModalOpen(true);
      } else if (isCtrlOrCmd && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        const searchInput = document.getElementById('global-search-input');
        searchInput?.focus();
      } else if (isCtrlOrCmd && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        handleSelectAll();
      } else if (isCtrlOrCmd && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        setIsPrintStudioOpen(true);
      } else if (isCtrlOrCmd && e.key.toLowerCase() === 'e') {
        e.preventDefault();
        handleExportSelected();
      } else if (isCtrlOrCmd && e.key.toLowerCase() === 'l') {
        e.preventDefault();
        if (settings.hasMasterPassword) {
          setIsLocked(true);
        }
      } else if (e.key === 'Delete') {
        if (selectedDocIds.size > 0) {
          e.preventDefault();
          handleBatchTrash();
        }
      } else if (e.key === 'F1') {
        e.preventDefault();
        setIsShortcutsOpen(true);
      } else if (e.key === 'F2') {
        if (selectedDocIds.size === 1) {
          e.preventDefault();
          const docId = Array.from(selectedDocIds)[0];
          const doc = documents.find((d) => d.id === docId);
          if (doc) setInspectDoc(doc);
        }
      } else if (e.key === 'Escape') {
        setSelectedDocIds(new Set());
        setContextMenu(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  // Groups and Counts Mapping
  const groupCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const doc of documents) {
      if (!doc.isDeleted && doc.groupId) {
        counts[doc.groupId] = (counts[doc.groupId] || 0) + 1;
      }
    }
    return counts;
  }, [documents]);

  const activeDocuments = useMemo(() => {
    return documents.filter((d) => !d.isDeleted && !d.isArchived);
  }, [documents]);

  const trashDocuments = useMemo(() => {
    return documents.filter((d) => d.isDeleted);
  }, [documents]);

  const archivedDocuments = useMemo(() => {
    return documents.filter((d) => !d.isDeleted && d.isArchived);
  }, [documents]);

  const sidebarCounts = useMemo(() => {
    const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return {
      all: activeDocuments.length,
      favorites: activeDocuments.filter((d) => d.isFavorite).length,
      recentAdded: activeDocuments.filter((d) => new Date(d.createdAt).getTime() > oneWeekAgo).length,
      recentModified: activeDocuments.filter((d) => new Date(d.updatedAt || d.createdAt).getTime() > oneWeekAgo).length,
      archived: archivedDocuments.length,
      trash: trashDocuments.length,
      groupCounts,
    };
  }, [activeDocuments, archivedDocuments, trashDocuments, groupCounts]);

  // Filtering & Sorting
  const filteredAndSortedDocs = useMemo(() => {
    let result = documents;

    // 1. Sidebar filter
    if (sidebarFilter === 'all') {
      result = result.filter((d) => !d.isDeleted && !d.isArchived);
    } else if (sidebarFilter === 'favorites') {
      result = result.filter((d) => !d.isDeleted && !d.isArchived && d.isFavorite);
    } else if (sidebarFilter === 'recent_added') {
      const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      result = result.filter((d) => !d.isDeleted && !d.isArchived && new Date(d.createdAt).getTime() > oneWeekAgo);
    } else if (sidebarFilter === 'recent_modified') {
      const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      result = result.filter(
        (d) => !d.isDeleted && !d.isArchived && new Date(d.updatedAt || d.createdAt).getTime() > oneWeekAgo
      );
    } else if (sidebarFilter === 'archived') {
      result = result.filter((d) => !d.isDeleted && d.isArchived);
    } else if (sidebarFilter === 'trash') {
      result = result.filter((d) => d.isDeleted);
    } else if (sidebarFilter.startsWith('group_')) {
      const gId = sidebarFilter.replace('group_', '');
      result = result.filter((d) => !d.isDeleted && !d.isArchived && d.groupId === gId);
    }

    // 2. Type Filter
    if (typeFilter !== 'all') {
      result = result.filter((d) => d.typeId === typeFilter);
    }

    // 3. Search Query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter((d) => {
        const titleMatch = d.title.toLowerCase().includes(query);
        const typeMatch = d.typeName.toLowerCase().includes(query);
        const notesMatch = d.notes?.toLowerCase().includes(query);
        const grp = groups.find((g) => g.id === d.groupId);
        const groupMatch = grp?.name.toLowerCase().includes(query);
        return titleMatch || typeMatch || notesMatch || groupMatch;
      });
    }

    // 4. Sorting
    return [...result].sort((a, b) => {
      let cmp = 0;
      if (sortBy === 'dateAdded') {
        cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      } else if (sortBy === 'dateModified') {
        cmp = new Date(a.updatedAt || a.createdAt).getTime() - new Date(b.updatedAt || b.createdAt).getTime();
      } else if (sortBy === 'name') {
        cmp = a.title.localeCompare(b.title, 'ar');
      } else if (sortBy === 'type') {
        cmp = a.typeName.localeCompare(b.typeName, 'ar');
      }
      return sortOrder === 'asc' ? cmp : -cmp;
    });
  }, [documents, sidebarFilter, typeFilter, searchQuery, sortBy, sortOrder, groups]);

  // === DOCUMENT CRUD ACTIONS ===

  const handleSaveNewDocument = async (docData: Omit<MostamsakDocument, 'id' | 'createdAt' | 'updatedAt'>) => {
    const now = new Date().toISOString();
    const newDoc: MostamsakDocument = {
      ...docData,
      id: 'doc_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      createdAt: now,
      updatedAt: now,
      historyLogs: [
        {
          id: 'log_create_' + Date.now(),
          timestamp: now,
          action: 'إضافة المستمسك إلى الخزانة',
        },
      ],
    };

    await dbPut('documents', newDoc);
    await recordAudit('doc_create', newDoc.title, `تمت إضافة مستمسك (${newDoc.typeName}) بنجاح`);
    await reloadData();
    void syncEngine.pushDocumentNow(newDoc);
  };

  const handleUpdateDocument = async (updatedDoc: MostamsakDocument) => {
    const now = new Date().toISOString();
    const docWithLog: MostamsakDocument = {
      ...updatedDoc,
      updatedAt: now,
      historyLogs: [
        ...(updatedDoc.historyLogs || []),
        {
          id: 'log_update_' + Date.now(),
          timestamp: now,
          action: 'تعديل بيانات المستمسك',
        },
      ],
    };

    await dbPut('documents', docWithLog);
    await recordAudit('doc_update', docWithLog.title, `تم تحديث بيانات المستمسك`);
    await reloadData();
    if (inspectDoc && inspectDoc.id === docWithLog.id) {
      setInspectDoc(docWithLog);
    }
    void syncEngine.pushDocumentNow(docWithLog);
  };

  const handleToggleFavorite = async (doc: MostamsakDocument, e?: React.MouseEvent) => {
    e?.stopPropagation();
    await handleUpdateDocument({
      ...doc,
      isFavorite: !doc.isFavorite,
    });
  };

  const handleDuplicateDocument = async (doc: MostamsakDocument) => {
    const now = new Date().toISOString();
    const duplicateDoc: MostamsakDocument = {
      ...doc,
      id: 'doc_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      title: `${doc.title} (نسخة)`,
      createdAt: now,
      updatedAt: now,
      historyLogs: [
        {
          id: 'log_dup_' + Date.now(),
          timestamp: now,
          action: `إنشاء نسخة من المستمسك الأصل (${doc.title})`,
        },
      ],
    };

    await dbPut('documents', duplicateDoc);
    await recordAudit('doc_create', duplicateDoc.title, `تم تكرار المستمسك`);
    await reloadData();
    void syncEngine.pushDocumentNow(duplicateDoc);
  };

  const handleTrashDocument = async (doc: MostamsakDocument) => {
    const now = new Date().toISOString();
    const trashedDoc: MostamsakDocument = {
      ...doc,
      isDeleted: true,
      deletedAt: now,
      previousGroupId: doc.groupId,
      updatedAt: now,
      historyLogs: [
        ...(doc.historyLogs || []),
        {
          id: 'log_trash_' + Date.now(),
          timestamp: now,
          action: 'نقل المستمسك إلى سلة المحذوفات',
        },
      ],
    };

    await dbPut('documents', trashedDoc);
    await recordAudit('doc_trash', doc.title, 'تم نقل المستمسك لسلة المحذوفات');
    await reloadData();
    setSelectedDocIds((prev) => {
      const next = new Set(prev);
      next.delete(doc.id);
      return next;
    });
    void syncEngine.pushDocumentNow(trashedDoc);
  };

  const handleBatchTrash = async () => {
    for (const id of selectedDocIds) {
      const doc = documents.find((d) => d.id === id);
      if (doc) await handleTrashDocument(doc);
    }
    setSelectedDocIds(new Set());
  };

  const handleRestoreFromTrash = async (docId: string) => {
    const doc = documents.find((d) => d.id === docId);
    if (!doc) return;
    const now = new Date().toISOString();
    const restoredDoc: MostamsakDocument = {
      ...doc,
      isDeleted: false,
      deletedAt: undefined,
      groupId: doc.previousGroupId || doc.groupId,
      updatedAt: now,
      historyLogs: [
        ...(doc.historyLogs || []),
        {
          id: 'log_restore_' + Date.now(),
          timestamp: now,
          action: 'استعادة المستمسك من سلة المحذوفات',
        },
      ],
    };
    await dbPut('documents', restoredDoc);
    await recordAudit('doc_restore', doc.title, 'تمت استعادة المستمسك من السلة');
    await reloadData();
    void syncEngine.pushDocumentNow(restoredDoc);
  };

  const handleRestoreAllTrash = async () => {
    for (const doc of trashDocuments) {
      await handleRestoreFromTrash(doc.id);
    }
  };

  const handlePermanentDelete = async (docId: string) => {
    const doc = documents.find((d) => d.id === docId);
    await dbDelete('documents', docId);
    await recordAudit('doc_permanent_delete', doc?.title || docId, 'حذف نهائي لا رجعة فيه من القرص والسحابة');
    await reloadData();
    void syncEngine.deleteDocumentFromCloud(docId);
  };

  const handleEmptyTrash = async () => {
    const deletedIds = trashDocuments.map((d) => d.id);
    for (const doc of trashDocuments) {
      await dbDelete('documents', doc.id);
    }
    await recordAudit('doc_permanent_delete', 'سلة المحذوفات', 'تم إفراغ سلة المحذوفات بالكامل');
    await reloadData();
    await Promise.all(deletedIds.map((id) => syncEngine.deleteDocumentFromCloud(id)));
  };

  // Group Handlers
  const handleSaveGroup = async (group: DocumentGroup) => {
    await dbPut('groups', group);
    await recordAudit('group_create', group.name, 'تم حفظ المجموعة وتحديثها');
    await reloadData();
    void syncEngine.pushGroupNow(group);
  };

  const handleDeleteGroup = async (groupId: string, targetGroupId?: string) => {
    const modifiedDocs: MostamsakDocument[] = [];
    for (const doc of documents) {
      if (doc.groupId === groupId) {
        const updatedDoc = {
          ...doc,
          groupId: targetGroupId || undefined,
          updatedAt: new Date().toISOString(),
        };
        await dbPut('documents', updatedDoc);
        modifiedDocs.push(updatedDoc);
      }
    }
    await dbDelete('groups', groupId);
    await recordAudit('group_delete', groupId, 'تم حذف المجموعة مع الحفاظ على مستمسكاتها بأمان');
    await reloadData();
    await Promise.all(modifiedDocs.map((d) => syncEngine.pushDocumentNow(d)));
    void syncEngine.deleteGroupFromCloud(groupId);
  };

  // Batch Selection Handlers
  const handleSelectDoc = (doc: MostamsakDocument, isMulti: boolean) => {
    if (isMulti || isMultiSelectMode) {
      setSelectedDocIds((prev) => {
        const next = new Set(prev);
        if (next.has(doc.id)) next.delete(doc.id);
        else next.add(doc.id);
        return next;
      });
    } else {
      setSelectedDocIds(new Set([doc.id]));
    }
  };

  const handleSelectAll = () => {
    if (selectedDocIds.size === filteredAndSortedDocs.length) {
      setSelectedDocIds(new Set());
    } else {
      setSelectedDocIds(new Set(filteredAndSortedDocs.map((d) => d.id)));
    }
  };

  const handleDeselectAll = () => {
    setSelectedDocIds(new Set());
  };

  // Export Selected / All
  const handleExportSelected = () => {
    const targetDocs =
      selectedDocIds.size > 0
        ? documents.filter((d) => selectedDocIds.has(d.id))
        : filteredAndSortedDocs;

    if (targetDocs.length === 0) return;

    if (targetDocs.length === 1) {
      const doc = targetDocs[0];
      const link = document.createElement('a');
      link.download = `${doc.title}_${doc.widthMm}x${doc.heightMm}mm.png`;
      link.href = doc.frontImage;
      link.click();
    } else {
      setIsPrintStudioOpen(true);
    }
  };

  // Direct Print: sends document directly to print sheet, placing underneath existing items
  const handleDirectPrint = useCallback(
    (doc: MostamsakDocument) => {
      const { widthMm: sheetWidthMm, heightMm: sheetHeightMm } = getSheetDimensions(printSettings);
      const isTwoSides = doc.sidesCount === 2 && Boolean(doc.backImage);

      const pos = calculateNextPrintItemPosition(
        printItems,
        doc.widthMm,
        doc.heightMm,
        isTwoSides,
        sheetWidthMm,
        sheetHeightMm,
        printSettings.marginsMm
      );

      const newItemsToAdd: PrintItem[] = [];
      const pairGroupId =
        isTwoSides && pos.back
          ? 'pair_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6)
          : undefined;

      // 1. Front Face
      const frontItem: PrintItem = {
        id: 'item_' + Date.now() + '_front_' + Math.random().toString(36).substring(2, 6),
        documentId: doc.id,
        groupId: pairGroupId,
        face: 'front',
        pageIndex: 0,
        xMm: pos.front.x,
        yMm: pos.front.y,
        widthMm: doc.widthMm,
        heightMm: doc.heightMm,
        rotation: 0,
        showBorder: false,
        showCutMarks: true,
        showLabel: true,
        label: `${doc.title} (${doc.frontLabel || 'الوجه الأمامي'})`,
      };
      newItemsToAdd.push(frontItem);

      // 2. Back Face (placed side-by-side)
      if (isTwoSides && pos.back) {
        const backItem: PrintItem = {
          id: 'item_' + Date.now() + '_back_' + Math.random().toString(36).substring(2, 6),
          documentId: doc.id,
          groupId: pairGroupId,
          face: 'back',
          pageIndex: 0,
          xMm: pos.back.x,
          yMm: pos.back.y,
          widthMm: doc.widthMm,
          heightMm: doc.heightMm,
          rotation: 0,
          showBorder: false,
          showCutMarks: true,
          showLabel: true,
          label: `${doc.title} (${doc.backLabel || 'الوجه الخلفي'})`,
        };
        newItemsToAdd.push(backItem);
      }

      setPrintItems((prev) => [...prev, ...newItemsToAdd]);
      setIsPrintStudioOpen(true);
    },
    [printItems, printSettings]
  );

  const handleExportAll = () => {
    if (documents.length === 0) return;
    handleDirectPrint(documents[0]);
  };

  const handleDownloadDocument = useCallback((doc: MostamsakDocument) => {
    const src = doc.coverFace === 'back' && doc.backImage ? doc.backImage : doc.frontImage;
    if (!src) return;

    const triggerDownload = (href: string, filename: string) => {
      const link = document.createElement('a');
      link.download = filename;
      link.href = href;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    };

    if (src.startsWith('data:image/svg+xml')) {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || 856;
        canvas.height = img.naturalHeight || 540;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          triggerDownload(canvas.toDataURL('image/png'), `${doc.title}.png`);
        } else {
          triggerDownload(src, `${doc.title}.svg`);
        }
      };
      img.onerror = () => triggerDownload(src, `${doc.title}.svg`);
      img.src = src;
    } else {
      triggerDownload(src, `${doc.title}.png`);
    }
  }, []);

  // Clipboard actions
  const handleCopy = () => {
    if (selectedDocIds.size > 0) {
      const firstId = Array.from(selectedDocIds)[0];
      const doc = documents.find((d) => d.id === firstId);
      if (doc) setClipboardDoc(doc);
    }
  };

  const handleCut = () => {
    if (selectedDocIds.size > 0) {
      const firstId = Array.from(selectedDocIds)[0];
      const doc = documents.find((d) => d.id === firstId);
      if (doc) {
        setClipboardDoc(doc);
        handleTrashDocument(doc);
      }
    }
  };

  const handlePaste = async () => {
    if (clipboardDoc) {
      await handleDuplicateDocument(clipboardDoc);
    } else {
      // Try reading image from system clipboard
      const imgData = await readClipboardImage();
      if (imgData) {
        setIsAddDocOpen(true);
      }
    }
  };

  // Settings & Factory Reset
  const handleSaveSettings = async (newSettings: AppSettings) => {
    setSettings(newSettings);
    setViewMode(newSettings.viewMode);
    setCardSize(newSettings.cardSize);
    await saveSettings(newSettings);
  };

  const handleResetSettingsOnly = async () => {
    await saveSettings(DEFAULT_APP_SETTINGS);
    setSettings(DEFAULT_APP_SETTINGS);
    setViewMode('grid');
    setCardSize('medium');
    await recordAudit('security_change', 'الإعدادات', 'تمت استعادة الإعدادات الافتراضية للتطبيق');
  };

  const handleFactoryResetWipeAll = async () => {
    if (firebaseUser) {
      try {
        await syncEngine.wipeUserCloudVault(firebaseUser.uid);
      } catch (err) {
        console.error('Failed to wipe cloud vault:', err);
      }
    }
    await dbClear('documents');
    await dbClear('groups');
    await dbClear('auditLogs');
    await dbClear('customTemplates');
    await dbClear('backups');
    await saveSettings(DEFAULT_APP_SETTINGS);

    setDocuments([]);
    setGroups([]);
    setSettings(DEFAULT_APP_SETTINGS);
    setIsLocked(false);
    await calculateStorageUsage();
    window.location.reload();
  };

  // Right-Click Context Menus (Section 6)
  const handleDocumentContextMenu = (e: React.MouseEvent, doc: MostamsakDocument) => {
    e.preventDefault();
    e.stopPropagation();
    if (!selectedDocIds.has(doc.id)) {
      setSelectedDocIds(new Set([doc.id]));
    }
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      menu: { kind: 'document', document: doc },
    });
  };

  const handleGroupContextMenu = (e: React.MouseEvent, group: DocumentGroup) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      menu: { kind: 'group', group },
    });
  };

  const handleCanvasContextMenu = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.document-card-item')) return;
    e.preventDefault();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      menu: { kind: 'canvas' },
    });
  };

  const selectedDocument = useMemo(() => {
    if (selectedDocIds.size === 1) {
      const docId = Array.from(selectedDocIds)[0];
      return documents.find((d) => d.id === docId);
    }
    return null;
  }, [selectedDocIds, documents]);

  const isGateBlocked = !authReady || !firebaseUser || ipGateReason !== null;

  if (isGateBlocked) {
    return (
      <GoogleAuthGateModal
        isLoading={!authReady || isCheckingNetwork}
        user={firebaseUser}
        reason={ipGateReason}
        ipInfo={currentIpInfo}
        onAuthenticateWithGoogle={handleAuthenticateWithGoogle}
        onAuthenticateWithEmail={handleAuthenticateWithEmail}
        onSignOut={handleSignOutGoogle}
        onRetryIpCheck={() => verifyUserAndIpAccess(firebaseUser)}
      />
    );
  }

  return (
    <>
      {isMobile ? (
        <MobileShell
          documents={filteredAndSortedDocs}
          allDocumentsCount={activeDocuments.length}
          groups={groups}
          counts={sidebarCounts}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          sidebarFilter={sidebarFilter}
          onSelectFilter={(f) => {
            setSidebarFilter(f);
            setSelectedDocIds(new Set());
          }}
          typeFilter={typeFilter}
          onChangeTypeFilter={setTypeFilter}
          sortBy={sortBy}
          onChangeSortBy={setSortBy}
          sortOrder={sortOrder}
          onToggleSortOrder={() => setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'))}
          viewMode={viewMode}
          onChangeViewMode={(mode) => {
            setViewMode(mode);
            saveSettings({ ...settings, viewMode: mode });
          }}
          cardSize={cardSize}
          onChangeCardSize={(size) => {
            setCardSize(size);
            saveSettings({ ...settings, cardSize: size });
          }}
          selectedDocIds={selectedDocIds}
          isMultiSelectMode={isMultiSelectMode}
          onToggleMultiSelect={() => setIsMultiSelectMode((v) => !v)}
          onSelectDoc={handleSelectDoc}
          onSelectAll={handleSelectAll}
          onDeselectAll={handleDeselectAll}
          hasClipboardDoc={Boolean(clipboardDoc)}
          storageUsedBytes={storageUsedBytes}
          syncStatus={syncStatus}
          hasMasterPassword={settings.hasMasterPassword}
          userEmail={firebaseUser?.email}
          currentIp={currentIpInfo?.ip}
          onManualSync={() => void syncEngine.syncNow()}
          onLockVault={() => {
            if (settings.hasMasterPassword) setIsLocked(true);
            else {
              setSettingsTab('security');
              setIsSettingsOpen(true);
            }
          }}
          onRefresh={reloadData}
          onSignOutGoogle={() => void handleSignOutGoogle()}
          onOpenDoc={(d) => setInspectDoc(d)}
          onEditDocInStudio={(d) => {
            setEditingDoc(d);
            setIsAddDocOpen(true);
          }}
          onDirectPrint={handleDirectPrint}
          onDownloadDoc={handleDownloadDocument}
          onDuplicateDoc={handleDuplicateDocument}
          onCopyDoc={(d) => setClipboardDoc(d)}
          onCutDoc={(d) => {
            setClipboardDoc(d);
            handleTrashDocument(d);
          }}
          onToggleFavorite={handleToggleFavorite}
          onToggleCoverFace={async (d) => {
            if (d.sidesCount === 2) {
              await handleUpdateDocument({
                ...d,
                coverFace: d.coverFace === 'front' ? 'back' : 'front',
              });
            }
          }}
          onToggleArchive={async (d) => {
            await handleUpdateDocument({ ...d, isArchived: !d.isArchived });
          }}
          onMoveToGroup={async (d, gId) => {
            await handleUpdateDocument({ ...d, groupId: gId });
          }}
          onTrashDoc={handleTrashDocument}
          onBatchTrash={handleBatchTrash}
          onBatchArchive={async () => {
            for (const id of selectedDocIds) {
              const doc = documents.find((d) => d.id === id);
              if (doc) await handleUpdateDocument({ ...doc, isArchived: !doc.isArchived });
            }
            setSelectedDocIds(new Set());
          }}
          onExportSelected={handleExportSelected}
          onExportAll={handleExportAll}
          onCreateGroup={() => {
            setEditingGroup(null);
            setIsGroupsModalOpen(true);
          }}
          onEditGroup={(g) => {
            setEditingGroup(g);
            setIsGroupsModalOpen(true);
          }}
          onAddDocToGroup={(g) => {
            setSidebarFilter(`group_${g.id}`);
            setIsAddDocOpen(true);
          }}
          onPrintGroup={(g) => {
            setSelectedDocIds(new Set(documents.filter((d) => d.groupId === g.id && !d.isDeleted).map((d) => d.id)));
            setIsPrintStudioOpen(true);
          }}
          onToggleLockGroup={async (g) => {
            await handleSaveGroup({ ...g, isLocked: !g.isLocked });
          }}
          onDeleteGroup={(g) => {
            setEditingGroup(g);
            setIsGroupsModalOpen(true);
          }}
          onNewDocument={() => setIsAddDocOpen(true)}
          onImport={() => setIsImportOpen(true)}
          onCustomTemplate={() => setIsCustomDocOpen(true)}
          onPaste={handlePaste}
          onOpenPrintStudio={() => {
            if (selectedDocument) handleDirectPrint(selectedDocument);
            else setIsPrintStudioOpen(true);
          }}
          onBackup={() => setIsBackupOpen(true)}
          onOpenTrash={() => setIsTrashOpen(true)}
          onManageTemplates={() => setIsCustomDocOpen(true)}
          onManageGroups={() => setIsGroupsModalOpen(true)}
          onOpenAuditLog={() => setIsAuditLogOpen(true)}
          onOpenSettingsTab={(tab) => {
            setSettingsTab(tab);
            setIsSettingsOpen(true);
          }}
          onOpenUserGuide={() => setIsUserGuideOpen(true)}
          onOpenShortcuts={() => setIsShortcutsOpen(true)}
          onOpenAbout={() => setIsAboutOpen(true)}
        />
      ) : (
        <div
          className="flex flex-col h-[100dvh] w-screen bg-white text-slate-800 select-none overflow-hidden font-['Cairo',system-ui,sans-serif]"
          dir="rtl"
          onContextMenu={handleCanvasContextMenu}
          onClick={() => setContextMenu(null)}
        >
      {/* 1. Main Menu Bar (Section 2) */}
      <DesktopMenuBar
        onNewDocument={() => setIsAddDocOpen(true)}
        onNewGroup={() => {
          setEditingGroup(null);
          setIsGroupsModalOpen(true);
        }}
        onImport={() => setIsImportOpen(true)}
        onExportAll={handleExportAll}
        onExportSelected={handleExportSelected}
        onBackup={() => setIsBackupOpen(true)}
        onRestore={() => setIsBackupOpen(true)}
        onPrint={() => {
          if (selectedDocument) handleDirectPrint(selectedDocument);
          else setIsPrintStudioOpen(true);
        }}
        onFactoryReset={() => {
          setSettingsTab('reset');
          setIsSettingsOpen(true);
        }}
        onLockVault={() => {
          if (settings.hasMasterPassword) setIsLocked(true);
          else {
            setSettingsTab('security');
            setIsSettingsOpen(true);
          }
        }}
        onUndo={() => {}}
        onRedo={() => {}}
        onCut={handleCut}
        onCopy={handleCopy}
        onPaste={handlePaste}
        onSelectAll={handleSelectAll}
        onDeselectAll={handleDeselectAll}
        onDeleteSelected={handleBatchTrash}
        onRenameSelected={() => {
          if (selectedDocument) setInspectDoc(selectedDocument);
        }}
        viewMode={viewMode}
        onChangeViewMode={(mode) => {
          setViewMode(mode);
          saveSettings({ ...settings, viewMode: mode });
        }}
        cardSize={cardSize}
        onChangeCardSize={(size) => {
          setCardSize(size);
          saveSettings({ ...settings, cardSize: size });
        }}
        sortBy={sortBy}
        onChangeSortBy={(s) => setSortBy(s)}
        showSidebar={showSidebar}
        onToggleSidebar={() => setShowSidebar(!showSidebar)}
        onRefresh={reloadData}
        onEditDocument={() => {
          if (selectedDocument) setInspectDoc(selectedDocument);
        }}
        onMoveToGroup={() => {
          if (selectedDocument) setInspectDoc(selectedDocument);
        }}
        onToggleCoverFace={async () => {
          if (selectedDocument && selectedDocument.sidesCount === 2) {
            await handleUpdateDocument({
              ...selectedDocument,
              coverFace: selectedDocument.coverFace === 'front' ? 'back' : 'front',
            });
          }
        }}
        onToggleFavorite={async () => {
          if (selectedDocument) await handleToggleFavorite(selectedDocument);
        }}
        onArchiveSelected={async () => {
          for (const id of selectedDocIds) {
            const doc = documents.find((d) => d.id === id);
            if (doc) await handleUpdateDocument({ ...doc, isArchived: !doc.isArchived });
          }
        }}
        onOpenTrash={() => setIsTrashOpen(true)}
        onOpenImageEditor={() => {
          if (selectedDocument) setInspectDoc(selectedDocument);
          else setIsAddDocOpen(true);
        }}
        onOpenPrintStudio={() => {
          if (selectedDocument) handleDirectPrint(selectedDocument);
          else setIsPrintStudioOpen(true);
        }}
        onManageDimensions={() => setIsCustomDocOpen(true)}
        onManageTemplates={() => setIsCustomDocOpen(true)}
        onManageGroups={() => setIsGroupsModalOpen(true)}
        onOpenAuditLog={() => setIsAuditLogOpen(true)}
        onOpenSettingsTab={(tab) => {
          setSettingsTab(tab);
          setIsSettingsOpen(true);
        }}
        onOpenUserGuide={() => setIsUserGuideOpen(true)}
        onOpenShortcuts={() => setIsShortcutsOpen(true)}
        onOpenAbout={() => setIsAboutOpen(true)}
        selectedCount={selectedDocIds.size}
        hasMasterPassword={settings.hasMasterPassword}
        userEmail={firebaseUser?.email}
        userPhotoUrl={firebaseUser?.photoURL}
        currentIp={currentIpInfo?.ip}
      />

      {/* 2. Main Desktop Toolbar (Section 3) */}
      <DesktopToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        viewMode={viewMode}
        onChangeViewMode={(mode) => {
          setViewMode(mode);
          saveSettings({ ...settings, viewMode: mode });
        }}
        typeFilter={typeFilter}
        onChangeTypeFilter={setTypeFilter}
        isMultiSelectMode={isMultiSelectMode}
        onToggleMultiSelect={() => setIsMultiSelectMode(!isMultiSelectMode)}
        selectedCount={selectedDocIds.size}
        onImport={() => setIsImportOpen(true)}
        onExport={handleExportSelected}
        onPrint={() => {
          if (selectedDocument) handleDirectPrint(selectedDocument);
          else setIsPrintStudioOpen(true);
        }}
        onBackup={() => setIsBackupOpen(true)}
        onAuditLog={() => setIsAuditLogOpen(true)}
        syncStatus={syncStatus}
        onManualSync={() => syncEngine.syncNow()}
        showSidebar={showSidebar}
        onToggleSidebar={() => setShowSidebar(!showSidebar)}
      />

      {/* 3. Main Workstation Area: Sidebar + Documents Workspace */}
      <div className="flex-1 min-h-0 flex overflow-hidden bg-slate-50">
        {/* Sidebar (Section 4) */}
        <DesktopSidebar
          currentFilter={sidebarFilter}
          onSelectFilter={(f) => {
            setSidebarFilter(f);
            setSelectedDocIds(new Set());
          }}
          groups={groups}
          counts={sidebarCounts}
          onAddDocument={() => setIsAddDocOpen(true)}
          onCreateGroup={() => {
            setEditingGroup(null);
            setIsGroupsModalOpen(true);
          }}
          onGroupContextMenu={handleGroupContextMenu}
          storageUsedBytes={storageUsedBytes}
          isCollapsed={!showSidebar}
        />

        {/* Center Documents Workspace (Section 5) */}
        <main className="flex-1 flex flex-col bg-white overflow-hidden">
          {/* Subheader breadcrumbs / status indicator */}
          <div className="h-8 bg-white border-b border-slate-200 px-4 flex items-center justify-between text-xs shrink-0 select-none">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-800 text-xs">
                {sidebarFilter === 'all'
                  ? 'جميع المستمسكات'
                  : sidebarFilter === 'favorites'
                  ? 'المستمسكات المفضلة'
                  : sidebarFilter === 'recent_added'
                  ? 'المضافة حديثاً'
                  : sidebarFilter === 'recent_modified'
                  ? 'المعدلة حديثاً'
                  : sidebarFilter === 'archived'
                  ? 'المستمسكات المؤرشفة'
                  : sidebarFilter === 'trash'
                  ? 'سلة المحذوفات'
                  : groups.find((g) => g.id === sidebarFilter.replace('group_', ''))?.name || 'مجموعة'}
              </span>

              <span className="text-[11px] text-slate-400 font-mono">
                ({filteredAndSortedDocs.length})
              </span>
            </div>

            {/* Quick Sort Order Indicator */}
            <div className="flex items-center gap-2 text-slate-500 text-[11px]">
              <button
                onClick={() => setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'))}
                className="hover:text-blue-600 cursor-pointer font-mono"
                title="تغيير اتجاه الترتيب"
              >
                {sortOrder === 'asc' ? '↑ تصاعدي' : '↓ تنازلي'}
              </button>
            </div>
          </div>

          {/* Documents Content Canvas (10 View Modes) */}
          <div
            className={`flex-1 select-none bg-slate-50/40 ${
              viewMode === 'single' || viewMode === 'map'
                ? 'overflow-hidden flex flex-col ' + (viewMode === 'map' ? 'p-3' : 'p-0')
                : 'overflow-y-auto p-4'
            }`}
          >
            {filteredAndSortedDocs.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 text-slate-400">
                <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mb-3 border border-slate-200">
                  <FilePlus className="w-6 h-6 text-slate-400" />
                </div>
                <h3 className="font-bold text-sm text-slate-700 mb-1">لا توجد مستمسكات لعرضها</h3>
                <p className="text-xs text-slate-400 max-w-sm mb-4">
                  {searchQuery
                    ? 'لم يتم العثور على نتائج تطابق معايير البحث الحالية.'
                    : 'يمكنك حفظ وتنظيم بطاقات الهوية، الجوازات، والوثائق الرسمية بالقياس الحقيقي.'}
                </p>
                <button
                  onClick={() => setIsAddDocOpen(true)}
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-semibold cursor-pointer transition-colors shadow-xs"
                >
                  + إضافة مستمسك جديد
                </button>
              </div>
            ) : (
              <DocumentViewsCanvas
                documents={filteredAndSortedDocs}
                groups={groups}
                viewMode={viewMode}
                cardSize={cardSize}
                selectedDocIds={selectedDocIds}
                isMultiSelectMode={isMultiSelectMode}
                onSelect={handleSelectDoc}
                onOpen={(d) => setInspectDoc(d)}
                onToggleFavorite={handleToggleFavorite}
                onContextMenu={handleDocumentContextMenu}
                onDirectPrint={handleDirectPrint}
                onDownload={handleDownloadDocument}
              />
            )}
          </div>
        </main>
      </div>
        </div>
      )}

      {/* === MODALS (All in Light UI) === */}

      {/* 1. Add / Edit Document Studio */}
      {isAddDocOpen && (
        <AddDocumentModal
          isOpen={isAddDocOpen}
          onClose={() => {
            setIsAddDocOpen(false);
            setEditingDoc(null);
            setPendingTemplate(null);
          }}
          groups={groups}
          onSaveDocument={handleSaveNewDocument}
          onUpdateDocument={handleUpdateDocument}
          editingDocument={editingDoc}
          initialTemplate={pendingTemplate}
          initialGroup={sidebarFilter.startsWith('group_') ? sidebarFilter.replace('group_', '') : undefined}
        />
      )}

      {/* 2. Document Details Page */}
      {inspectDoc && (
        <DocumentDetailsModal
          document={inspectDoc}
          groups={groups}
          isOpen={Boolean(inspectDoc)}
          onClose={() => setInspectDoc(null)}
          onUpdate={handleUpdateDocument}
          onDuplicate={handleDuplicateDocument}
          onPrint={(d) => handleDirectPrint(d)}
          onExport={(d) => handleDirectPrint(d)}
          onTrash={handleTrashDocument}
          onOpenEditor={(doc) => {
            setInspectDoc(null);
            setEditingDoc(doc);
            setIsAddDocOpen(true);
          }}
        />
      )}

      {/* 3. Professional Print Studio */}
      {isPrintStudioOpen && (
        <PrintStudioModal
          isOpen={isPrintStudioOpen}
          onClose={() => setIsPrintStudioOpen(false)}
          documents={documents.filter((d) => !d.isDeleted)}
          items={printItems}
          setItems={setPrintItems}
          settings={printSettings}
          setSettings={setPrintSettings}
        />
      )}

      {/* 4. Groups Manager Modal */}
      {isGroupsModalOpen && (
        <GroupsModal
          isOpen={isGroupsModalOpen}
          onClose={() => {
            setIsGroupsModalOpen(false);
            setEditingGroup(null);
          }}
          groups={groups}
          documents={documents}
          initialEditingGroup={editingGroup}
          onSaveGroup={handleSaveGroup}
          onDeleteGroup={handleDeleteGroup}
        />
      )}

      {/* 5. Trash Bin Modal */}
      {isTrashOpen || sidebarFilter === 'trash' ? (
        <TrashBinModal
          isOpen={isTrashOpen || sidebarFilter === 'trash'}
          onClose={() => {
            setIsTrashOpen(false);
            if (sidebarFilter === 'trash') setSidebarFilter('all');
          }}
          trashDocuments={trashDocuments}
          onRestore={handleRestoreFromTrash}
          onRestoreAll={handleRestoreAllTrash}
          onPermanentDelete={handlePermanentDelete}
          onEmptyTrash={handleEmptyTrash}
        />
      ) : null}

      {/* 6. Backup & Restore Modal */}
      {isBackupOpen && (
        <BackupRestoreModal
          isOpen={isBackupOpen}
          onClose={() => setIsBackupOpen(false)}
          onDataRestored={reloadData}
        />
      )}

      {/* 7. Settings Modal */}
      {isSettingsOpen && (
        <SettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          settings={settings}
          onSaveSettings={handleSaveSettings}
          storageStats={{
            usedBytes: storageUsedBytes,
            documentsCount: documents.length,
            groupsCount: groups.length,
            logsCount: 50,
          }}
          onResetSettingsOnly={handleResetSettingsOnly}
          onFactoryResetWipeAll={handleFactoryResetWipeAll}
          initialTab={settingsTab}
          firebaseUser={firebaseUser}
          currentIpInfo={currentIpInfo}
          requireEmailOnNewIp={requireEmailOnNewIp}
          trustedIps={trustedIps}
          userDevices={userDevices}
          onToggleRequireEmailOnNewIp={async (enabled) => {
            if (!firebaseUser) return;
            await updateRequireEmailOnNewIp(firebaseUser.uid, enabled);
            setRequireEmailOnNewIp(enabled);
          }}
          onRevokeTrustedIp={async (ipHash) => {
            if (!firebaseUser) return;
            await revokeTrustedIp(firebaseUser.uid, ipHash);
          }}
          onRemoveTrustedIp={async (ipHash) => {
            if (!firebaseUser) return;
            await removeTrustedIp(firebaseUser.uid, ipHash);
          }}
          onRemoveUserDevice={async (deviceId) => {
            if (!firebaseUser) return;
            await removeUserDevice(firebaseUser.uid, deviceId);
          }}
          onSwitchGoogleAccount={handleAuthenticateWithGoogle}
          onSignOutGoogle={handleSignOutGoogle}
        />
      )}

      {/* 8. Audit Log Modal */}
      {isAuditLogOpen && (
        <AuditLogModal isOpen={isAuditLogOpen} onClose={() => setIsAuditLogOpen(false)} />
      )}

      {/* 9. Cloud Conflict Resolution Modal */}
      {syncStatus.conflicts.length > 0 && (
        <ConflictResolutionModal
          isOpen={syncStatus.conflicts.length > 0}
          conflicts={syncStatus.conflicts}
          onClose={() => syncEngine.syncNow()}
          onResolve={async (conflict, choice) => {
            await syncEngine.resolveConflict(conflict, choice);
            await reloadData();
          }}
        />
      )}

      {/* 10. Batch Import Modal */}
      {isImportOpen && (
        <ImportModal
          isOpen={isImportOpen}
          onClose={() => setIsImportOpen(false)}
          groups={groups}
          existingDocuments={documents}
          onImportDocuments={async (newDocs) => {
            for (const doc of newDocs) {
              await handleSaveNewDocument(doc);
            }
          }}
        />
      )}

      {/* 11. Lock Screen */}
      {isLocked && (
        <LockScreenModal
          isOpen={isLocked}
          expectedHash={settings.masterPasswordHash}
          salt={settings.masterPasswordSalt}
          passwordHint={settings.passwordHint}
          onUnlock={() => setIsLocked(false)}
        />
      )}

      {/* 12. Shortcuts Guide Modal */}
      {isShortcutsOpen && (
        <ShortcutsModal isOpen={isShortcutsOpen} onClose={() => setIsShortcutsOpen(false)} />
      )}

      {/* 13. About Modal */}
      {isAboutOpen && (
        <AboutModal isOpen={isAboutOpen} onClose={() => setIsAboutOpen(false)} />
      )}

      {/* 14. User Guide Modal */}
      {isUserGuideOpen && (
        <UserGuideModal isOpen={isUserGuideOpen} onClose={() => setIsUserGuideOpen(false)} />
      )}

      {/* 15. Custom Document Template Modal */}
      {isCustomDocOpen && (
        <CustomDocumentModal
          isOpen={isCustomDocOpen}
          onClose={() => setIsCustomDocOpen(false)}
          onConfirm={(template: CustomTemplate) => {
            setPendingTemplate(template);
            setEditingDoc(null);
            setIsAddDocOpen(true);
          }}
        />
      )}

      {/* 16. Right Click Context Menu (Section 6 - Desktop Only) */}
      {!isMobile && contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          menu={contextMenu.menu}
          groups={groups}
          onClose={() => setContextMenu(null)}
          onOpenDoc={(d) => setInspectDoc(d)}
          onPreviewDoc={(d) => setInspectDoc(d)}
          onEditDoc={(d) => setInspectDoc(d)}
          onRenameDoc={(d) => setInspectDoc(d)}
          onDuplicateDoc={handleDuplicateDocument}
          onMoveDocToGroup={async (d, gId) => {
            await handleUpdateDocument({ ...d, groupId: gId });
          }}
          onToggleFavoriteDoc={async (d) => {
            await handleUpdateDocument({ ...d, isFavorite: !d.isFavorite });
          }}
          onToggleCoverFace={async (d) => {
            await handleUpdateDocument({ ...d, coverFace: d.coverFace === 'front' ? 'back' : 'front' });
          }}
          onExportDoc={(d) => {
            handleDirectPrint(d);
          }}
          onPrintDoc={(d) => {
            handleDirectPrint(d);
          }}
          onShowPropertiesDoc={(d) => setInspectDoc(d)}
          onShowHistoryDoc={(d) => setInspectDoc(d)}
          onTrashDoc={handleTrashDocument}
          onOpenGroup={(g) => setSidebarFilter(`group_${g.id}`)}
          onEditGroup={(g) => {
            setEditingGroup(g);
            setIsGroupsModalOpen(true);
          }}
          onAddDocToGroup={(g) => {
            setSidebarFilter(`group_${g.id}`);
            setIsAddDocOpen(true);
          }}
          onExportGroup={(g) => {
            setSelectedDocIds(new Set(documents.filter((d) => d.groupId === g.id).map((d) => d.id)));
            setIsPrintStudioOpen(true);
          }}
          onLockGroup={async (g) => {
            await handleSaveGroup({ ...g, isLocked: !g.isLocked });
          }}
          onDeleteGroup={(g) => {
            setEditingGroup(g);
            setIsGroupsModalOpen(true);
          }}
          onAddDocument={() => setIsAddDocOpen(true)}
          onCreateGroup={() => {
            setEditingGroup(null);
            setIsGroupsModalOpen(true);
          }}
          onImport={() => setIsImportOpen(true)}
          onSelectAll={handleSelectAll}
          onRefresh={reloadData}
          onChangeViewMode={(mode) => {
            setViewMode(mode);
            saveSettings({ ...settings, viewMode: mode });
          }}
        />
      )}
    </>
  );
}
