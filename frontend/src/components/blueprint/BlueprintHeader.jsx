import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  FileText,
  Workflow,
  Cpu,
  Users,
  ShieldCheck,
  MessageSquare,
  History,
  Download,
  FileCode,
  FileType,
  Edit3,
  Save,
  X,
  Search,
  RotateCcw,
  Check,
  AlertTriangle,
  ChevronDown,
  Layers,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { safeText, safeArray } from '../../utils/safeRender';
import { formatTimestamp } from '../../utils/formatting';

export function BlueprintHeader({
  ideaTitle,
  version,
  status,
  updatedAt,
  isEditing,
  isSaving,
  isGenerating,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onRegenerateClick,
  onExportJson,
  onExportPdf,
  isExportingJson,
  isExportingPdf,
  showExportMenu,
  setShowExportMenu,
  onOpenSearch,
  activeTab,
  setActiveTab,
  stats = {},
  isReadOnlyVersion = false,
  onReturnToCurrentVersion,
  versions = [],
  latestVersion = '1.0',
  selectedVersionKey = null,
  onSelectVersion,
  onOpenApprovalModal,
  approvalStatus = 'pending_approval',
  lifecycleState = 'ready_for_review',
}) {
  const safeVersionStr = safeText(version, '1.0');
  const safeStatusStr = safeText(status, 'completed');
  const safeTitleStr = safeText(ideaTitle, 'Project Blueprint');

  const [showVersionMenu, setShowVersionMenu] = useState(false);
  const versionMenuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (versionMenuRef.current && !versionMenuRef.current.contains(event.target)) {
        setShowVersionMenu(false);
      }
    };
    if (showVersionMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showVersionMenu]);

  const versionsList = safeArray(versions);

  const tabs = [
    { id: 'overview', label: 'Overview', icon: FileText },
    { id: 'requirements', label: 'Requirements', icon: FileText, count: stats.requirementsCount },
    { id: 'architecture', label: 'Architecture', icon: Cpu },
    { id: 'execution', label: 'Execution', icon: Workflow, count: stats.tasksCount },
    { id: 'team', label: 'Team', icon: Users },
    { id: 'quality', label: 'Risks & Quality', icon: ShieldCheck, alert: stats.criticalRisksCount > 0 },
    { id: 'decisions', label: 'Decisions', icon: MessageSquare, alert: stats.blockingQuestionsCount > 0, count: stats.decisionsCount },
    { id: 'versions', label: 'Version History', icon: History, count: stats.versionsCount },
  ];

  return (
    <div className="space-y-4">
      {/* Top Banner if Viewing Previous Historical Version */}
      {isReadOnlyVersion && (
        <div className="p-3.5 rounded-2xl bg-amber-950/70 border border-amber-800 text-amber-200 flex items-center justify-between gap-4 text-xs font-mono animate-fadeIn">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
            <span>
              <strong>Historical Version Preview:</strong> You are viewing version {safeVersionStr}. This snapshot is read-only.
            </span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={onReturnToCurrentVersion}
            className="border-amber-700 bg-amber-900/60 hover:bg-amber-800 text-white text-xs font-bold font-sans py-1 px-3 h-7"
          >
            Return to Current Version
          </Button>
        </div>
      )}

      {/* Main Control Center Header Card */}
      <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Left Title & Status */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              {/* Interactive Version Selector Dropdown */}
              <div className="relative" ref={versionMenuRef}>
                <button
                  type="button"
                  onClick={() => setShowVersionMenu(!showVersionMenu)}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-xl font-mono text-xs font-black border transition-all ${
                    isReadOnlyVersion
                      ? 'bg-amber-950/80 border-amber-700 text-amber-300 hover:bg-amber-900'
                      : 'bg-primary-950/90 border-primary-800 text-primary-300 hover:bg-primary-900 hover:border-primary-600'
                  } shadow-sm cursor-pointer`}
                  title={versionsList.length > 1 ? 'Click to switch between saved Blueprint versions' : `Blueprint Version ${safeVersionStr}`}
                >
                  <History className="h-3.5 w-3.5 text-primary-400" />
                  <span>Blueprint v{safeVersionStr}</span>
                  {versionsList.length > 1 && (
                    <ChevronDown className={`h-3 w-3 text-primary-400 transition-transform ${showVersionMenu ? 'rotate-180' : ''}`} />
                  )}
                </button>

                {/* Dropdown Menu for Switching Versions */}
                {showVersionMenu && versionsList.length > 0 && (
                  <div className="absolute left-0 mt-2 w-72 bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl z-50 overflow-hidden py-1.5 animate-fadeIn">
                    <div className="px-3.5 py-2 border-b border-slate-800 text-[10px] font-mono text-slate-400 uppercase font-extrabold flex items-center justify-between">
                      <span>Available Versions ({versionsList.length})</span>
                      <span className="text-emerald-400 font-normal">Active: v{latestVersion}</span>
                    </div>

                    <div className="max-h-64 overflow-y-auto">
                      {versionsList.map((ver) => {
                        const verNumber = safeText(ver.version, '1.0');
                        const isCurrentActive = verNumber === String(latestVersion);
                        const isViewingThis = isReadOnlyVersion
                          ? String(selectedVersionKey) === String(ver.key) || String(selectedVersionKey) === verNumber
                          : isCurrentActive;

                        return (
                          <button
                            key={ver.key || ver.versionId || verNumber}
                            type="button"
                            onClick={() => {
                              setShowVersionMenu(false);
                              if (onSelectVersion) {
                                onSelectVersion(isCurrentActive ? null : (ver.key || verNumber));
                              }
                            }}
                            className={`w-full px-3.5 py-2.5 text-left text-xs font-mono flex items-center justify-between hover:bg-slate-900 transition-colors ${
                              isViewingThis ? 'bg-primary-950/60 text-primary-200 font-bold' : 'text-slate-300'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <span className={`h-2 w-2 rounded-full ${
                                isViewingThis
                                  ? 'bg-primary-400 ring-2 ring-primary-500/50'
                                  : isCurrentActive
                                  ? 'bg-emerald-400'
                                  : 'bg-slate-600'
                              }`} />
                              <span>Version {verNumber}</span>
                              {isCurrentActive && (
                                <span className="px-1.5 py-0.2 rounded bg-emerald-950 text-emerald-300 text-[9px] font-bold border border-emerald-800">
                                  Current
                                </span>
                              )}
                            </div>

                            <span className="text-[10px] text-slate-500 font-sans">
                              {formatTimestamp(ver.updatedAt || ver.createdAt)}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              <span className={`px-2.5 py-0.5 rounded-full text-xs font-mono font-bold uppercase ${
                safeStatusStr === 'generating'
                  ? 'bg-primary-950 text-primary-300 border border-primary-800 animate-pulse'
                  : isReadOnlyVersion
                  ? 'bg-slate-900 text-slate-400 border border-slate-700'
                  : approvalStatus === 'approved'
                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                  : 'bg-amber-950 text-amber-300 border border-amber-800'
              }`}>
                {safeStatusStr === 'generating'
                  ? 'Generating'
                  : isReadOnlyVersion
                  ? `Snapshot v${safeVersionStr}${approvalStatus === 'approved' ? ' (Approved)' : ' (Pending)'}`
                  : approvalStatus === 'approved'
                  ? '✓ Approved Active'
                  : 'Pending Approval'}
              </span>
              {updatedAt && (
                <span className="text-xs text-slate-400 font-mono">
                  Updated {formatTimestamp(updatedAt)}
                </span>
              )}
            </div>

            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              {safeTitleStr}
            </h1>
          </div>

          {/* Action Toolbar */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Phase 11: Approval Gate Action - Displayed ONLY when approval is pending */}
            {onOpenApprovalModal && approvalStatus !== 'approved' && !isGenerating && (
              <Button
                variant="primary"
                size="sm"
                icon={<ShieldCheck className="h-4 w-4 text-emerald-200" />}
                onClick={onOpenApprovalModal}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs py-2 px-3.5 shadow-md shadow-emerald-950/40"
              >
                Review & Approve
              </Button>
            )}

            {/* Search Button */}
            <Button
              variant="outline"
              size="sm"
              icon={<Search className="h-4 w-4 text-primary-400" />}
              onClick={onOpenSearch}
              className="border-slate-800 bg-slate-950 hover:bg-slate-800 text-slate-300 text-xs font-bold py-2 px-3 shadow-sm"
            >
              <span className="hidden sm:inline">Search</span>
              <kbd className="ml-1.5 px-1.5 py-0.5 bg-slate-900 border border-slate-700 rounded text-[10px] text-slate-400 font-mono">
                ⌘K
              </kbd>
            </Button>

            {/* Export Dropdown */}
            <div className="relative">
              <Button
                variant="outline"
                size="sm"
                icon={<Download className="h-4 w-4" />}
                onClick={() => setShowExportMenu(!showExportMenu)}
                className="border-slate-800 bg-slate-950 hover:bg-slate-800 text-slate-300 text-xs font-bold py-2 px-3 shadow-sm"
              >
                <span>Export</span>
                <ChevronDown className="h-3 w-3 ml-1 text-slate-400" />
              </Button>

              {showExportMenu && (
                <div className="absolute right-0 mt-2 w-48 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl z-40 overflow-hidden py-1">
                  <button
                    onClick={() => {
                      setShowExportMenu(false);
                      onExportPdf();
                    }}
                    disabled={isExportingPdf}
                    className="w-full px-4 py-2.5 text-left text-xs font-bold text-slate-200 hover:bg-slate-800 flex items-center gap-2 transition-colors"
                  >
                    <FileType className="h-4 w-4 text-primary-400" />
                    <span>{isExportingPdf ? 'Exporting PDF...' : 'Export PDF Document'}</span>
                  </button>
                  <button
                    onClick={() => {
                      setShowExportMenu(false);
                      onExportJson();
                    }}
                    disabled={isExportingJson}
                    className="w-full px-4 py-2.5 text-left text-xs font-bold text-slate-200 hover:bg-slate-800 flex items-center gap-2 transition-colors border-t border-slate-800"
                  >
                    <FileCode className="h-4 w-4 text-emerald-400" />
                    <span>{isExportingJson ? 'Exporting JSON...' : 'Export Canonical JSON'}</span>
                  </button>
                </div>
              )}
            </div>

            {/* Manual Edit Controls */}
            {!isReadOnlyVersion && (
              <>
                {isEditing ? (
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      icon={<X className="h-4 w-4" />}
                      onClick={onCancelEdit}
                      disabled={isSaving}
                      className="border-slate-800 text-slate-400 text-xs font-bold py-2 px-3"
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      icon={<Save className="h-4 w-4" />}
                      onClick={onSaveEdit}
                      isLoading={isSaving}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-2 px-3 shadow-md"
                    >
                      Save Changes
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    icon={<Edit3 className="h-4 w-4 text-slate-400" />}
                    onClick={onStartEdit}
                    disabled={isGenerating}
                    className="border-slate-800 bg-slate-950 hover:bg-slate-800 text-slate-300 text-xs font-bold py-2 px-3 shadow-sm"
                  >
                    Edit
                  </Button>
                )}
              </>
            )}

            {/* Regenerate AI Blueprint Button */}
            {!isReadOnlyVersion && (
              <Button
                variant="primary"
                size="sm"
                icon={<Sparkles className="h-4 w-4 text-primary-200" />}
                onClick={onRegenerateClick}
                disabled={isGenerating || isEditing}
                className="bg-primary-600 hover:bg-primary-700 text-white font-black text-xs py-2 px-4 shadow-lg shadow-primary-600/20"
              >
                Regenerate AI
              </Button>
            )}
          </div>
        </div>

        {/* 8-Tab Navigation Bar */}
        <div className="flex items-center gap-1.5 border-t border-slate-800/80 pt-4 overflow-x-auto no-scrollbar">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap shrink-0 ${
                  isActive
                    ? 'bg-primary-600 text-white shadow-md shadow-primary-600/30'
                    : 'bg-slate-950 text-slate-400 border border-slate-800/80 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{tab.label}</span>
                {tab.count !== undefined && tab.count > 0 && (
                  <span className={`px-1.5 py-0.2 rounded font-mono text-[10px] ${
                    isActive ? 'bg-primary-800 text-primary-100' : 'bg-slate-800 text-slate-400'
                  }`}>
                    {tab.count}
                  </span>
                )}
                {tab.alert && (
                  <span className="h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
