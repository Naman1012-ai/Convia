import { rtdbService } from './rtdbService.js';

/**
 * Backend AI Blueprint Context Preparation Service (Phase 3 Intelligence Upgrade).
 * Collects and structures project context, MVP requirements, team capability profiles,
 * and categorized discussion intelligence while enforcing data minimization and
 * parallel batch lookups (eliminating N+1 query loops).
 */
function escapeXmlContext(str, maxLength = 10000) {
  if (!str) return '';
  const text = String(str).substring(0, maxLength);
  return text
    .replace(/<\/?[a-zA-Z_:][a-zA-Z0-9_:-]*>/g, (match) => {
      // Escape tags matching XML delimiters to prevent prompt injection breakout
      if (/<\/?(project_context|project|problem_statement|proposed_solution|existing_tech_stack|team_capabilities|discussions|accepted_suggestions|unresolved_questions|community_comments)>/i.test(match)) {
        return match.replace(/</g, '&lt;').replace(/>/g, '&gt;');
      }
      return match;
    });
}

export const aiBlueprintService = {
  prepareAiInputContext: async (workspaceId, mvpIdea) => {
    if (!workspaceId || !mvpIdea) {
      throw new Error('Workspace ID and MVP Idea snapshot are required.');
    }

    try {
      const targetIdeaId = mvpIdea.ideaId || mvpIdea.id;
      // 1. Parallel fetch of workspace members and discussions (with canonical path hierarchy)
      const [membersObjRaw, discussionsObjRaw] = await Promise.all([
        rtdbService.getData(`organization_members/${workspaceId}`),
        rtdbService.getData(`discussions/${workspaceId}/${targetIdeaId}`).catch(() => null)
          .then((d) => d || rtdbService.getData(`discussions/public/${targetIdeaId}`).catch(() => null))
          .then((d) => d || rtdbService.getData(`discussions/${targetIdeaId}`).catch(() => null)),
      ]);

      const membersObj = membersObjRaw || {};
      const memberUids = Object.keys(membersObj);

      // 2. Parallel fetch of all team member profiles (Fixes N+1 sequential loop)
      const memberProfiles = await Promise.all(
        memberUids.map(async (uid) => {
          const userProfile = (await rtdbService.getData(`users/${uid}`)) || {};
          const memberMeta = membersObj[uid] || {};

          // Parse declared skills from comma-separated string or array
          let declaredSkills = [];
          if (Array.isArray(userProfile.skills)) {
            declaredSkills = userProfile.skills.map((s) => String(s).trim()).filter(Boolean);
          } else if (typeof userProfile.skills === 'string' && userProfile.skills.trim()) {
            declaredSkills = userProfile.skills
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean);
          } else if (Array.isArray(userProfile.technicalSkills)) {
            declaredSkills = userProfile.technicalSkills.map((s) => String(s).trim()).filter(Boolean);
          }

          // Parse preferred tech stack
          let preferredTechStack = '';
          if (typeof userProfile.techStack === 'string' && userProfile.techStack.trim()) {
            preferredTechStack = userProfile.techStack.trim();
          }

          // Data minimization: Strictly sanitize personal PII (no passwords, tokens, full emails)
          const rawName = userProfile.displayName || userProfile.name;
          const sanitizedName = rawName
            ? String(rawName).trim()
            : userProfile.email
            ? String(userProfile.email).split('@')[0]
            : `Member_${uid.slice(0, 6)}`;

          return {
            id: uid,
            name: sanitizedName,
            workspaceRole: memberMeta.role || 'Contributor',
            declaredSkills,
            hasDeclaredSkills: declaredSkills.length > 0,
            preferredTechStack: preferredTechStack || undefined,
            college: userProfile.college ? String(userProfile.college).trim() : undefined,
            interests: userProfile.interests ? String(userProfile.interests).trim() : undefined,
          };
        })
      );

      // 3. Process and categorize discussions
      const discussionsObj = discussionsObjRaw || {};
      const allDiscussions = Object.values(discussionsObj).filter((d) => d && !d.isDeleted);

      const acceptedSuggestions = [];
      const otherSuggestions = [];
      const comments = [];
      const questions = [];

      for (const item of allDiscussions) {
        const cleanItem = {
          id: item.discussionId || item.id || `disc_${Math.random().toString(36).slice(2, 7)}`,
          authorName: item.authorName || 'Collaborator',
          message: (item.message || '').trim(),
          isAccepted: Boolean(item.isAccepted),
          createdAt: item.createdAt || Date.now(),
        };

        if (item.type === 'suggestion') {
          if (item.isAccepted) {
            acceptedSuggestions.push(cleanItem);
          } else {
            otherSuggestions.push(cleanItem);
          }
        } else if (item.type === 'question') {
          questions.push(cleanItem);
        } else {
          comments.push(cleanItem);
        }
      }

      // 4. Bound discussion lists to prevent unbounded payload growth while preserving key insights
      const boundedAccepted = acceptedSuggestions.slice(0, 10);
      const boundedOther = otherSuggestions.slice(0, 8);
      const boundedQuestions = questions.slice(0, 6);
      const boundedComments = comments.slice(0, 8);

      const allSuggestions = [...boundedAccepted, ...boundedOther];

      // 5. Construct enriched AI context payload with XML breakout defense
      const projectTitle = escapeXmlContext(mvpIdea.title || 'Untitled MVP', 200);
      const problemStatement = escapeXmlContext(mvpIdea.problemStatement || '', 10000);
      const description = escapeXmlContext(mvpIdea.proposedSolution || mvpIdea.description || mvpIdea.problemStatement || '', 20000);
      const techStack = mvpIdea.techStack ? escapeXmlContext(mvpIdea.techStack, 2000) : undefined;

      return {
        // Core Project Identity
        ideaTitle: projectTitle,
        problemStatement,
        description,
        techStack,
        category: mvpIdea.category || 'Software Application',
        difficultyLevel: mvpIdea.difficultyLevel || 'Intermediate',
        targetAudience: mvpIdea.targetAudience || 'Target end users and developers',
        projectStatus: mvpIdea.projectStatus || 'In Ideation',
        voteCount: Number(mvpIdea.voteCount) || 0,
        authorName: mvpIdea.authorName || 'Project Creator',

        // Team Capability Context (bounded to active members)
        teamMembers: memberProfiles.slice(0, 12),

        // Discussion Intelligence
        discussions: {
          acceptedSuggestions: boundedAccepted,
          otherSuggestions: boundedOther,
          unresolvedQuestions: boundedQuestions,
          importantComments: boundedComments,
          totalCount: allDiscussions.length,
        },

        // Backward Compatible Discussion Lists
        suggestions: allSuggestions,
        comments: boundedComments,
        questions: boundedQuestions,
      };
    } catch (error) {
      console.error('[backend aiBlueprintService] prepareAiInputContext error:', error);
      throw error;
    }
  },
};
