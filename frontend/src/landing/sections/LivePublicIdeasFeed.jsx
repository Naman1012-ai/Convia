import React, { useState, useEffect } from 'react';
import { rtdbService } from '../../services/rtdbService';
import { formatTimestamp } from '../../utils/formatting';
import { Globe, ThumbsUp, TrendingUp, Sparkles, MessageCircle, Clock, User, ArrowRight } from 'lucide-react';
import { PublicIdeaDetailModal } from '../../features/ideas/PublicIdeaDetailModal';
import { Avatar } from '../../components/ui/Avatar';

const DEMO_FALLBACK_IDEAS = [
  {
    ideaId: 'demo-1',
    title: 'AI Automated Technical Blueprint Generator',
    description: 'Transform raw problem statements and solution proposals into complete technical architecture documents, database schemas, and REST endpoints.',
    category: 'AI / Developer Tools',
    tags: ['React 19', 'Firebase', 'Vite', 'LLM API'],
    voteCount: 54,
    commentCount: 22,
    authorName: 'Alex Chen',
    authorAvatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Alex',
    createdAt: Date.now() - 3600000 * 2,
    status: 'active',
    isTrending: true,
  },
  {
    ideaId: 'demo-2',
    title: 'Real-Time Multi-Party Web3 Ledger',
    description: 'A decentralized collaborative ledger designed for high-frequency team transactions with sub-second WebSocket state synchronization.',
    category: 'Web3 & Fintech',
    tags: ['Solidity', 'Ethers.js', 'React', 'Tailwind'],
    voteCount: 38,
    commentCount: 14,
    authorName: 'Sarah Jenkins',
    authorAvatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah',
    createdAt: Date.now() - 3600000 * 6,
    status: 'selected',
    isMostVoted: true,
  },
  {
    ideaId: 'demo-3',
    title: 'Zero-Knowledge Identity & Credential Vault',
    description: 'Cryptographic identity verification platform for developer communities, allowing engineers to verify credentials without exposing personal PII.',
    category: 'Cybersecurity',
    tags: ['Rust', 'Wasm', 'Cryptography'],
    voteCount: 42,
    commentCount: 19,
    authorName: 'Marcus Vance',
    authorAvatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Marcus',
    createdAt: Date.now() - 3600000 * 1,
    status: 'active',
    isNewest: true,
  },
];

export function LivePublicIdeasFeed() {
  const [ideas, setIdeas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedIdea, setSelectedIdea] = useState(null);

  useEffect(() => {
    // Realtime subscription to Firebase Realtime Database node "publicIdeas" (Strict Zero-Fake-Data)
    const unsubscribe = rtdbService.subscribe('publicIdeas', (data) => {
      if (data && typeof data === 'object') {
        const parsed = Object.entries(data)
          .map(([id, val]) => ({
            ideaId: id,
            ...val,
          }))
          .filter((item) => item && !item.isDeleted);

        parsed.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        setIdeas(parsed);
      } else {
        setIdeas([]);
      }
      setLoading(false);
    });

    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, []);

  return (
    <section id="community-feed" className="py-24 bg-slate-950 border-b border-slate-800/80 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-4 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-primary-500/30 text-primary-300 text-xs font-mono font-bold">
              <Globe className="h-3.5 w-3.5 text-emerald-400 animate-pulse" />
              <span>Firebase Live Stream</span>
            </div>

            <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
              Live Public Ideas
            </h2>

            <p className="text-base text-slate-400 font-medium">
              Explore real-time proposals submitted by builders worldwide. Real-time updates via Firebase RTDB.
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono">
            <span className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 font-bold flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
              Realtime Synced
            </span>
          </div>
        </div>

        {/* Ideas Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-64 rounded-3xl bg-slate-900/60 animate-pulse border border-slate-800" />
            ))}
          </div>
        ) : ideas.length === 0 ? (
          <div className="p-12 text-center rounded-3xl bg-slate-900/60 border border-slate-800/80 space-y-3 max-w-xl mx-auto">
            <Globe className="h-8 w-8 text-primary-400 mx-auto" />
            <h3 className="text-lg font-bold text-white">No Public Proposals Shared Yet</h3>
            <p className="text-xs text-slate-400 font-medium">
              Be the first innovator to share a public proposal with the global community!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {ideas.slice(0, 6).map((idea, idx) => {
              const voteCount = idea.voteCount || idea.votes || 0;
              const commentCount = idea.commentCount || (idea.comments ? idea.comments.length : 0);
              const isTrending = idea.isTrending || voteCount >= 40;
              const isMostVoted = idea.isMostVoted || (idx === 0 && voteCount > 30);
              const isNewest = idea.isNewest || idx === 0;

              return (
                <div
                  key={idea.ideaId || idx}
                  onClick={() => setSelectedIdea(idea)}
                  className="p-7 rounded-3xl bg-slate-900/80 border border-slate-800/80 hover:border-primary-500/40 shadow-xl space-y-5 flex flex-col justify-between cursor-pointer group transition-all duration-300 hover:-translate-y-1 relative overflow-hidden"
                >
                  <div className="space-y-4">
                    {/* Top Badges */}
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="px-2.5 py-1 rounded-md text-[10px] font-mono font-bold bg-primary-500/10 text-primary-300 border border-primary-500/20">
                        {idea.category || 'General'}
                      </span>

                      <div className="flex items-center gap-1.5">
                        {isMostVoted && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                            <Sparkles className="h-3 w-3 text-amber-400" /> Most Voted
                          </span>
                        )}
                        {isTrending && !isMostVoted && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-primary-500/20 text-primary-300 border border-primary-500/30 flex items-center gap-1">
                            <TrendingUp className="h-3 w-3" /> Trending
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Title & Description */}
                    <div>
                      <h3 className="text-xl font-extrabold text-white group-hover:text-primary-300 transition-colors line-clamp-2">
                        {idea.title}
                      </h3>
                      <p className="text-xs text-slate-300 font-medium leading-relaxed mt-2 line-clamp-3">
                        {idea.description}
                      </p>
                    </div>

                    {/* Tech Stack Pills */}
                    {idea.tags && Array.isArray(idea.tags) && (
                      <div className="flex items-center gap-1.5 flex-wrap pt-1">
                        {idea.tags.slice(0, 3).map((t) => (
                          <span key={t} className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-950 text-slate-400 border border-slate-800">
                            {t}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Card Footer */}
                  <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs font-mono">
                    <div className="flex items-center gap-2 text-slate-400">
                      <Avatar
                        src={idea.authorAvatar}
                        alt={idea.authorName || 'Author'}
                        size="xs"
                        fallback={idea.authorName ? idea.authorName.charAt(0) : 'U'}
                      />
                      <span className="font-semibold text-slate-300 truncate max-w-[100px]">
                        {idea.authorName || 'Builder'}
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1 text-primary-300 font-bold">
                        <ThumbsUp className="h-3.5 w-3.5" /> +{voteCount}
                      </span>
                      <span className="flex items-center gap-1 text-slate-400">
                        <MessageCircle className="h-3.5 w-3.5" /> {commentCount}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Idea Detail Modal */}
      {selectedIdea && (
        <PublicIdeaDetailModal
          isOpen={Boolean(selectedIdea)}
          idea={selectedIdea}
          onClose={() => setSelectedIdea(null)}
        />
      )}
    </section>
  );
}
