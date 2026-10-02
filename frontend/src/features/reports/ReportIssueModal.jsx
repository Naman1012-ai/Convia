import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { useLocation, useParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { reportService } from '../../services/reportService';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Textarea } from '../../components/ui/Textarea';
import {
  AlertCircle,
  CheckCircle2,
  Paperclip,
  X,
  Flag,
  FileText,
  ShieldAlert,
} from 'lucide-react';

export function ReportIssueModal({ isOpen, onClose }) {
  const { user } = useAuth();
  const location = useLocation();
  const { orgId, ideaId } = useParams();

  const [category, setCategory] = useState('Bug Report');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [affectedArea, setAffectedArea] = useState('Dashboard');
  const [severity, setSeverity] = useState('Medium');
  const [file, setFile] = useState(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [submittedReport, setSubmittedReport] = useState(null);

  if (!isOpen) return null;

  const categories = [
    { value: 'Bug Report', label: 'Bug Report' },
    { value: 'UI / UX Issue', label: 'UI / UX Issue' },
    { value: 'Performance Issue', label: 'Performance Issue' },
    { value: 'Authentication Problem', label: 'Authentication Problem' },
    { value: 'Workspace Problem', label: 'Workspace Problem' },
    { value: 'Idea Problem', label: 'Idea Problem' },
    { value: 'Task Problem', label: 'Task Problem' },
    { value: 'Feature Request', label: 'Feature Request' },
    { value: 'Security Issue', label: 'Security Issue' },
    { value: 'Abuse / Misconduct', label: 'Abuse / Misconduct' },
    { value: 'Other', label: 'Other' },
  ];

  const affectedAreas = [
    { value: 'Dashboard', label: 'Dashboard' },
    { value: 'Public Ideas', label: 'Public Ideas' },
    { value: 'Workspace', label: 'Workspace' },
    { value: 'Blueprint', label: 'Blueprint' },
    { value: 'Tasks', label: 'Tasks' },
    { value: 'Members', label: 'Members' },
    { value: 'Profile', label: 'Profile' },
    { value: 'Settings', label: 'Settings' },
    { value: 'Authentication', label: 'Authentication' },
    { value: 'Other', label: 'Other' },
  ];

  const severities = [
    { value: 'Low', label: 'Low' },
    { value: 'Medium', label: 'Medium' },
    { value: 'High', label: 'High' },
    { value: 'Critical', label: 'Critical' },
  ];

  const handleFileChange = (e) => {
    setError('');
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (selectedFile.size > 5 * 1024 * 1024) {
      setError('Attachment size exceeds 5 MB limit.');
      return;
    }

    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'application/pdf'];
    if (!validTypes.includes(selectedFile.type)) {
      setError('Only PNG, JPG, JPEG, and PDF files are allowed.');
      return;
    }

    setFile(selectedFile);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!title.trim()) {
      setError('Please provide an issue title.');
      return;
    }
    if (!description.trim()) {
      setError('Please provide an issue description.');
      return;
    }

    setIsSubmitting(true);

    try {
      const reportData = await reportService.createReport({
        user,
        title,
        description,
        category,
        affectedArea,
        severity,
        file,
        currentRoute: location.pathname,
        workspaceId: orgId || null,
        ideaId: ideaId || null,
      });

      setSubmittedReport(reportData);
    } catch (err) {
      setError(err.message || 'Failed to submit issue report. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetAndClose = () => {
    setTitle('');
    setDescription('');
    setCategory('Bug Report');
    setAffectedArea('Dashboard');
    setSeverity('Medium');
    setFile(null);
    setError('');
    setSubmittedReport(null);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleResetAndClose} title="Report an Issue" size="lg">
      {submittedReport ? (
        /* Success Screen */
        <div className="space-y-6 text-center py-6">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 shadow-md">
            <CheckCircle2 className="h-10 w-10" />
          </div>

          <div className="space-y-2">
            <h3 className="text-xl font-extrabold text-slate-900">✅ Thank you.</h3>
            <p className="text-sm text-slate-600 font-medium">
              Your issue has been submitted successfully. Our engineering and moderation team will review it shortly.
            </p>
          </div>

          <div className="bg-primary-50 border border-primary-200 rounded-2xl p-4 inline-block max-w-sm w-full mx-auto">
            <span className="text-xs font-bold uppercase tracking-wider text-primary-700">Report Reference ID</span>
            <div className="text-2xl font-mono font-black text-primary-900 tracking-wider mt-1">
              {submittedReport.reportId}
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex justify-center">
            <Button
              variant="primary"
              onClick={handleResetAndClose}
              className="bg-primary-600 hover:bg-primary-700 text-white font-bold px-8"
            >
              Done
            </Button>
          </div>
        </div>
      ) : (
        /* Submission Form */
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="bg-gradient-to-r from-slate-900 to-primary-950 text-white p-4 rounded-xl shadow-sm flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-primary-800/60 shrink-0 text-primary-200">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div>
              <h4 className="text-sm font-extrabold text-white">Platform Issue & Support Dispatch</h4>
              <p className="text-xs text-primary-200">
                Report bugs, UI glitches, abuse, or security issues directly to platform administrators.
              </p>
            </div>
          </div>

          {error && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-700 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Select
              label="Issue Category"
              options={categories}
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              disabled={isSubmitting}
              required
            />

            <Select
              label="Affected Area"
              options={affectedAreas}
              value={affectedArea}
              onChange={(e) => setAffectedArea(e.target.value)}
              disabled={isSubmitting}
            />

            <Select
              label="Severity"
              options={severities}
              value={severity}
              onChange={(e) => setSeverity(e.target.value)}
              disabled={isSubmitting}
            />
          </div>

          <Input
            label="Issue Title"
            placeholder="e.g. Tasks page becomes blank after refresh"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={100}
            required
            disabled={isSubmitting}
          />

          <Textarea
            label="Issue Description"
            placeholder="Explain the issue in detail. What were you doing when it occurred?"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            maxLength={3000}
            required
            disabled={isSubmitting}
          />

          {/* Attachment Upload Field */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
              Attachment (Optional — Max 5 MB)
            </label>
            <div className="flex items-center gap-3">
              <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-bold text-slate-700 transition-colors">
                <Paperclip className="h-4 w-4 text-primary-600" />
                <span>{file ? 'Change File' : 'Attach File (PNG, JPG, PDF)'}</span>
                <input
                  type="file"
                  accept=".png,.jpg,.jpeg,.pdf"
                  onChange={handleFileChange}
                  disabled={isSubmitting}
                  className="hidden"
                />
              </label>

              {file && (
                <div className="flex items-center gap-2 bg-primary-50 text-primary-800 border border-primary-200 px-3 py-1.5 rounded-lg text-xs font-medium">
                  <FileText className="h-3.5 w-3.5 text-primary-600" />
                  <span className="truncate max-w-[200px]">{file.name}</span>
                  <button
                    type="button"
                    onClick={() => setFile(null)}
                    className="hover:text-primary-950 p-0.5"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <Button variant="secondary" type="button" onClick={handleResetAndClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              variant="primary"
              type="submit"
              isLoading={isSubmitting}
              icon={<Flag className="h-4 w-4" />}
              className="bg-primary-600 hover:bg-primary-700 text-white font-bold"
            >
              Submit Report
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}

ReportIssueModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
};
