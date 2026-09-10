import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import {
  Hash,
  Lock,
  Archive,
  Trash2,
  AlertTriangle,
  Loader2,
  Check,
} from 'lucide-react';
import { Modal } from '../../components/ui/Modal';
import { DEFAULT_CHAT_CHANNEL_ID } from '../../constants/chatSchema';
import { formatTimestamp } from '../../utils/formatting';

export function ChannelSettingsModal({
  isOpen,
  onClose,
  channel,
  isLeader = false,
  onUpdateTopic,
  onArchiveChannel,
  onDeleteChannel,
}) {
  const [topic, setTopic] = useState('');
  const [isSavingTopic, setIsSavingTopic] = useState(false);
  const [topicSaved, setTopicSaved] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (channel) {
      setTopic(channel.topic || '');
      setShowDeleteConfirm(false);
      setError(null);
      setTopicSaved(false);
    }
  }, [channel, isOpen]);

  if (!channel) return null;

  const isGeneral = channel.channelId === DEFAULT_CHAT_CHANNEL_ID;

  const handleSaveTopic = async (e) => {
    e.preventDefault();
    if (!isLeader) return;
    setIsSavingTopic(true);
    setError(null);
    try {
      await onUpdateTopic(topic.trim());
      setTopicSaved(true);
      setTimeout(() => setTopicSaved(false), 2000);
    } catch (err) {
      setError(err?.message || 'Failed to update channel topic.');
    } finally {
      setIsSavingTopic(false);
    }
  };

  const handleToggleArchive = async () => {
    if (!isLeader || isGeneral) return;
    setIsArchiving(true);
    setError(null);
    try {
      await onArchiveChannel(!channel.archived);
    } catch (err) {
      setError(err?.message || 'Failed to update channel archival status.');
    } finally {
      setIsArchiving(false);
    }
  };

  const handleDelete = async () => {
    if (!isLeader || isGeneral) return;
    setIsDeleting(true);
    setError(null);
    try {
      await onDeleteChannel();
      onClose();
    } catch (err) {
      setError(err?.message || 'Failed to delete channel.');
      setIsDeleting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Channel Settings — #${channel.name || channel.channelId}`}
      size="md"
    >
      <div className="p-6 space-y-6">
        {error && (
          <div className="flex items-start gap-2.5 p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Channel Details Overview */}
        <div className="flex items-center justify-between p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-indigo-100 text-indigo-700">
              {isGeneral ? <Hash className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-slate-900">#{channel.name || channel.channelId}</span>
                {isGeneral && (
                  <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-slate-200 text-slate-700 rounded-full">
                    Default
                  </span>
                )}
                {channel.archived && (
                  <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-800 rounded-full">
                    Archived
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Internal Workspace Channel
                {channel.createdAt ? ` • Created ${formatTimestamp(channel.createdAt)}` : ''}
              </p>
            </div>
          </div>
        </div>

        {/* Edit Topic (Leaders only) */}
        <form onSubmit={handleSaveTopic} className="space-y-3">
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
            Channel Topic / Purpose
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              disabled={!isLeader}
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="What is this channel about?"
              maxLength={150}
              className="flex-1 px-3.5 py-2 text-sm font-semibold text-slate-900 placeholder:text-slate-400 bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:opacity-60 transition-all shadow-2xs"
            />
            {isLeader && (
              <button
                type="submit"
                disabled={isSavingTopic}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-xl transition-all"
              >
                {isSavingTopic ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : topicSaved ? (
                  <>
                    <Check className="h-3.5 w-3.5" />
                    <span>Saved</span>
                  </>
                ) : (
                  <span>Save</span>
                )}
              </button>
            )}
          </div>
        </form>

        {/* Channel Management Actions (Leaders only, non-general only) */}
        {isLeader && !isGeneral && (
          <div className="space-y-3 pt-4 border-t border-slate-100">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Management
            </h4>

            {/* Archive / Unarchive */}
            <div className="flex items-center justify-between p-3 border border-slate-200 rounded-xl bg-slate-50/50">
              <div>
                <p className="text-xs font-semibold text-slate-900">
                  {channel.archived ? 'Unarchive Channel' : 'Archive Channel'}
                </p>
                <p className="text-[11px] text-slate-500">
                  {channel.archived
                    ? 'Allow members to send messages and replies again.'
                    : 'Freeze this channel into read-only mode for historical record.'}
                </p>
              </div>
              <button
                type="button"
                onClick={handleToggleArchive}
                disabled={isArchiving}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                  channel.archived
                    ? 'bg-slate-200 hover:bg-slate-300 text-slate-800'
                    : 'bg-amber-100 hover:bg-amber-200 text-amber-800'
                }`}
              >
                {isArchiving ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Archive className="h-3.5 w-3.5" />
                )}
                <span>{channel.archived ? 'Unarchive' : 'Archive'}</span>
              </button>
            </div>

            {/* Delete Channel */}
            <div className="p-3 border border-rose-200 rounded-xl bg-rose-50/30">
              {!showDeleteConfirm ? (
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-rose-900">Delete Channel</p>
                    <p className="text-[11px] text-rose-600">
                      Permanently delete this channel and its message history.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded-lg transition-colors shadow-2xs"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Delete</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-start gap-2 text-rose-800 text-xs">
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                    <p>
                      Are you sure you want to permanently delete <strong>#{channel.name}</strong>? This action cannot be undone.
                    </p>
                  </div>
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowDeleteConfirm(false)}
                      disabled={isDeleting}
                      className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-800"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleDelete}
                      disabled={isDeleting}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded-lg shadow-2xs"
                    >
                      {isDeleting && <Loader2 className="h-3 w-3 animate-spin" />}
                      <span>Confirm Delete</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {isGeneral && (
          <p className="text-[11px] text-slate-500 italic bg-slate-50 p-3 rounded-xl border border-slate-200/60">
            ℹ The #general channel is the default root channel for this workspace and is protected from deletion and archiving.
          </p>
        )}
      </div>
    </Modal>
  );
}

ChannelSettingsModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  channel: PropTypes.object,
  isLeader: PropTypes.bool,
  onUpdateTopic: PropTypes.func.isRequired,
  onArchiveChannel: PropTypes.func.isRequired,
  onDeleteChannel: PropTypes.func.isRequired,
};
