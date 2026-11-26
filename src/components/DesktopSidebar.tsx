import React, { useState } from 'react';
import {
  FilePlus,
  FolderPlus,
  FileText,
  Star,
  Clock,
  Edit3,
  Archive,
  Trash2,
  Plus,
  Shield,
  ChevronDown,
  ChevronRight,
  Database,
} from 'lucide-react';
import { DocumentGroup } from '../types';
import { GroupIcon } from './GroupIcon';

export type SidebarFilter =
  | 'all'
  | 'favorites'
  | 'recent_added'
  | 'recent_modified'
  | 'archived'
  | 'trash'
  | `group_${string}`;

interface DesktopSidebarProps {
  currentFilter: SidebarFilter;
  onSelectFilter: (filter: SidebarFilter) => void;
  groups: DocumentGroup[];
  counts: {
    all: number;
    favorites: number;
    recentAdded: number;
    recentModified: number;
    archived: number;
    trash: number;
    groupCounts: Record<string, number>;
  };
  onAddDocument: () => void;
  onCreateGroup: () => void;
  onGroupContextMenu: (e: React.MouseEvent, group: DocumentGroup) => void;
  storageUsedBytes: number;
  isCollapsed?: boolean;
}

const UNIFIED_ICON_COLOR = '#2563eb'; // Blue-600

export const DesktopSidebar: React.FC<DesktopSidebarProps> = ({
  currentFilter,
  onSelectFilter,
  groups,
  counts,
  onAddDocument,
  onCreateGroup,
  onGroupContextMenu,
  storageUsedBytes,
  isCollapsed = false,
}) => {
  const [groupsExpanded, setGroupsExpanded] = useState(true);

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const navItemClass = (isActive: boolean) =>
    `w-full shrink-0 flex items-center justify-between px-3 py-1.5 rounded text-xs transition-colors cursor-pointer text-right ${
      isActive
        ? 'bg-blue-50 text-blue-700 font-semibold'
        : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
    }`;

  const collapsedNavItemClass = (isActive: boolean) =>
    `w-10 h-9 mx-auto shrink-0 flex items-center justify-center rounded-md transition-colors cursor-pointer relative ${
      isActive
        ? 'bg-blue-50 text-blue-700 ring-1 ring-blue-200 shadow-2xs'
        : 'text-blue-600 hover:bg-slate-100'
    }`;

  if (isCollapsed) {
    return (
      <aside className="w-14 bg-slate-50 border-l border-slate-200 flex flex-col justify-between select-none shrink-0 h-full min-h-0 font-['Cairo',system-ui,sans-serif] transition-all duration-200">
        {/* Compact Icon Navigation Rail */}
        <div className="overflow-y-auto py-2 px-1 space-y-1 flex-1 min-h-0 flex flex-col items-center">
          {/* 1. إضافة مستمسك */}
          <button
            onClick={onAddDocument}
            className="w-10 h-9 mx-auto flex items-center justify-center rounded-md text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
            title="إضافة مستمسك جديد (Ctrl+N)"
          >
            <FilePlus className="w-4 h-4 text-blue-600" />
          </button>

          {/* 2. إنشاء مجموعة */}
          <button
            onClick={onCreateGroup}
            className="w-10 h-9 mx-auto flex items-center justify-center rounded-md text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
            title="إنشاء مجموعة جديدة (Ctrl+G)"
          >
            <FolderPlus className="w-4 h-4 text-blue-600" />
          </button>

          <div className="w-7 h-[1px] bg-slate-200 my-1 shrink-0" />

          {/* 3. جميع المستمسكات */}
          <button
            onClick={() => onSelectFilter('all')}
            className={collapsedNavItemClass(currentFilter === 'all')}
            title={`جميع المستمسكات (${counts.all})`}
          >
            <FileText className="w-4 h-4 text-blue-600" />
          </button>

          {/* 2. المفضلة */}
          <button
            onClick={() => onSelectFilter('favorites')}
            className={collapsedNavItemClass(currentFilter === 'favorites')}
            title={`المفضلة (${counts.favorites})`}
          >
            <Star
              className={`w-4 h-4 text-blue-600 ${
                currentFilter === 'favorites' ? 'fill-blue-600' : ''
              }`}
            />
          </button>

          <div className="w-7 h-[1px] bg-slate-200 my-1 shrink-0" />

          {/* 3. أيقونات المجموعات */}
          <div className="w-full space-y-1 flex flex-col items-center max-h-52 overflow-y-auto shrink-0 py-0.5">
            {groups.map((group) => {
              const isGroupActive = currentFilter === `group_${group.id}`;
              const groupCount = counts.groupCounts[group.id] || 0;
              return (
                <button
                  key={group.id}
                  onClick={() => onSelectFilter(`group_${group.id}`)}
                  onContextMenu={(e) => onGroupContextMenu(e, group)}
                  className={collapsedNavItemClass(isGroupActive)}
                  title={`${group.name} (${groupCount})${group.description ? ` - ${group.description}` : ''}`}
                >
                  <GroupIcon
                    icon={group.icon}
                    color={UNIFIED_ICON_COLOR}
                    className="w-4 h-4"
                  />
                  {group.isLocked && (
                    <Shield className="w-2.5 h-2.5 text-blue-600 absolute top-1 left-1 bg-white rounded-full" />
                  )}
                </button>
              );
            })}
          </div>

          <div className="w-7 h-[1px] bg-slate-200 my-1 shrink-0" />

          {/* 4. المضافة حديثاً */}
          <button
            onClick={() => onSelectFilter('recent_added')}
            className={collapsedNavItemClass(currentFilter === 'recent_added')}
            title={`المضافة حديثاً (${counts.recentAdded})`}
          >
            <Clock className="w-4 h-4 text-blue-600" />
          </button>

          {/* 5. المعدلة حديثاً */}
          <button
            onClick={() => onSelectFilter('recent_modified')}
            className={collapsedNavItemClass(currentFilter === 'recent_modified')}
            title={`المعدلة حديثاً (${counts.recentModified})`}
          >
            <Edit3 className="w-4 h-4 text-blue-600" />
          </button>

          {/* 6. الأرشيف */}
          <button
            onClick={() => onSelectFilter('archived')}
            className={collapsedNavItemClass(currentFilter === 'archived')}
            title={`الأرشيف (${counts.archived})`}
          >
            <Archive className="w-4 h-4 text-blue-600" />
          </button>

          {/* 7. سلة المحذوفات */}
          <button
            onClick={() => onSelectFilter('trash')}
            className={collapsedNavItemClass(currentFilter === 'trash')}
            title={`سلة المحذوفات (${counts.trash})`}
          >
            <Trash2 className="w-4 h-4 text-blue-600" />
            {counts.trash > 0 && (
              <span className="w-2 h-2 rounded-full bg-blue-600 absolute top-1.5 left-1.5" />
            )}
          </button>
        </div>

        {/* Compact Storage Footer */}
        <div
          className="py-2.5 px-1.5 border-t border-slate-200 bg-white flex flex-col items-center gap-1.5 shrink-0"
          title={`التخزين المحلي: ${formatBytes(storageUsedBytes)}`}
        >
          <Database className="w-3.5 h-3.5 text-blue-600" />
          <div className="w-8 bg-slate-100 h-1 rounded-full overflow-hidden">
            <div
              className="bg-blue-600 h-full rounded-full transition-all duration-300"
              style={{ width: `${Math.min(100, Math.max(3, (storageUsedBytes / (50 * 1024 * 1024)) * 100))}%` }}
            />
          </div>
        </div>
      </aside>
    );
  }

  return (
    <aside className="w-56 bg-slate-50 border-l border-slate-200 flex flex-col justify-between select-none shrink-0 h-full min-h-0 font-['Cairo',system-ui,sans-serif] transition-all duration-200">
      {/* Scrollable Navigation Tree */}
      <div className="overflow-y-auto px-2 py-2 space-y-0.5 flex-1 min-h-0">
        {/* 1. إضافة مستمسك */}
        <button
          onClick={onAddDocument}
          className="w-full flex items-center justify-between px-3 py-1.5 rounded text-xs transition-colors cursor-pointer text-right text-slate-700 hover:bg-blue-50 hover:text-blue-700 font-medium"
          title="إضافة مستمسك جديد (Ctrl+N)"
        >
          <div className="flex items-center gap-2">
            <FilePlus className="w-3.5 h-3.5 text-blue-600" />
            <span>إضافة مستمسك</span>
          </div>
          <kbd className="text-[10px] text-slate-400 font-mono">Ctrl+N</kbd>
        </button>

        {/* 2. إنشاء مجموعة */}
        <button
          onClick={onCreateGroup}
          className="w-full flex items-center justify-between px-3 py-1.5 rounded text-xs transition-colors cursor-pointer text-right text-slate-700 hover:bg-blue-50 hover:text-blue-700 font-medium"
          title="إنشاء مجموعة جديدة (Ctrl+G)"
        >
          <div className="flex items-center gap-2">
            <FolderPlus className="w-3.5 h-3.5 text-blue-600" />
            <span>إنشاء مجموعة</span>
          </div>
          <kbd className="text-[10px] text-slate-400 font-mono">Ctrl+G</kbd>
        </button>

        <div className="h-[1px] bg-slate-200 my-1.5" />

        {/* 3. جميع المستمسكات */}
        <button
          onClick={() => onSelectFilter('all')}
          className={navItemClass(currentFilter === 'all')}
        >
          <div className="flex items-center gap-2">
            <FileText className="w-3.5 h-3.5 text-blue-600" />
            <span>جميع المستمسكات</span>
          </div>
          <span className="text-[11px] text-slate-400 font-mono">{counts.all}</span>
        </button>

        {/* 2. المفضلة */}
        <button
          onClick={() => onSelectFilter('favorites')}
          className={navItemClass(currentFilter === 'favorites')}
        >
          <div className="flex items-center gap-2">
            <Star
              className={`w-3.5 h-3.5 text-blue-600 ${
                currentFilter === 'favorites' ? 'fill-blue-600' : ''
              }`}
            />
            <span>المفضلة</span>
          </div>
          <span className="text-[11px] text-slate-400 font-mono">{counts.favorites}</span>
        </button>

        <div className="h-[1px] bg-slate-200 my-1.5" />

        {/* 3. المجموعات Section */}
        <div>
          <div className="flex items-center justify-between px-2 py-1 text-slate-500 text-[11px] font-semibold">
            <button
              onClick={() => setGroupsExpanded(!groupsExpanded)}
              className="flex items-center gap-1 hover:text-slate-800 cursor-pointer"
            >
              {groupsExpanded ? (
                <ChevronDown className="w-3.5 h-3.5 text-blue-600" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 text-blue-600" />
              )}
              <span>المجموعات</span>
              <span className="text-[10px] text-slate-400">({groups.length})</span>
            </button>
            <button
              onClick={onCreateGroup}
              className="p-0.5 hover:bg-slate-200 text-blue-600 rounded transition-colors cursor-pointer"
              title="إنشاء مجموعة جديدة"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Sub-groups tree */}
          {groupsExpanded && (
            <div className="space-y-0.5 pr-2 pl-1 mt-0.5 max-h-52 overflow-y-auto">
              {groups.length === 0 ? (
                <div className="px-3 py-1.5 text-[11px] text-slate-400">لا توجد مجموعات</div>
              ) : (
                groups.map((group) => {
                  const isGroupActive = currentFilter === `group_${group.id}`;
                  const groupCount = counts.groupCounts[group.id] || 0;
                  return (
                    <button
                      key={group.id}
                      onClick={() => onSelectFilter(`group_${group.id}`)}
                      onContextMenu={(e) => onGroupContextMenu(e, group)}
                      className={navItemClass(isGroupActive)}
                      title={group.description || group.name}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <GroupIcon
                          icon={group.icon}
                          color={UNIFIED_ICON_COLOR}
                          className="w-3.5 h-3.5"
                        />
                        <span className="truncate">{group.name}</span>
                        {group.isLocked && <Shield className="w-3 h-3 text-blue-600 shrink-0" />}
                      </div>
                      <span className="text-[11px] text-slate-400 font-mono">{groupCount}</span>
                    </button>
                  );
                })
              )}
            </div>
          )}
        </div>

        <div className="h-[1px] bg-slate-200 my-1.5" />

        {/* 4. المضافة حديثاً */}
        <button
          onClick={() => onSelectFilter('recent_added')}
          className={navItemClass(currentFilter === 'recent_added')}
        >
          <div className="flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-blue-600" />
            <span>المضافة حديثاً</span>
          </div>
          <span className="text-[11px] text-slate-400 font-mono">{counts.recentAdded}</span>
        </button>

        {/* 5. المعدلة حديثاً */}
        <button
          onClick={() => onSelectFilter('recent_modified')}
          className={navItemClass(currentFilter === 'recent_modified')}
        >
          <div className="flex items-center gap-2">
            <Edit3 className="w-3.5 h-3.5 text-blue-600" />
            <span>المعدلة حديثاً</span>
          </div>
          <span className="text-[11px] text-slate-400 font-mono">{counts.recentModified}</span>
        </button>

        {/* 6. الأرشيف */}
        <button
          onClick={() => onSelectFilter('archived')}
          className={navItemClass(currentFilter === 'archived')}
        >
          <div className="flex items-center gap-2">
            <Archive className="w-3.5 h-3.5 text-blue-600" />
            <span>الأرشيف</span>
          </div>
          <span className="text-[11px] text-slate-400 font-mono">{counts.archived}</span>
        </button>

        {/* 7. سلة المحذوفات */}
        <button
          onClick={() => onSelectFilter('trash')}
          className={navItemClass(currentFilter === 'trash')}
        >
          <div className="flex items-center gap-2">
            <Trash2 className="w-3.5 h-3.5 text-blue-600" />
            <span className={counts.trash > 0 ? 'text-red-600 font-medium' : ''}>
              سلة المحذوفات
            </span>
          </div>
          <span className={`text-[11px] font-mono ${counts.trash > 0 ? 'text-red-600 font-bold' : 'text-slate-400'}`}>
            {counts.trash}
          </span>
        </button>
      </div>

      {/* Storage & Local Status Footer */}
      <div className="p-2.5 border-t border-slate-200 bg-white text-[11px] shrink-0">
        <div className="flex items-center justify-between text-slate-600 mb-1">
          <div className="flex items-center gap-1.5">
            <Database className="w-3.5 h-3.5 text-blue-600" />
            <span className="font-medium text-slate-700">التخزين المحلي</span>
          </div>
          <span className="font-mono text-slate-500 text-[10px]">{formatBytes(storageUsedBytes)}</span>
        </div>
        <div className="w-full bg-slate-100 h-1 rounded-full overflow-hidden">
          <div
            className="bg-blue-600 h-full rounded-full transition-all duration-300"
            style={{ width: `${Math.min(100, Math.max(3, (storageUsedBytes / (50 * 1024 * 1024)) * 100))}%` }}
          />
        </div>
      </div>
    </aside>
  );
};
