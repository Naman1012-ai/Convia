import React, { useEffect } from 'react';
import { LegalLayout } from '../../landing/layouts/LegalLayout';
import { Mail, CheckCircle2, ShieldAlert, Scale, FileText } from 'lucide-react';

const TERMS_TOC = [
  { id: 'sec-1', title: 'Acceptance of Terms' },
  { id: 'sec-2', title: 'Eligibility' },
  { id: 'sec-3', title: 'User Responsibilities' },
  { id: 'sec-4', title: 'Workspaces & Ownership' },
  { id: 'sec-5', title: 'Public Ideas & Rights' },
  { id: 'sec-6', title: 'AI-Generated Content' },
  { id: 'sec-7', title: 'Platform Availability' },
  { id: 'sec-8', title: 'Limitation of Liability' },
  { id: 'sec-9', title: 'Account Termination' },
  { id: 'sec-10', title: 'Changes to Terms' },
  { id: 'sec-11', title: 'Legal Contact' },
];

export default function TermsOfServicePage() {
  useEffect(() => {
    document.title = 'Terms of Service — Convia';
  }, []);

  return (
    <LegalLayout
      title="Terms of Service"
      subtitle="These Terms govern your access to and use of Convia. Please read them carefully before creating an account or using our platform."
      lastUpdated="July 24, 2026"
      toc={TERMS_TOC}
    >
      <div className="space-y-12 text-slate-300 text-sm leading-relaxed font-medium">
        {/* Section 1 */}
        <section id="sec-1" className="p-7 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-3">
          <h2 className="text-xl font-extrabold text-white flex items-center gap-2">
            <span className="text-primary-400 font-mono text-sm">1.</span> Acceptance of Terms
          </h2>
          <p>
            By creating a Convia account, logging in, or accessing our services, you agree to be bound by these Terms of Service. If you do not agree to all terms, you may not access or use the platform.
          </p>
        </section>

        {/* Section 2 */}
        <section id="sec-2" className="p-7 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-3">
          <h2 className="text-xl font-extrabold text-white flex items-center gap-2">
            <span className="text-primary-400 font-mono text-sm">2.</span> Eligibility
          </h2>
          <p>
            Users must comply with all applicable local, state, national, and international laws, as well as university or institutional hackathon participation guidelines when using Convia.
          </p>
        </section>

        {/* Section 3 */}
        <section id="sec-3" className="p-7 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-4">
          <h2 className="text-xl font-extrabold text-white flex items-center gap-2">
            <span className="text-primary-400 font-mono text-sm">3.</span> User Responsibilities & Prohibited Conduct
          </h2>
          <p>Users agree not to engage in any prohibited actions, including but not limited to:</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
            {[
              'Uploading malicious code or viruses',
              'Attempting unauthorized database access',
              'Abusing or spamming realtime upvotes',
              'Disrupting team workspace collaboration',
              'Violating intellectual property rights',
              'Harassing or intimidating other builders',
            ].map((item) => (
              <div key={item} className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 flex items-center gap-2 text-rose-300">
                <ShieldAlert className="h-4 w-4 text-rose-400 shrink-0" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Section 4 */}
        <section id="sec-4" className="p-7 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-3">
          <h2 className="text-xl font-extrabold text-white flex items-center gap-2">
            <span className="text-primary-400 font-mono text-sm">4.</span> Workspaces & Governance Roles
          </h2>
          <p>
            <strong>Workspace Owners</strong> maintain full administrative authority over their workspace, including inviting/removing members, locking the selected MVP proposal, and managing workspace settings. Members must respect workspace permissions and democratic voting outcomes.
          </p>
        </section>

        {/* Section 5 */}
        <section id="sec-5" className="p-7 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-3">
          <h2 className="text-xl font-extrabold text-white flex items-center gap-2">
            <span className="text-primary-400 font-mono text-sm">5.</span> Public Ideas & Content Ownership
          </h2>
          <p>
            Creators retain initial ownership over proposals they submit to Convia. When a public proposal is imported into a team workspace, collaboration rights apply according to Convia&apos;s workspace ownership model.
          </p>
        </section>

        {/* Section 6 */}
        <section id="sec-6" className="p-7 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-3">
          <h2 className="text-xl font-extrabold text-white flex items-center gap-2">
            <span className="text-primary-400 font-mono text-sm">6.</span> AI-Generated Content Disclaimer
          </h2>
          <p>
            AI-generated blueprints, database models, and REST endpoints are provided strictly as planning assistance. Users remain solely responsible for validating, testing, and implementing their code during hackathons and development sprints.
          </p>
        </section>

        {/* Section 7 */}
        <section id="sec-7" className="p-7 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-3">
          <h2 className="text-xl font-extrabold text-white flex items-center gap-2">
            <span className="text-primary-400 font-mono text-sm">7.</span> Platform Availability
          </h2>
          <p>
            We strive for high platform availability and low latency. However, Convia does not guarantee uninterrupted operation or zero downtime due to cloud infrastructure maintenance or third-party service outages.
          </p>
        </section>

        {/* Section 8 */}
        <section id="sec-8" className="p-7 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-3">
          <h2 className="text-xl font-extrabold text-white flex items-center gap-2">
            <span className="text-primary-400 font-mono text-sm">8.</span> Limitation of Liability
          </h2>
          <p>
            Convia is provided on an &ldquo;AS IS&rdquo; and &ldquo;AS AVAILABLE&rdquo; basis. To the maximum extent permitted by law, Convia and its maintainers shall not be liable for indirect, incidental, or consequential damages resulting from platform usage.
          </p>
        </section>

        {/* Section 9 */}
        <section id="sec-9" className="p-7 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-3">
          <h2 className="text-xl font-extrabold text-white flex items-center gap-2">
            <span className="text-primary-400 font-mono text-sm">9.</span> Account Termination
          </h2>
          <p>
            Convia administrators reserve the right to suspend or terminate accounts that violate these Terms or engage in malicious platform abuse.
          </p>
        </section>

        {/* Section 10 */}
        <section id="sec-10" className="p-7 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-3">
          <h2 className="text-xl font-extrabold text-white flex items-center gap-2">
            <span className="text-primary-400 font-mono text-sm">10.</span> Changes to Terms
          </h2>
          <p>
            We reserve the right to modify these Terms as Convia grows. Continued use of the platform following published changes constitutes acceptance of the updated Terms.
          </p>
        </section>

        {/* Section 11 */}
        <section id="sec-11" className="p-7 rounded-3xl bg-gradient-to-r from-primary-950/80 to-slate-900 border border-primary-500/40 space-y-4">
          <h2 className="text-xl font-extrabold text-white flex items-center gap-2">
            <span className="text-primary-400 font-mono text-sm">11.</span> Legal Contact
          </h2>
          <p>For legal inquiries or terms clarification, please contact our engineering team:</p>

          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2 text-xs font-mono text-primary-300 font-bold">
              <Mail className="h-4 w-4" />
              <span>demo.projects1012@gmail.com</span>
            </div>
            <a
              href="mailto:demo.projects1012@gmail.com"
              className="px-4 py-2 rounded-xl bg-primary-600 hover:bg-primary-500 text-white font-extrabold text-xs shadow-md transition-all"
            >
              Contact Legal Team
            </a>
          </div>
        </section>
      </div>
    </LegalLayout>
  );
}
