import React from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { formatTimestamp } from '../../utils/formatting';
import { Sparkles, ArrowRight, CheckCircle2, ThumbsUp } from 'lucide-react';

export function ActiveProjectCard({ blueprint }) {
  if (!blueprint) return null;

  return (
    <Card className="border-2 border-indigo-500 bg-indigo-50/40 p-6 shadow-md">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="success" className="bg-emerald-600 text-white flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5" /> Active MVP Project
            </Badge>
            <Badge variant="info">{blueprint.difficultyLevel || 'Medium'} Build</Badge>
          </div>

          <h3 className="text-xl font-extrabold text-slate-900 mb-1">{blueprint.ideaTitle}</h3>
          <p className="text-xs text-slate-500">
            Selected by Leader · {formatTimestamp(blueprint.selectedAt)}
          </p>
        </div>

        <Link to={`/workspaces/${blueprint.orgId}/blueprint`}>
          <Button variant="primary" size="sm" icon={<ArrowRight className="h-4 w-4" />}>
            Open Blueprint
          </Button>
        </Link>
      </div>

      <p className="text-sm text-slate-700 line-clamp-2 leading-relaxed mb-4">
        {blueprint.problemStatement}
      </p>

      <div className="flex items-center justify-between pt-3 border-t border-indigo-100 text-xs font-semibold text-indigo-900">
        <span className="flex items-center gap-1">
          <ThumbsUp className="h-3.5 w-3.5 text-indigo-600" /> {blueprint.voteSummary?.totalVotes || 0} Team Votes
        </span>
        <span className="flex items-center gap-1 text-emerald-700">
          <Sparkles className="h-3.5 w-3.5" /> {blueprint.discussionSummary?.acceptedSuggestionsCount || 0} Accepted Suggestions
        </span>
      </div>
    </Card>
  );
}

ActiveProjectCard.propTypes = {
  blueprint: PropTypes.shape({
    orgId: PropTypes.string.isRequired,
    ideaTitle: PropTypes.string.isRequired,
    problemStatement: PropTypes.string.isRequired,
    difficultyLevel: PropTypes.string,
    selectedAt: PropTypes.number,
    voteSummary: PropTypes.object,
    discussionSummary: PropTypes.object,
  }),
};
