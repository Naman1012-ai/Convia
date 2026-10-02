import React, { useState } from 'react';
import { Lightbulb, ThumbsUp, Tag, Globe, ArrowUpRight, TrendingUp, Sparkles, MessageCircle } from 'lucide-react';

const DEMO_PUBLIC_IDEAS = [
  {
    id: 1,
    title: 'AI Code Reviewer & Security Audit Bot',
    author: 'Alex Chen',
    category: 'AI / Developer Tools',
    votes: 42,
    comments: 18,
    tags: ['Python', 'FastAPI', 'LLM Agent'],
    trending: true,
  },
  {
    id: 2,
    title: 'Real-Time Multi-Party Web3 Ledger',
    author: 'Sarah Jenkins',
    category: 'Web3 & Fintech',
    votes: 29,
    comments: 11,
    tags: ['Solidity', 'Ethers.js', 'React'],
    trending: false,
  },
  {
    id: 3,
    title: 'Zero-Knowledge Document Verification',
    author: 'Marcus Vance',
    category: 'Cybersecurity',
    votes: 37,
    comments: 15,
    tags: ['Cryptography', 'Rust', 'Wasm'],
    trending: true,
  },
];

export function PublicIdeasPreview() {
  const [ideas, setIdeas] = useState(DEMO_PUBLIC_IDEAS);

  const handleVote = (id) => {
    setIdeas((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, votes: item.votes + 1, hasVoted: true } : item
      )
    );
  };

  return (
    <div className="p-6 sm:p-7 rounded-2xl bg-slate-900/95 border border-slate-800 shadow-2xl space-y-6">
      {/* Mock Header */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-primary-500/10 text-primary-400 border border-primary-500/20">
            <Globe className="h-4 w-4" />
          </div>
          <div>
            <h4 className="text-sm font-extrabold text-white">Public Innovation Feed</h4>
            <p className="text-[11px] text-slate-400 font-medium">Global proposals open for community import</p>
          </div>
        </div>

        <span className="px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" /> Live Sync
        </span>
      </div>

      {/* Idea Cards List */}
      <div className="space-y-4">
        {ideas.map((idea) => (
          <div
            key={idea.id}
            className="p-4 rounded-xl bg-slate-950 border border-slate-800/80 hover:border-primary-500/40 transition-all duration-200 space-y-3"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono font-bold text-primary-400 px-2 py-0.5 rounded bg-primary-500/10 border border-primary-500/20">
                    {idea.category}
                  </span>
                  {idea.trending && (
                    <span className="text-[10px] font-mono font-bold text-amber-300 px-2 py-0.5 rounded bg-amber-500/20 border border-amber-500/30 flex items-center gap-1">
                      <TrendingUp className="h-3 w-3" /> Trending
                    </span>
                  )}
                </div>
                <h5 className="text-sm font-bold text-white leading-snug">{idea.title}</h5>
              </div>

              {/* Upvote Button */}
              <button
                onClick={() => handleVote(idea.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-mono font-bold transition-all ${
                  idea.hasVoted
                    ? 'bg-primary-600 text-white border-primary-500 shadow-md shadow-primary-500/30'
                    : 'bg-slate-900 text-slate-300 border-slate-800 hover:border-primary-500/40 hover:text-white'
                }`}
              >
                <ThumbsUp className="h-3.5 w-3.5" />
                <span>+{idea.votes}</span>
              </button>
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-900">
              <div className="flex items-center gap-2">
                <span>By <strong>{idea.author}</strong></span>
                <span>&bull;</span>
                <span className="flex items-center gap-1 text-slate-400">
                  <MessageCircle className="h-3 w-3 text-slate-500" /> {idea.comments}
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                {idea.tags.map((t) => (
                  <span key={t} className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-900 text-slate-400 border border-slate-800">
                    {t}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
