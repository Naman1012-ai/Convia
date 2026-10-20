import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { useAuth } from '../../hooks/useAuth';
import { discussionService } from '../../services/discussionService';
import { DiscussionThread } from './DiscussionThread';
import { Textarea } from '../../components/ui/Textarea';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Spinner } from '../../components/feedback/Spinner';
import { EmptyState } from '../../components/feedback/EmptyState';
import {
  MessageCircle,
  Lightbulb,
  HelpCircle,
  Send,
  Sparkles,
} from 'lucide-react';

export function DiscussionPanel({ idea, onToast = () => {} }) {
  const { user } = useAuth();

  const [discussions, setDiscussions] = useState([]);
  const [loading, setLoading] = useState(true);

  // Active Filter Tab: 'all' | 'comment' | 'suggestion' | 'question'
  const [filter, setFilter] = useState('all');

  // Input Form State
  const [type, setType] = useState('comment');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const ideaId = idea?.ideaId;
  const isIdeaOwner = user && idea && user.uid === idea.authorId;

  const isPublic = Boolean(!idea?.orgId);

  useEffect(() => {
    if (!ideaId) return;

    setLoading(true);
    const unsubscribe = discussionService.subscribeToDiscussions(
      { orgId: idea?.orgId || null, ideaId, isPublic },
      (items) => {
        setDiscussions(items);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [idea?.orgId, ideaId, isPublic]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!message.trim()) return;

    setIsSubmitting(true);
    try {
      await discussionService.createDiscussion(user, {
        ideaId,
        orgId: idea?.orgId || null,
        isPublic: !idea?.orgId,
        type,
        message,
      });

      setMessage('');
      onToast(
        type === 'suggestion'
          ? '💡 Technical suggestion posted!'
          : type === 'question'
          ? '❓ Question posted!'
          : '💬 Comment posted!'
      );
    } catch (err) {
      onToast(err.message || 'Failed to post message.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredDiscussions = discussions.filter((item) => {
    if (filter === 'all') return true;
    return item.type === filter;
  });

  const commentCount = discussions.filter((d) => d.type === 'comment' || !d.type).length;
  const suggestionCount = discussions.filter((d) => d.type === 'suggestion').length;
  const questionCount = discussions.filter((d) => d.type === 'question').length;

  return (
    <div className="space-y-6">
      {/* Discussion Tabs Bar */}
      <div className="border-b border-slate-200 pb-3">
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 w-full">
          <button
            onClick={() => setFilter('all')}
            className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition-colors shrink-0 ${
              filter === 'all'
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            All Threads ({discussions.length})
          </button>

          <button
            onClick={() => setFilter('comment')}
            className={`flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition-colors shrink-0 ${
              filter === 'comment'
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <MessageCircle className="h-3.5 w-3.5" /> Comments ({commentCount})
          </button>

          <button
            onClick={() => setFilter('suggestion')}
            className={`flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition-colors shrink-0 ${
              filter === 'suggestion'
                ? 'bg-amber-500 text-white'
                : 'bg-amber-50 text-amber-800 hover:bg-amber-100'
            }`}
          >
            <Lightbulb className="h-3.5 w-3.5" /> Suggestions ({suggestionCount})
          </button>

          <button
            onClick={() => setFilter('question')}
            className={`flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition-colors shrink-0 ${
              filter === 'question'
                ? 'bg-indigo-500 text-white'
                : 'bg-indigo-50 text-indigo-800 hover:bg-indigo-100'
            }`}
          >
            <HelpCircle className="h-3.5 w-3.5" /> Questions ({questionCount})
          </button>
        </div>
      </div>

      {/* Write New Discussion Input */}
      {user ? (
        <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-200 bg-white p-3.5 sm:p-5 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-indigo-600 shrink-0" /> Post to Discussion
            </h3>

            {/* Type Selector */}
            <div className="flex items-center gap-1 bg-slate-100 p-0.5 sm:p-1 rounded-xl text-xs w-full sm:w-auto justify-between sm:justify-start">
              <button
                type="button"
                onClick={() => setType('comment')}
                className={`flex-1 sm:flex-none text-center px-2 sm:px-2.5 py-1 rounded-lg font-bold transition-colors whitespace-nowrap text-[11px] sm:text-xs ${
                  type === 'comment'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                💬 Comment
              </button>
              <button
                type="button"
                onClick={() => setType('suggestion')}
                className={`flex-1 sm:flex-none text-center px-2 sm:px-2.5 py-1 rounded-lg font-bold transition-colors whitespace-nowrap text-[11px] sm:text-xs ${
                  type === 'suggestion'
                    ? 'bg-amber-500 text-white shadow-sm'
                    : 'text-amber-800 hover:text-amber-900'
                }`}
              >
                💡 Suggestion
              </button>
              <button
                type="button"
                onClick={() => setType('question')}
                className={`flex-1 sm:flex-none text-center px-2 sm:px-2.5 py-1 rounded-lg font-bold transition-colors whitespace-nowrap text-[11px] sm:text-xs ${
                  type === 'question'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-indigo-800 hover:text-indigo-900'
                }`}
              >
                ❓ Question
              </button>
            </div>
          </div>

          <Textarea
            placeholder={
              type === 'suggestion'
                ? '💡 Propose a technical improvement or architecture alternative...'
                : type === 'question'
                ? '❓ Ask an implementation or tech stack question...'
                : '💬 Share your feedback or general thoughts...'
            }
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={3}
            required
          />

          <div className="flex justify-end">
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={isSubmitting}
              icon={<Send className="h-4 w-4" />}
            >
              Submit {type === 'suggestion' ? 'Suggestion' : type === 'question' ? 'Question' : 'Comment'}
            </Button>
          </div>
        </form>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-center text-xs text-slate-500 font-medium">
          Sign in to vote, ask questions, or submit technical suggestions for this proposal.
        </div>
      )}

      {/* Discussion Stream */}
      {loading ? (
        <div className="flex min-h-[150px] items-center justify-center">
          <Spinner size="md" />
        </div>
      ) : filteredDiscussions.length === 0 ? (
        <EmptyState
          icon={<MessageCircle className="h-8 w-8 text-indigo-500" />}
          title="No Discussions Yet"
          description="Be the first team member to leave a comment, suggestion, or question!"
        />
      ) : (
        <div className="space-y-4">
          {filteredDiscussions.map((disc) => (
            <DiscussionThread
              key={disc.discussionId}
              discussion={disc}
              idea={idea}
              isIdeaOwner={isIdeaOwner}
              onToast={onToast}
            />
          ))}
        </div>
      )}
    </div>
  );
}

DiscussionPanel.propTypes = {
  idea: PropTypes.object,
  onToast: PropTypes.func,
};
