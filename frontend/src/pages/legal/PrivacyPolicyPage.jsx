import React, { useEffect } from 'react';
import { LegalLayout } from '../../landing/layouts/LegalLayout';
import { Mail, CheckCircle2, ShieldCheck, Database, Lock, AlertCircle, Trash2 } from 'lucide-react';

const PRIVACY_TOC = [
  { id: 'sec-1', title: 'Introduction' },
  { id: 'sec-2', title: 'Information We Collect' },
  { id: 'sec-3', title: 'How We Use Your Information' },
  { id: 'sec-4', title: 'Data Storage' },
  { id: 'sec-5', title: 'Public Content' },
  { id: 'sec-6', title: 'Account Deletion' },
  { id: 'sec-7', title: 'Cookies' },
  { id: 'sec-8', title: 'Third Party Services' },
  { id: 'sec-9', title: 'Security' },
  { id: 'sec-10', title: 'Policy Updates' },
  { id: 'sec-11', title: 'Contact Us' },
];

export default function PrivacyPolicyPage() {
  useEffect(() => {
    document.title = 'Privacy Policy — Convia';
  }, []);

  return (
    <LegalLayout
      title="Privacy Policy"
      subtitle="Your privacy is important to us. This Privacy Policy explains how Convia collects, uses, stores, and protects your information while using our platform."
      lastUpdated="July 24, 2026"
      toc={PRIVACY_TOC}
    >
      <div className="space-y-12 text-slate-300 text-sm leading-relaxed font-medium">
        {/* Section 1 */}
        <section id="sec-1" className="p-7 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-3">
          <h2 className="text-xl font-extrabold text-white flex items-center gap-2">
            <span className="text-primary-400 font-mono text-sm">1.</span> Introduction
          </h2>
          <p>
            Convia is committed to protecting your privacy and ensuring transparency regarding the collection and use of personal information. By using our real-time ideation and project consensus platform, you consent to the practices described in this Privacy Policy.
          </p>
        </section>

        {/* Section 2 */}
        <section id="sec-2" className="p-7 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-4">
          <h2 className="text-xl font-extrabold text-white flex items-center gap-2">
            <span className="text-primary-400 font-mono text-sm">2.</span> Information We Collect
          </h2>
          <p>We may collect personal and technical information to provide and improve our service, including:</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 text-xs font-mono">
            {[
              'Full Name & Display Name',
              'Email Address',
              'Profile Avatar URL',
              'Authentication Credentials',
              'Workspace Memberships',
              'Public Idea Proposals',
              'Private Workspace Content',
              'AI-Generated Blueprints',
              'Sprint Task Assignments',
              'Realtime Activity Logs',
              'Device & IP Diagnostics',
              'Browser Specifications',
            ].map((item) => (
              <div key={item} className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 flex items-center gap-2 text-slate-200">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Section 3 */}
        <section id="sec-3" className="p-7 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-3">
          <h2 className="text-xl font-extrabold text-white flex items-center gap-2">
            <span className="text-primary-400 font-mono text-sm">3.</span> How We Use Your Information
          </h2>
          <p>We process collected data to maintain platform stability and power collaborative workflows:</p>
          <ul className="space-y-2 text-xs font-mono text-slate-200">
            <li className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-primary-400" /> Authenticate user accounts securely.</li>
            <li className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-primary-400" /> Initialize and manage team hackathon workspaces.</li>
            <li className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-primary-400" /> Synchronize real-time WebSocket state via Firebase RTDB.</li>
            <li className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-primary-400" /> Generate AI technical blueprints and PRD documentation.</li>
            <li className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-primary-400" /> Prevent platform abuse, spam, and security vulnerabilities.</li>
          </ul>
        </section>

        {/* Section 4 */}
        <section id="sec-4" className="p-7 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-3">
          <h2 className="text-xl font-extrabold text-white flex items-center gap-2">
            <span className="text-primary-400 font-mono text-sm">4.</span> Data Storage & Infrastructure
          </h2>
          <p>
            Your data is securely stored using Google Cloud Firebase services (Firebase Authentication and Firebase Realtime Database). Convia employs TLS/SSL encrypted communication for all client-to-server data transfers.
          </p>
        </section>

        {/* Section 5 */}
        <section id="sec-5" className="p-7 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-3">
          <h2 className="text-xl font-extrabold text-white flex items-center gap-2">
            <span className="text-primary-400 font-mono text-sm">5.</span> Public vs. Private Content
          </h2>
          <p>
            Proposals published to the <strong className="text-primary-300">Public Innovation Feed</strong> are intentionally visible to all platform users. Content created inside private workspaces is strictly isolated and accessible only to validated workspace members.
          </p>
        </section>

        {/* Section 6 */}
        <section id="sec-6" className="p-7 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-3">
          <h2 className="text-xl font-extrabold text-white flex items-center gap-2">
            <span className="text-primary-400 font-mono text-sm">6.</span> Account Deletion Policy
          </h2>
          <p>
            Users maintain full control over their account data and may initiate permanent deletion anytime from their user profile settings.
          </p>
          <div className="p-4 rounded-2xl bg-rose-950/40 border border-rose-900/60 text-xs font-mono text-rose-300 space-y-2">
            <p className="font-bold flex items-center gap-1.5 text-rose-400">
              <Trash2 className="h-4 w-4" /> Permanent Account Purge Includes:
            </p>
            <p>&bull; Firebase Authentication Account Credential</p>
            <p>&bull; Realtime Database Profile & Preference Records</p>
            <p>&bull; Personal Workspace Memberships & Owned Workspaces</p>
          </div>
        </section>

        {/* Section 7 */}
        <section id="sec-7" className="p-7 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-3">
          <h2 className="text-xl font-extrabold text-white flex items-center gap-2">
            <span className="text-primary-400 font-mono text-sm">7.</span> Cookies & Local Storage
          </h2>
          <p>
            Convia utilizes essential browser cookies and local storage tokens exclusively for authentication state persistence, session validation, and UI preference caching. We do not sell tracking cookies to third-party ad networks.
          </p>
        </section>

        {/* Section 8 */}
        <section id="sec-8" className="p-7 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-3">
          <h2 className="text-xl font-extrabold text-white flex items-center gap-2">
            <span className="text-primary-400 font-mono text-sm">8.</span> Third-Party Service Providers
          </h2>
          <p>We integrate with industry-leading infrastructure providers:</p>
          <ul className="space-y-1.5 text-xs font-mono text-slate-300">
            <li>&bull; <strong>Firebase Authentication</strong> (User identity management)</li>
            <li>&bull; <strong>Firebase Realtime Database</strong> (Sub-second state sync)</li>
            <li>&bull; <strong>AI Model APIs (OpenAI / Gemini)</strong> (Technical PRD blueprint synthesis)</li>
          </ul>
        </section>

        {/* Section 9 */}
        <section id="sec-9" className="p-7 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-3">
          <h2 className="text-xl font-extrabold text-white flex items-center gap-2">
            <span className="text-primary-400 font-mono text-sm">9.</span> Information Security
          </h2>
          <p>
            We enforce strict client sanitization, Firebase security rules, and role-based access control. However, no internet transmission is 100% secure, and users are encouraged to maintain strong passwords.
          </p>
        </section>

        {/* Section 10 */}
        <section id="sec-10" className="p-7 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-3">
          <h2 className="text-xl font-extrabold text-white flex items-center gap-2">
            <span className="text-primary-400 font-mono text-sm">10.</span> Policy Updates
          </h2>
          <p>
            We may update this Privacy Policy periodically to reflect platform enhancements. Significant changes will be broadcasted to active users via the Convia announcement system.
          </p>
        </section>

        {/* Section 11 */}
        <section id="sec-11" className="p-7 rounded-3xl bg-gradient-to-r from-primary-950/80 to-slate-900 border border-primary-500/40 space-y-4">
          <h2 className="text-xl font-extrabold text-white flex items-center gap-2">
            <span className="text-primary-400 font-mono text-sm">11.</span> Contact Us
          </h2>
          <p>If you have any questions or privacy concerns regarding this policy, please reach out to our engineering team:</p>

          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2 text-xs font-mono text-primary-300 font-bold">
              <Mail className="h-4 w-4" />
              <span>demo.projects1012@gmail.com</span>
            </div>
            <a
              href="mailto:demo.projects1012@gmail.com"
              className="px-4 py-2 rounded-xl bg-primary-600 hover:bg-primary-500 text-white font-extrabold text-xs shadow-md transition-all"
            >
              Email Privacy Team
            </a>
          </div>
        </section>
      </div>
    </LegalLayout>
  );
}
