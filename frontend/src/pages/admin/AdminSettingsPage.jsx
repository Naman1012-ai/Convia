import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { adminService } from '../../services/adminService';
import { NotificationService } from '../../services/notificationService';
import { NOTIFICATION_MESSAGES } from '../../utils/notificationMessages';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { LoadingSkeleton } from '../../components/feedback/LoadingSkeleton';
import {
  Settings,
  Shield,
  Sliders,
  Users,
  Briefcase,
  Lightbulb,
  AlertOctagon,
  CheckCircle2,
  Save,
  Download,
  Terminal,
  Layers,
} from 'lucide-react';

export default function AdminSettingsPage() {
  const { user: currentUser } = useAuth();

  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('general');

  useEffect(() => {
    setLoading(true);
    const unsubscribe = adminService.subscribeToPlatformSettings((data) => {
      setSettings(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      await adminService.updatePlatformSettings(
        currentUser.uid,
        currentUser.displayName || currentUser.email,
        settings
      );
      NotificationService.success(NOTIFICATION_MESSAGES.ADMIN.SETTINGS_SAVED);
    } catch (err) {
      NotificationService.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleExportJson = () => {
    if (!settings) return;
    const jsonStr = JSON.stringify(settings, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `convia_config_${Date.now()}.json`;
    a.click();
    NotificationService.success('Platform configuration exported as JSON.');
  };

  if (loading || !settings) {
    return (
      <div className="space-y-6 w-full">
        <LoadingSkeleton variant="card" count={3} />
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full pb-16">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2.5">
            <Settings className="h-6 w-6 text-purple-400" /> Platform Settings & System Configuration
          </h1>
          <p className="text-xs text-slate-400 mt-1 font-medium">
            Manage global operational variables, workspace limits, idea flags, maintenance modes, and feature toggles.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto">
          <Button
            variant="secondary"
            size="sm"
            icon={<Download className="h-4 w-4 text-purple-400" />}
            onClick={handleExportJson}
            className="bg-slate-900 border border-slate-800 text-slate-200 text-xs font-bold"
          >
            Export Config
          </Button>

          <Button
            variant="primary"
            size="sm"
            icon={<Save className="h-4 w-4" />}
            onClick={handleSave}
            isLoading={saving}
            className="bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs"
          >
            Save Changes
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2 overflow-x-auto">
        {[
          { id: 'general', label: 'General Info', icon: Sliders },
          { id: 'auth', label: 'Authentication', icon: Shield },
          { id: 'workspaces', label: 'Workspaces & Limits', icon: Briefcase },
          { id: 'ideas', label: 'Ideas & MVPs', icon: Lightbulb },
          { id: 'maintenance', label: 'Maintenance Mode', icon: AlertOctagon },
          { id: 'features', label: 'Feature Flags', icon: Layers },
          { id: 'diagnostics', label: 'System Diagnostics', icon: Terminal },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                isActive
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-900/40'
                  : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab 1: General Info */}
      {activeTab === 'general' && (
        <Card className="p-6 bg-slate-900 border border-slate-800 space-y-4">
          <h3 className="text-sm font-extrabold uppercase tracking-wider text-white border-b border-slate-800 pb-3">
            General Platform Attributes
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-medium">
            <div className="space-y-1.5">
              <label className="text-slate-300 font-bold">Platform Name</label>
              <input
                type="text"
                value={settings.general.platformName}
                onChange={(e) => setSettings({
                  ...settings,
                  general: { ...settings.general, platformName: e.target.value }
                })}
                className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-purple-500 font-bold"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-slate-300 font-bold">Support Email Address</label>
              <input
                type="email"
                value={settings.general.supportEmail}
                onChange={(e) => setSettings({
                  ...settings,
                  general: { ...settings.general, supportEmail: e.target.value }
                })}
                className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-purple-500 font-bold"
              />
            </div>

            <div className="md:col-span-2 space-y-1.5">
              <label className="text-slate-300 font-bold">Platform Tagline</label>
              <input
                type="text"
                value={settings.general.tagline}
                onChange={(e) => setSettings({
                  ...settings,
                  general: { ...settings.general, tagline: e.target.value }
                })}
                className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-purple-500 font-bold"
              />
            </div>
          </div>
        </Card>
      )}

      {/* Tab 2: Authentication */}
      {activeTab === 'auth' && (
        <Card className="p-6 bg-slate-900 border border-slate-800 space-y-4">
          <h3 className="text-sm font-extrabold uppercase tracking-wider text-white border-b border-slate-800 pb-3">
            Authentication & Security Policies
          </h3>

          <div className="space-y-4 text-xs">
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-950 border border-slate-800">
              <div>
                <p className="font-bold text-white">Require Email Verification</p>
                <p className="text-[11px] text-slate-400">Users must verify their email before creating workspaces.</p>
              </div>
              <input
                type="checkbox"
                checked={settings.auth.requireEmailVerification}
                onChange={(e) => setSettings({
                  ...settings,
                  auth: { ...settings.auth, requireEmailVerification: e.target.checked }
                })}
                className="h-4 w-4 rounded bg-slate-900 border-slate-700 text-purple-600 focus:ring-0 cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-950 border border-slate-800">
              <div>
                <p className="font-bold text-white">Allow New Registrations</p>
                <p className="text-[11px] text-slate-400">Enable or disable public signup forms across Convia.</p>
              </div>
              <input
                type="checkbox"
                checked={settings.auth.allowRegistrations}
                onChange={(e) => setSettings({
                  ...settings,
                  auth: { ...settings.auth, allowRegistrations: e.target.checked }
                })}
                className="h-4 w-4 rounded bg-slate-900 border-slate-700 text-purple-600 focus:ring-0 cursor-pointer"
              />
            </div>
          </div>
        </Card>
      )}

      {/* Tab 3: Workspaces & Limits */}
      {activeTab === 'workspaces' && (
        <Card className="p-6 bg-slate-900 border border-slate-800 space-y-5">
          <h3 className="text-sm font-extrabold uppercase tracking-wider text-white border-b border-slate-800 pb-3 flex items-center gap-2">
            <Briefcase className="h-4 w-4 text-purple-400" /> Workspace Limits & Policies
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-medium">
            <div className="space-y-1.5">
              <label className="text-slate-300 font-bold">Max Workspaces Per User</label>
              <input
                type="number"
                min={1}
                max={50}
                value={settings.workspaces.maxOrgsPerUser ?? 5}
                onChange={(e) => setSettings({
                  ...settings,
                  workspaces: { ...settings.workspaces, maxOrgsPerUser: parseInt(e.target.value) || 1 }
                })}
                className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-purple-500 font-bold"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-slate-300 font-bold">Max Members Per Workspace</label>
              <input
                type="number"
                min={1}
                max={200}
                value={settings.workspaces.maxMembersPerOrg ?? 20}
                onChange={(e) => setSettings({
                  ...settings,
                  workspaces: { ...settings.workspaces, maxMembersPerOrg: parseInt(e.target.value) || 1 }
                })}
                className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-purple-500 font-bold"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-slate-300 font-bold">Max Workspace Name Length</label>
              <input
                type="number"
                min={10}
                max={100}
                value={settings.workspaces.maxOrgNameLength ?? 50}
                onChange={(e) => setSettings({
                  ...settings,
                  workspaces: { ...settings.workspaces, maxOrgNameLength: parseInt(e.target.value) || 50 }
                })}
                className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-purple-500 font-bold"
              />
            </div>
          </div>

          <div className="space-y-3 pt-2 text-xs">
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-950 border border-slate-800">
              <div>
                <p className="font-bold text-white">Allow Workspace Creation</p>
                <p className="text-[11px] text-slate-400">Controls whether users can create new hackathon workspaces.</p>
              </div>
              <input
                type="checkbox"
                checked={settings.workspaces.allowWorkspaceCreation ?? true}
                onChange={(e) => setSettings({
                  ...settings,
                  workspaces: { ...settings.workspaces, allowWorkspaceCreation: e.target.checked }
                })}
                className="h-4 w-4 rounded bg-slate-900 border-slate-700 text-purple-600 focus:ring-0 cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-950 border border-slate-800">
              <div>
                <p className="font-bold text-white">Allow Workspace Joining</p>
                <p className="text-[11px] text-slate-400">Controls whether members can join workspaces via invite codes.</p>
              </div>
              <input
                type="checkbox"
                checked={settings.workspaces.allowWorkspaceJoining ?? true}
                onChange={(e) => setSettings({
                  ...settings,
                  workspaces: { ...settings.workspaces, allowWorkspaceJoining: e.target.checked }
                })}
                className="h-4 w-4 rounded bg-slate-900 border-slate-700 text-purple-600 focus:ring-0 cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-950 border border-slate-800">
              <div>
                <p className="font-bold text-white">Allow Workspace Deletion</p>
                <p className="text-[11px] text-slate-400">Controls whether workspace owners can purge their workspaces.</p>
              </div>
              <input
                type="checkbox"
                checked={settings.workspaces.allowWorkspaceDeletion ?? true}
                onChange={(e) => setSettings({
                  ...settings,
                  workspaces: { ...settings.workspaces, allowWorkspaceDeletion: e.target.checked }
                })}
                className="h-4 w-4 rounded bg-slate-900 border-slate-700 text-purple-600 focus:ring-0 cursor-pointer"
              />
            </div>
          </div>
        </Card>
      )}

      {/* Tab 4: Ideas & MVPs */}
      {activeTab === 'ideas' && (
        <Card className="p-6 bg-slate-900 border border-slate-800 space-y-5">
          <h3 className="text-sm font-extrabold uppercase tracking-wider text-white border-b border-slate-800 pb-3 flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-amber-400" /> Ideas, Voting & MVP Controls
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-medium">
            <div className="space-y-1.5">
              <label className="text-slate-300 font-bold">Max Ideas Per User</label>
              <input
                type="number"
                min={1}
                max={100}
                value={settings.ideas.maxIdeasPerUser ?? 10}
                onChange={(e) => setSettings({
                  ...settings,
                  ideas: { ...settings.ideas, maxIdeasPerUser: parseInt(e.target.value) || 10 }
                })}
                className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-purple-500 font-bold"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-2">
            {[
              { key: 'enableIdeaCreation', label: 'Proposal Creation', desc: 'Allow members to post new proposal ideas' },
              { key: 'enableIdeaImport', label: 'Idea Import', desc: 'Allow importing public ideas into workspaces' },
              { key: 'enableIdeaExport', label: 'Idea Export', desc: 'Allow exporting workspace proposals' },
              { key: 'enableVoting', label: 'Voting Module', desc: 'Allow members to cast votes on proposals' },
              { key: 'enableSuggestions', label: 'Community Suggestions', desc: 'Allow posting refinement suggestions' },
              { key: 'enableComments', label: 'Discussion Comments', desc: 'Allow discussion comments on proposals' },
              { key: 'enableBlueprint', label: 'AI Blueprint Generator', desc: 'Allow generating technical architecture blueprints' },
              { key: 'enableMvpSelection', label: 'MVP Selection', desc: 'Allow workspace leaders to select MVP' },
              { key: 'allowIdeaDeletion', label: 'Proposal Deletion', desc: 'Allow authors/owners to delete proposals' },
            ].map((item) => (
              <div key={item.key} className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                <div>
                  <p className="font-bold text-white">{item.label}</p>
                  <p className="text-[10px] text-slate-400">{item.desc}</p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.ideas[item.key] ?? true}
                  onChange={(e) => setSettings({
                    ...settings,
                    ideas: { ...settings.ideas, [item.key]: e.target.checked }
                  })}
                  className="h-4 w-4 rounded bg-slate-900 border-slate-700 text-purple-600 focus:ring-0 cursor-pointer"
                />
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Tab 5: Maintenance Mode */}
      {activeTab === 'maintenance' && (
        <Card className="p-6 bg-slate-900 border border-slate-800 space-y-4">
          <h3 className="text-sm font-extrabold uppercase tracking-wider text-white border-b border-slate-800 pb-3 flex items-center gap-2">
            <AlertOctagon className="h-4 w-4 text-amber-400" /> Platform Maintenance Controls
          </h3>

          <div className="space-y-4 text-xs">
            <div className="flex items-center justify-between p-4 rounded-xl bg-amber-950/40 border border-amber-900/60">
              <div>
                <p className="font-bold text-amber-300">Enable System Maintenance Mode</p>
                <p className="text-[11px] text-slate-400">Restricts non-administrator access and displays maintenance banner.</p>
              </div>
              <input
                type="checkbox"
                checked={settings.maintenance.maintenanceMode}
                onChange={(e) => setSettings({
                  ...settings,
                  maintenance: { ...settings.maintenance, maintenanceMode: e.target.checked }
                })}
                className="h-5 w-5 rounded bg-slate-900 border-amber-700 text-amber-500 focus:ring-0 cursor-pointer"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-slate-300 font-bold">Custom Maintenance Notice Message</label>
              <textarea
                rows={3}
                value={settings.maintenance.maintenanceMessage}
                onChange={(e) => setSettings({
                  ...settings,
                  maintenance: { ...settings.maintenance, maintenanceMessage: e.target.value }
                })}
                className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-purple-500 font-medium"
              />
            </div>
          </div>
        </Card>
      )}

      {/* Tab 6: Feature Flags */}
      {activeTab === 'features' && (
        <Card className="p-6 bg-slate-900 border border-slate-800 space-y-4">
          <h3 className="text-sm font-extrabold uppercase tracking-wider text-white border-b border-slate-800 pb-3">
            Module Feature Flags
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            {Object.entries(settings.featureFlags).map(([key, enabled]) => (
              <div key={key} className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                <span className="font-bold text-white capitalize">{key.replace(/([A-Z])/g, ' $1')} Module</span>
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={(e) => setSettings({
                    ...settings,
                    featureFlags: { ...settings.featureFlags, [key]: e.target.checked }
                  })}
                  className="h-4 w-4 rounded bg-slate-900 border-slate-700 text-purple-600 focus:ring-0 cursor-pointer"
                />
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Tab 7: System Diagnostics */}
      {activeTab === 'diagnostics' && (
        <Card className="p-6 bg-slate-900 border border-slate-800 space-y-4">
          <h3 className="text-sm font-extrabold uppercase tracking-wider text-white border-b border-slate-800 pb-3 flex items-center gap-2">
            <Terminal className="h-4 w-4 text-purple-400" /> Read-only System Diagnostics
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs font-mono">
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
              <span className="text-slate-400 text-[10px]">App Version</span>
              <p className="text-white font-bold text-sm">v1.0.0 (Production)</p>
            </div>
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
              <span className="text-slate-400 text-[10px]">Firebase Realtime Database</span>
              <p className="text-emerald-400 font-bold text-sm">Online & Connected</p>
            </div>
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
              <span className="text-slate-400 text-[10px]">Active Settings Node</span>
              <p className="text-purple-300 font-bold text-sm">/platform_settings</p>
            </div>
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
              <span className="text-slate-400 text-[10px]">Security Whitelist</span>
              <p className="text-amber-300 font-bold text-sm">VITE_ADMIN_EMAIL</p>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
