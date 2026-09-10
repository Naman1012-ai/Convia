import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { Lock, AlertCircle, Loader2 } from 'lucide-react';
import { Modal } from '../../components/ui/Modal';
import {
  CHANNEL_TYPES,
  normalizeChannelSlug,
  validateChannelSlug,
} from '../../constants/chatSchema';

export function CreateChannelModal({
  isOpen,
  onClose,
  onCreateChannel,
  isSubmitting = false,
}) {
  const [name, setName] = useState('');
  const [topic, setTopic] = useState('');
  const [error, setError] = useState(null);

  const previewSlug = normalizeChannelSlug(name);

  useEffect(() => {
    if (isOpen) {
      setName('');
      setTopic('');
      setError(null);
    }
  }, [isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    const validation = validateChannelSlug(previewSlug);
    if (!validation.valid) {
      setError(validation.error);
      return;
    }

    try {
      await onCreateChannel({
        name: previewSlug,
        topic: topic.trim(),
        type: CHANNEL_TYPES.WORKSPACE,
      });
      onClose();
    } catch (err) {
      setError(err?.message || 'Failed to create channel.');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create Channel"
      size="md"
    >
      <form onSubmit={handleSubmit} className="p-6 space-y-5">
        {error && (
          <div className="flex items-start gap-2.5 p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Channel Name */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
            Channel Name
          </label>
          <div className="relative">
            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 font-bold">
              #
            </span>
            <input
              type="text"
              required
              autoFocus
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (error) setError(null);
              }}
              placeholder="e.g. dev-team, roadmap, feedback"
              maxLength={40}
              className="w-full pl-8 pr-4 py-2.5 text-sm font-semibold text-slate-900 placeholder:text-slate-400 bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all shadow-2xs"
            />
          </div>
          {previewSlug && previewSlug !== name && (
            <p className="mt-1 text-xs text-slate-500">
              Slug preview: <code className="font-semibold text-indigo-600">#{previewSlug}</code>
            </p>
          )}
        </div>

        {/* Topic / Purpose */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
            Topic / Purpose <span className="text-slate-400 font-normal">(Optional)</span>
          </label>
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="What is this channel about?"
            maxLength={150}
            className="w-full px-3.5 py-2.5 text-sm font-semibold text-slate-900 placeholder:text-slate-400 bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all shadow-2xs"
          />
        </div>

        {/* Workspace Privacy Notice */}
        <div className="flex items-start gap-2.5 p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600">
          <Lock className="h-4 w-4 text-indigo-600 shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            This channel will be private to your workspace team. Only verified members of this workspace can view and send messages.
          </p>
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting || !previewSlug}
            className="inline-flex items-center gap-2 px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl shadow-xs transition-all"
          >
            {isSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            <span>Create Channel</span>
          </button>
        </div>
      </form>
    </Modal>
  );
}

CreateChannelModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onCreateChannel: PropTypes.func.isRequired,
  isSubmitting: PropTypes.bool,
};
