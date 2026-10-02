import React from 'react';
import PropTypes from 'prop-types';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Play, Sparkles, CheckCircle, Zap, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';

export function DemoModal({ isOpen, onClose }) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Convia Platform Demo" size="lg">
      <div className="space-y-6">
        {/* Demo Video / Interactive Showcase Card */}
        <div className="relative rounded-2xl border border-slate-800 bg-slate-950 p-6 shadow-2xl overflow-hidden text-white">
          <div className="absolute top-0 right-0 p-3">
            <span className="px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-primary-500/20 text-primary-300 border border-primary-500/30">
              Interactive Tour
            </span>
          </div>

          <div className="space-y-4 max-w-xl">
            <div className="inline-flex p-3 rounded-xl bg-primary-600/20 text-primary-400 border border-primary-500/30">
              <Zap className="h-6 w-6" />
            </div>

            <h3 className="text-xl font-extrabold tracking-tight">
              Real-Time Collaboration Engine
            </h3>

            <p className="text-xs text-slate-300 leading-relaxed font-medium">
              Convia eliminates endless debate during hackathons by structuring proposal collection, community voting, AI blueprint generation, and Kanban sprint execution into one unified workflow.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-xs font-semibold text-slate-200">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0" />
                <span>Instant Proposal Collection</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0" />
                <span>Real-Time Live Upvoting</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0" />
                <span>AI Technical PRD & Schema</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0" />
                <span>Auto-Populated Kanban Tasks</span>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Action Controls */}
        <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-800">
          <Button variant="ghost" onClick={onClose} className="text-xs font-bold text-slate-400 hover:text-white">
            Close Showcase
          </Button>

          <Link
            to="/signup"
            onClick={onClose}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-primary-600 to-primary-500 hover:from-primary-500 hover:to-primary-400 text-white font-extrabold text-xs shadow-lg hover:scale-105 transition-all"
          >
            <span>Create Free Workspace</span>
          </Link>
        </div>
      </div>
    </Modal>
  );
}

DemoModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
};
