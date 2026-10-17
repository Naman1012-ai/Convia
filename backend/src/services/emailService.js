/**
 * Convia Resilient Email Delivery Service.
 *
 * Responsibilities:
 * - Dispatches secondary email notifications for critical workflows (e.g. Import Requests).
 * - Enforces the invariant: Email is an informational channel, NEVER an authorization mechanism.
 * - Operates safely in local development/test modes without crashing when SMTP/Resend keys are not set.
 * - Non-blocking: failures in email delivery must never rollback or fail database transactions.
 */

export const emailService = {
  /**
   * Internal dispatcher that logs or transmits email.
   */
  dispatch: async ({ to, subject, html, text }) => {
    if (!to) {
      console.warn('⚠️ [emailService] Missing recipient email address.');
      return { success: false, reason: 'MISSING_RECIPIENT' };
    }

    try {
      // If external email provider credentials are provided, we can integrate here (e.g., Resend / SendGrid / SMTP).
      // In development or when unconfigured, cleanly log and succeed with dev fallback.
      if (process.env.RESEND_API_KEY) {
        // Dynamic fetch to avoid extra dependency if not installed
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          },
          body: JSON.stringify({
            from: process.env.EMAIL_FROM || 'Convia Notifications <notifications@convia.dev>',
            to: [to],
            subject,
            html,
            text,
          }),
        });

        if (!res.ok) {
          const errText = await res.text();
          console.warn(`⚠️ [emailService] Resend API error: ${errText}`);
          return { success: false, error: errText };
        }
        return { success: true, provider: 'resend' };
      }

      // Dev Fallback / Staging Mode:
      console.log(`📧 [emailService:DEV_DISPATCH] To: ${to} | Subject: "${subject}"`);
      return { success: true, provider: 'dev_mock', timestamp: Date.now() };
    } catch (err) {
      console.warn(`⚠️ [emailService] Failed to send email to ${to}:`, err.message);
      return { success: false, error: err.message };
    }
  },

  /**
   * Notifies the public idea creator that someone submitted an import request.
   */
  sendImportRequestEmail: async ({
    toEmail,
    creatorName = 'Creator',
    requesterName = 'A teammate',
    requesterWorkspaceName = 'their workspace',
    ideaTitle = 'your public idea',
    requestNote = '',
    reviewUrl = '/explore',
  }) => {
    const subject = `[Convia] Import Request for "${ideaTitle}"`;
    const text = `Hi ${creatorName},\n\n${requesterName} from "${requesterWorkspaceName}" wants to import your public idea "${ideaTitle}" into their workspace.\n\nReason:\n"${requestNote}"\n\nPlease log into Convia to review, approve, or reject this request:\n${reviewUrl}\n\nNote: Approving creates an attributed copy in their workspace. Your original idea remains completely yours.`;

    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
        <h2 style="color: #0f172a; margin-top: 0;">New Import Request</h2>
        <p style="color: #334155; font-size: 15px;">Hi <strong>${creatorName}</strong>,</p>
        <p style="color: #334155; font-size: 15px;">
          <strong>${requesterName}</strong> from workspace <em>"${requesterWorkspaceName}"</em> has requested to import your public idea:
        </p>
        <div style="background: #f8fafc; border-left: 4px solid #6366f1; padding: 14px 18px; margin: 18px 0; border-radius: 6px;">
          <h3 style="margin: 0 0 6px 0; color: #1e1b4b; font-size: 16px;">${ideaTitle}</h3>
          <p style="margin: 0; color: #475569; font-size: 14px; font-style: italic;">"${requestNote}"</p>
        </div>
        <p style="color: #475569; font-size: 13px; line-height: 1.5;">
          Convia gives you complete control over your public ideas. Approving creates an independent, attributed copy inside their workspace. Your original public idea remains untouched.
        </p>
        <div style="margin-top: 24px;">
          <a href="${reviewUrl}" style="background: #4f46e5; color: #ffffff; text-decoration: none; padding: 10px 20px; font-weight: 600; font-size: 14px; border-radius: 8px; display: inline-block;">Review Request in Convia</a>
        </div>
      </div>
    `;

    return emailService.dispatch({ to: toEmail, subject, html, text });
  },

  /**
   * Notifies the requester that their import request was approved and copied to their workspace.
   */
  sendImportApprovedEmail: async ({
    toEmail,
    requesterName = 'Teammate',
    creatorName = 'the creator',
    ideaTitle = 'the idea',
    workspaceName = 'your workspace',
    workspaceIdeaUrl = '/workspaces',
  }) => {
    const subject = `[Convia] Your import request for "${ideaTitle}" was approved!`;
    const text = `Hi ${requesterName},\n\nGreat news! ${creatorName} has approved your request to import "${ideaTitle}" into "${workspaceName}".\n\nA fresh, attributed copy is now available in your workspace ideas.\n\nOpen Workspace: ${workspaceIdeaUrl}`;

    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
        <h2 style="color: #047857; margin-top: 0;">✓ Import Request Approved</h2>
        <p style="color: #334155; font-size: 15px;">Hi <strong>${requesterName}</strong>,</p>
        <p style="color: #334155; font-size: 15px;">
          <strong>${creatorName}</strong> has approved your request to import <strong>"${ideaTitle}"</strong> into <strong>${workspaceName}</strong>.
        </p>
        <p style="color: #475569; font-size: 14px;">
          An independent copy attributed to @${creatorName} has been created in your workspace. Your team can now discuss, refine, and build an execution blueprint from it.
        </p>
        <div style="margin-top: 24px;">
          <a href="${workspaceIdeaUrl}" style="background: #059669; color: #ffffff; text-decoration: none; padding: 10px 20px; font-weight: 600; font-size: 14px; border-radius: 8px; display: inline-block;">View in Workspace</a>
        </div>
      </div>
    `;

    return emailService.dispatch({ to: toEmail, subject, html, text });
  },

  /**
   * Notifies the requester that their import request was rejected, with creator's reason.
   */
  sendImportRejectedEmail: async ({
    toEmail,
    requesterName = 'Teammate',
    creatorName = 'the creator',
    ideaTitle = 'the idea',
    rejectionReason = 'No reason provided',
  }) => {
    const subject = `[Convia] Update on your import request for "${ideaTitle}"`;
    const text = `Hi ${requesterName},\n\n${creatorName} was unable to approve your import request for "${ideaTitle}".\n\nReason:\n"${rejectionReason}"\n\nYou can continue discovering and collaborating on other public ideas in Convia.`;

    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
        <h2 style="color: #be123c; margin-top: 0;">Import Request Update</h2>
        <p style="color: #334155; font-size: 15px;">Hi <strong>${requesterName}</strong>,</p>
        <p style="color: #334155; font-size: 15px;">
          <strong>${creatorName}</strong> has reviewed your request to import <strong>"${ideaTitle}"</strong> and declined the request.
        </p>
        <div style="background: #fff1f2; border-left: 4px solid #f43f5e; padding: 14px 18px; margin: 18px 0; border-radius: 6px;">
          <strong style="color: #9f1239; font-size: 13px; text-transform: uppercase;">Creator's Note:</strong>
          <p style="margin: 6px 0 0 0; color: #881337; font-size: 14px;">"${rejectionReason}"</p>
        </div>
        <p style="color: #64748b; font-size: 13px;">
          This feedback is private to you and the creator. Feel free to explore other ideas or reach out through public discussions.
        </p>
      </div>
    `;

    return emailService.dispatch({ to: toEmail, subject, html, text });
  },
};
