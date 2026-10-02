import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { useAuth } from '../../hooks/useAuth';
import { publicIdeaService } from '../../services/publicIdeaService';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { Textarea } from '../../components/ui/Textarea';
import { Select } from '../../components/ui/Select';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { validateIdeaTitle, validateProblemStatement } from '../../utils/validation';
import { CHAR_LIMITS } from '../../config/constants';
import {
  Globe,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  PlusCircle,
  X,
  ShieldCheck,
} from 'lucide-react';

export function CreatePublicIdeaModal({ isOpen, onClose, onSuccess = () => {}, initialValues = null }) {
  const { user } = useAuth();

  // Stage: 'form' | 'success'
  const [stage, setStage] = useState('form');

  // Form State
  const [title, setTitle] = useState('');
  const [problemStatement, setProblemStatement] = useState('');
  const [proposedSolution, setProposedSolution] = useState('');
  const [techStack, setTechStack] = useState('');
  const [category, setCategory] = useState('General');

  // Published Idea Reference
  const [publishedIdea, setPublishedIdea] = useState(null);

  // Error & Loading States
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sync initialValues when opened from contextual community discussion
  React.useEffect(() => {
    if (isOpen && initialValues) {
      if (initialValues.title) setTitle(initialValues.title);
      if (initialValues.problemStatement) setProblemStatement(initialValues.problemStatement);
      if (initialValues.proposedSolution) setProposedSolution(initialValues.proposedSolution);
      if (initialValues.category) setCategory(initialValues.category);
    }
  }, [isOpen, initialValues]);

  const resetForm = () => {
    setTitle('');
    setProblemStatement('');
    setProposedSolution('');
    setTechStack('');
    setCategory('General');
    setErrors({});
    setServerError('');
    setPublishedIdea(null);
    setStage('form');
  };

  const handleModalClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setServerError('');

    const titleVal = validateIdeaTitle(title);
    const probVal = validateProblemStatement(problemStatement);

    if (!titleVal.valid || !probVal.valid) {
      setErrors({
        title: titleVal.error,
        problemStatement: probVal.error,
      });
      return;
    }

    setErrors({});
    setIsSubmitting(true);

    try {
      // Confirmed write to Firebase
      const createdIdea = await publicIdeaService.createPublicIdea(user, {
        title,
        problemStatement,
        proposedSolution,
        techStack,
        category,
      });

      setPublishedIdea(createdIdea);
      setStage('success');
      onSuccess(createdIdea);
    } catch (err) {
      setServerError('❌ Failed to publish your idea. Please check your connection and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleModalClose}
      title={stage === 'success' ? '🎉 Proposal Published!' : 'Post a Public Idea'}
      size="lg"
    >
      {stage === 'form' ? (
        <form onSubmit={handleSubmit} className="space-y-4">
          {serverError && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-sm text-rose-700 font-medium flex items-center gap-2">
              <span>{serverError}</span>
            </div>
          )}

          <div className="rounded-xl border border-primary-200/60 bg-primary-50/60 p-4 mb-2 flex items-center gap-3">
            <Globe className="h-5 w-5 text-primary-600 shrink-0" />
            <p className="text-xs text-primary-900 leading-relaxed">
              Public ideas are visible to all Convia innovators. Great for open feedback, networking, or finding future hackathon teammates!
            </p>
          </div>

          <Input
            label="Idea Title"
            placeholder="e.g., AI Interview Coach"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            error={errors.title}
            maxLength={CHAR_LIMITS.IDEA_TITLE}
            required
          />

          <Textarea
            label="Problem Statement"
            placeholder="What problem does this solve?"
            value={problemStatement}
            onChange={(e) => setProblemStatement(e.target.value)}
            error={errors.problemStatement}
            maxLength={CHAR_LIMITS.PROBLEM_STATEMENT}
            rows={3}
            required
          />

          <Textarea
            label="Proposed Solution (Optional)"
            placeholder="How would your project solve it?"
            value={proposedSolution}
            onChange={(e) => setProposedSolution(e.target.value)}
            maxLength={CHAR_LIMITS.PROPOSED_SOLUTION}
            rows={3}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Tech Stack Tags"
              placeholder="e.g., React, Python, OpenAI, Docker"
              value={techStack}
              onChange={(e) => setTechStack(e.target.value)}
            />

            <Select
              label="Domain Category"
              options={[
                { value: 'General', label: 'General / Open Innovation' },
                { value: 'AI & ML', label: 'AI & Machine Learning' },
                { value: 'Web3 & Fintech', label: 'Web3 & Fintech' },
                { value: 'Healthcare', label: 'Healthcare & Biotech' },
                { value: 'Sustainability', label: 'Sustainability & Climate' },
                { value: 'Developer Tools', label: 'Developer Tools & Cloud' },
              ]}
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <Button variant="ghost" onClick={handleModalClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={isSubmitting}>
              Publish Public Idea
            </Button>
          </div>
        </form>
      ) : (
        /* Stage 2: Modern Success Confirmation Dialog */
        <div className="space-y-6 py-2">
          {/* Header Badge */}
          <div className="text-center space-y-2">
            <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600 shadow-inner mb-2">
              <Sparkles className="h-8 w-8" />
            </div>
            <h2 className="text-xl font-extrabold text-slate-900">
              🎉 Public Idea Published Successfully!
            </h2>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Your proposal has been stored securely in Convia and is now live on the public feed for community feedback.
            </p>
          </div>

          {/* Published Details Snapshot Card */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
            <div className="flex items-start justify-between gap-2 border-b border-slate-200 pb-3">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Title
                </span>
                <h3 className="text-base font-bold text-slate-900">{publishedIdea?.title}</h3>
              </div>
              <Badge variant="info">{publishedIdea?.category || 'General'}</Badge>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
              <div>
                <span className="text-slate-400 font-medium">Visibility:</span>
                <p className="font-bold text-slate-800 flex items-center gap-1">
                  <Globe className="h-3.5 w-3.5 text-indigo-500" /> Public
                </p>
              </div>

              <div>
                <span className="text-slate-400 font-medium">Status:</span>
                <p className="font-bold text-amber-700 flex items-center gap-1">
                  📝 Draft
                </p>
              </div>

              <div>
                <span className="text-slate-400 font-medium">Posted:</span>
                <p className="font-bold text-slate-800">Just now</p>
              </div>
            </div>
          </div>

          {/* Verification Checkmarks */}
          <div className="space-y-2 rounded-xl bg-emerald-50/60 p-4 border border-emerald-100 text-xs text-emerald-900">
            <div className="flex items-center gap-2 font-semibold">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <span>Stored securely in Convia Database</span>
            </div>
            <div className="flex items-center gap-2 font-semibold">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <span>Visible on Public Innovation Dashboard</span>
            </div>
            <div className="flex items-center gap-2 font-semibold">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <span>Available for community votes and feedback</span>
            </div>
          </div>

          {/* Success Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <Button
              variant="secondary"
              icon={<PlusCircle className="h-4 w-4" />}
              onClick={() => setStage('form')}
            >
              Create Another Idea
            </Button>

            <Button
              variant="primary"
              icon={<ArrowRight className="h-4 w-4" />}
              onClick={handleModalClose}
            >
              View My Idea
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

CreatePublicIdeaModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onSuccess: PropTypes.func,
};
