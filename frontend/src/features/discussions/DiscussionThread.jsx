import React, { useState, useMemo } from 'react';
import PropTypes from 'prop-types';
import { useAuth } from '../../hooks/useAuth';
import { discussionService } from '../../services/discussionService';
import { useUserProfile, useUserProfiles } from '../../hooks/useUserProfile';
import { Avatar } from '../../components/ui/Avatar';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Textarea } from '../../components/ui/Textarea';
import { formatTimestamp } from '../../utils/formatting';
import {
  MessageCircle,
  Lightbulb,
  HelpCircle,
  CheckCircle2,
  Reply,
  Pencil,
  Trash2,
  Send,
} from 'lucide-react';

export function DiscussionThread({ discussion, idea, isIdeaOwner, onToast = () => {} }) {
  const { user } = useAuth();

  const [isReplying, setIsReplying] = useState(false);
  const [replyMessage, setReplyMessage] = useState('');
  const [isSubmittingReply, setIsSubmittingReply] = useState(false);

  const [isEditing, setIsEditing] = useState(false);
  const [editMessage, setEditMessage] = useState(discussion.message);
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);

  // Real-time parent discussion author resolution
  const { displayName: authorDisplayName } = useUserProfile(discussion.authorId, {
    fallbackName: discussion.authorName || 'Contributor',
  });

  // Real-time reply authors resolution
  const replyAuthorIds = useMemo(() => {
    if (!discussion.replies || !Array.isArray(discussion.replies)) return [];
    return Array.from(new Set(discussion.replies.map((r) => r.authorId).filter(Boolean)));
  }, [discussion.replies]);

  const { resolveName } = useUserProfiles(replyAuthorIds);

  const isAuthor = user && user.uid === discussion.authorId;
  const isSuggestion = discussion.type === 'suggestion';
  const isQuestion = discussion.type === 'question';

  const effectiveOrgId = idea?.orgId || discussion?.orgId || null;

  const handleReplySubmit = async (e) => {
    e.preventDefault();
    if (!replyMessage.trim()) return;

    setIsSubmittingReply(true);
    try {
      await discussionService.createDiscussion(user, {
        ideaId: discussion.ideaId,
        orgId: effectiveOrgId,
        isPublic: !effectiveOrgId,
        type: 'comment',
        message: replyMessage,
        parentId: discussion.discussionId,
      });

      setReplyMessage('');
      setIsReplying(false);
      onToast('Reply posted successfully!');
    } catch (err) {
      onToast(err.message || 'Failed to post reply.');
    } finally {
      setIsSubmittingReply(false);
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editMessage.trim()) return;

    setIsSubmittingEdit(true);
    try {
      await discussionService.updateDiscussion(
        effectiveOrgId,
        discussion.ideaId,
        discussion.discussionId,
        { message: editMessage },
        !effectiveOrgId
      );
      setIsEditing(false);
      onToast('Updated successfully!');
    } catch (err) {
      onToast(err.message || 'Failed to update message.');
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this post?')) return;
    try {
      await discussionService.deleteDiscussion(
        effectiveOrgId,
        discussion.ideaId,
        discussion.discussionId,
        !effectiveOrgId
      );
      onToast('Deleted successfully.');
    } catch (err) {
      onToast(err.message || 'Failed to delete message.');
    }
  };

  const handleToggleAccept = async () => {
    try {
      await discussionService.toggleAcceptSuggestion(
        effectiveOrgId,
        discussion.ideaId,
        discussion.discussionId,
        discussion.isAccepted,
        !effectiveOrgId
      );
      onToast(
        discussion.isAccepted
          ? 'Suggestion status updated.'
          : '✅ Suggestion accepted by Idea Owner!'
      );
    } catch (err) {
      onToast(err.message || 'Failed to update status.');
    }
  };

  return (
    <div
      className={`rounded-2xl border p-5 transition-all ${
        isSuggestion
          ? discussion.isAccepted
            ? 'border-emerald-300 bg-emerald-50/70 shadow-sm'
            : 'border-amber-200 bg-amber-50/50 shadow-sm'
          : isQuestion
          ? 'border-indigo-200 bg-indigo-50/40 shadow-sm'
          : 'border-slate-200 bg-white shadow-sm'
      }`}
    >
      {/* Header Info */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-3">
          <Avatar name={isAuthor ? 'You' : authorDisplayName} size="sm" />
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-slate-900">
                {authorDisplayName}
              </span>
              {isAuthor && (
                <span className="text-[10px] font-bold text-indigo-700 bg-indigo-100 px-1.5 py-0.5 rounded">
                  You
                </span>
              )}
            </div>
            <span className="text-[11px] text-slate-400">
              {formatTimestamp(discussion.createdAt)}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Type Badges */}
          {isSuggestion ? (
            <Badge variant="warning" className="flex items-center gap-1">
              <Lightbulb className="h-3 w-3" /> Suggestion
            </Badge>
          ) : isQuestion ? (
            <Badge variant="info" className="flex items-center gap-1">
              <HelpCircle className="h-3 w-3" /> Question
            </Badge>
          ) : (
            <Badge variant="default" className="flex items-center gap-1">
              <MessageCircle className="h-3 w-3 text-slate-500" /> Comment
            </Badge>
          )}

          {/* Author Edit/Delete Triggers */}
          {isAuthor && !isEditing && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => setIsEditing(true)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded transition-colors"
                title="Edit message"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={handleDelete}
                className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors"
                title="Delete message"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Suggestion Acceptance Banner */}
      {isSuggestion && discussion.isAccepted && (
        <div className="mb-3 rounded-lg bg-emerald-100/80 px-3 py-1.5 text-xs font-bold text-emerald-900 flex items-center gap-1.5">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          <span>✅ Accepted by Idea Owner</span>
        </div>
      )}

      {/* Message Body or Edit Form */}
      {isEditing ? (
        <form onSubmit={handleEditSubmit} className="space-y-3 my-2">
          <Textarea
            value={editMessage}
            onChange={(e) => setEditMessage(e.target.value)}
            rows={2}
            required
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setIsEditing(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" isLoading={isSubmittingEdit}>
              Save
            </Button>
          </div>
        </form>
      ) : (
        <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap mb-3">
          {discussion.message}
        </p>
      )}

      {/* Actions Bar */}
      <div className="flex items-center justify-between pt-2 border-t border-slate-100/80 text-xs">
        <button
          onClick={() => setIsReplying((prev) => !prev)}
          className="flex items-center gap-1.5 font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
        >
          <Reply className="h-3.5 w-3.5" />
          <span>Reply</span>
        </button>

        {/* Idea Owner Accept Suggestion Button */}
        {isIdeaOwner && isSuggestion && (
          <button
            onClick={handleToggleAccept}
            className={`flex items-center gap-1.5 font-bold px-2.5 py-1 rounded-md transition-colors ${
              discussion.isAccepted
                ? 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm'
            }`}
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>{discussion.isAccepted ? 'Unmark Accepted' : 'Accept Suggestion'}</span>
          </button>
        )}
      </div>

      {/* Threaded Reply Input Form */}
      {isReplying && (
        <form onSubmit={handleReplySubmit} className="mt-3 space-y-3 pt-3 border-t border-slate-200">
          <Textarea
            placeholder={`Reply to ${authorDisplayName}...`}
            value={replyMessage}
            onChange={(e) => setReplyMessage(e.target.value)}
            rows={2}
            required
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setIsReplying(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={isSubmittingReply}
              icon={<Send className="h-3.5 w-3.5" />}
            >
              Post Reply
            </Button>
          </div>
        </form>
      )}

      {/* Nested Threaded Replies */}
      {discussion.replies && discussion.replies.length > 0 && (
        <div className="mt-4 space-y-3 pl-4 border-l-2 border-indigo-200">
          {discussion.replies.map((reply) => (
            <div key={reply.discussionId} className="rounded-xl bg-slate-50 p-3 text-xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900">
                  {resolveName(reply.authorId, reply.authorName || 'Contributor')}
                </span>
                <span className="text-[10px] text-slate-400">
                  {formatTimestamp(reply.createdAt)}
                </span>
              </div>
              <p className="text-slate-700 leading-relaxed whitespace-pre-wrap">{reply.message}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

DiscussionThread.propTypes = {
  discussion: PropTypes.object.isRequired,
  idea: PropTypes.object,
  isIdeaOwner: PropTypes.bool,
  onToast: PropTypes.func,
};
