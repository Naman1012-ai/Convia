import React, { createContext, useState, useEffect, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import { useAuth } from '../hooks/useAuth';
import { useOrg } from '../hooks/useOrg';
import { ideaService } from '../services/ideaService';

export const IdeaContext = createContext({
  ideas: [],
  filteredIdeas: [],
  loading: true,
  searchQuery: '',
  setSearchQuery: () => {},
  sortBy: 'most_voted',
  setSortBy: () => {},
  activeFilter: 'all',
  setActiveFilter: () => {},
  stats: {
    totalIdeas: 0,
    totalVotes: 0,
    totalSuggestions: 0,
    totalAcceptedSuggestions: 0,
    totalAcceptedIdeas: 0,
    topVotedCount: 0,
    selectedMvp: null,
    myIdeasCount: 0,
  },
  createIdea: async () => {},
  updateIdea: async () => {},
  deleteIdea: async () => {},
});

export function IdeaProvider({ children }) {
  const { user } = useAuth();
  const { org } = useOrg();

  const [ideas, setIdeas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('most_voted'); // 'most_voted' | 'newest'
  const [activeFilter, setActiveFilter] = useState('all'); // 'all' | 'selected' | 'top' | 'mine'

  const orgId = org?.orgId;

  useEffect(() => {
    // Reset workspace-scoped idea state and filters on orgId change
    setIdeas([]);
    setSearchQuery('');
    setActiveFilter('all');
    setSortBy('most_voted');

    if (!orgId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    let isSubscribed = true;

    const unsubscribe = ideaService.subscribeToIdeas(orgId, (ideasArray) => {
      if (!isSubscribed) return;
      setIdeas(ideasArray || []);
      setLoading(false);
    });

    return () => {
      isSubscribed = false;
      unsubscribe();
    };
  }, [orgId]);

  const createIdea = useCallback(
    async (ideaData) => {
      if (!orgId || !user) return;
      return await ideaService.createIdea(orgId, user, ideaData);
    },
    [orgId, user]
  );

  const updateIdea = useCallback(
    async (ideaId, updates) => {
      if (!orgId) return;
      await ideaService.updateIdea(orgId, ideaId, updates);
    },
    [orgId]
  );

  const deleteIdea = useCallback(
    async (ideaId, isMvp = false) => {
      if (!orgId) return;
      await ideaService.deleteIdea(orgId, ideaId, isMvp);
    },
    [orgId]
  );

  const updateIdeaStatus = useCallback(
    async (ideaId, newStatus) => {
      if (!orgId) return;
      return await ideaService.updateIdeaStatus(orgId, ideaId, newStatus);
    },
    [orgId]
  );

  // Aggregated workspace dashboard statistics
  const stats = useMemo(() => {
    const totalIdeas = ideas.length;
    const totalVotes = ideas.reduce((sum, item) => sum + (item.voteCount || 0), 0);
    const totalSuggestions = ideas.reduce((sum, item) => sum + (item.suggestionCount || 0), 0);
    const totalAcceptedSuggestions = ideas.reduce((sum, item) => sum + (item.acceptedSuggestionCount || 0), 0);
    const selectedMvp = ideas.find(
      (item) => item && !item.isDeleted && (item.isSelected || item.status === 'selected' || item.status === 'Selected MVP')
    ) || null;
    const totalAcceptedIdeas = ideas.filter(
      (item) => item && !item.isDeleted && (item.isSelected || item.status === 'selected' || item.status === 'Selected MVP' || item.projectStatus === 'Selected MVP' || item.projectStatus === 'Project')
    ).length;
    const topVotedCount = ideas.filter((item) => (item.voteCount || 0) > 0).length;
    const myIdeasCount = user ? ideas.filter((item) => item.authorId === user.uid).length : 0;

    return {
      totalIdeas,
      totalVotes,
      totalSuggestions,
      totalAcceptedSuggestions,
      totalAcceptedIdeas,
      topVotedCount,
      selectedMvp,
      myIdeasCount,
    };
  }, [ideas, user]);

  // Client-side filtering & sorting
  const filteredIdeas = useMemo(() => {
    let list = [...ideas];

    // Filter by tab
    if (activeFilter === 'selected') {
      list = list.filter((i) => i.isSelected || i.status === 'selected' || i.status === 'Selected MVP');
    } else if (activeFilter === 'top') {
      list = list.filter((i) => (i.voteCount || 0) > 0);
    } else if (activeFilter === 'mine' && user) {
      list = list.filter((i) => i.authorId === user.uid);
    }

    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (idea) =>
          idea.title.toLowerCase().includes(q) ||
          idea.problemStatement.toLowerCase().includes(q) ||
          (idea.proposedSolution && idea.proposedSolution.toLowerCase().includes(q)) ||
          (idea.techStack && idea.techStack.toLowerCase().includes(q))
      );
    }

    // Sort order
    if (sortBy === 'newest') {
      list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    } else {
      // Default: Most Voted (secondary: newest)
      list.sort((a, b) => {
        const voteDiff = (b.voteCount || 0) - (a.voteCount || 0);
        if (voteDiff !== 0) return voteDiff;
        return (b.createdAt || 0) - (a.createdAt || 0);
      });
    }

    return list;
  }, [ideas, searchQuery, sortBy, activeFilter, user]);

  return (
    <IdeaContext.Provider
      value={{
        ideas,
        filteredIdeas,
        loading,
        searchQuery,
        setSearchQuery,
        sortBy,
        setSortBy,
        activeFilter,
        setActiveFilter,
        stats,
        createIdea,
        updateIdea,
        deleteIdea,
        updateIdeaStatus,
      }}
    >
      {children}
    </IdeaContext.Provider>
  );
}

IdeaProvider.propTypes = {
  children: PropTypes.node.isRequired,
};
