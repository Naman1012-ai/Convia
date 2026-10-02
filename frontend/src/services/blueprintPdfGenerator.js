import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatTimestamp } from '../utils/formatting';
import { isBlueprintV2 } from '../utils/blueprintCompatibility';

/**
 * Sanitize text to avoid invalid PDF characters.
 */
function cleanText(text = '') {
  if (text === null || text === undefined) return '';
  if (typeof text === 'object') {
    if (Array.isArray(text)) return text.map((t) => cleanText(t)).join(', ');
    return JSON.stringify(text);
  }
  return String(text)
    .replace(/[\r\n]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Helper to sanitize filenames for browser download.
 */
export function getSafeFilename(title = 'Project', version = '1.0', ext = 'pdf') {
  const safeTitle = String(title)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'project';
  const safeVersion = String(version).replace(/[^a-zA-Z0-9.-]/g, '') || '1.0';
  return `convia-blueprint-${safeTitle}-v${safeVersion}.${ext}`;
}

/**
 * PDF Document Generator for Convia AI Blueprints (Blueprint 2.0 Canonical Upgrade).
 * Renders a crisp, multi-page vector PDF document with selectable text, custom layout, and page numbering.
 * Supports canonical Schema Version 2 with lossless multi-section representation and Schema Version 1 fallback.
 */
export function generateBlueprintPdf(blueprintDoc, orgName = 'Workspace') {
  if (!blueprintDoc) {
    throw new Error('Cannot generate PDF: Invalid or missing Blueprint document.');
  }

  const rawContent = blueprintDoc.rawV2Content ||
                     blueprintDoc.__v2Content ||
                     blueprintDoc.content ||
                     (blueprintDoc.projectUnderstanding ? blueprintDoc : null);

  if (!rawContent) {
    throw new Error('Cannot generate PDF: Missing Blueprint content.');
  }

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  const isV2 = isBlueprintV2(rawContent);
  const title = blueprintDoc.ideaTitle || blueprintDoc.title || 'Project Blueprint';
  const version = String(blueprintDoc.version || '1.0');
  const lastSource = blueprintDoc.lastModifiedSource === 'manual' ? 'Manually Edited' : 'Google Gemini AI';
  const dateStr = formatTimestamp(blueprintDoc.updatedAt || blueprintDoc.generatedAt || Date.now());
  const statusStr = String(blueprintDoc.status || 'completed').toUpperCase();

  // Colors
  const primaryDark = [15, 23, 42]; // #0F172A (Slate 900)
  const secondaryDark = [30, 41, 59]; // #1E293B (Slate 800)
  const indigoPrimary = [124, 58, 237]; // #7C3AED (Primary Lavender 600)
  const purpleDark = [46, 16, 101]; // #2E1065 (Primary Lavender 950)
  const textDark = [30, 41, 59]; // #1E293B (Slate 800)
  const textMuted = [100, 116, 139]; // #64748B (Slate 500)
  const emeraldDark = [6, 78, 59]; // #064E3B (Emerald 900)

  // Helper for adding new page when content reaches bottom boundary
  const checkSpace = (neededHeight = 20) => {
    if (y + neededHeight > pageHeight - 20) {
      doc.addPage();
      y = margin + 10;
    }
  };

  // Helper to render section headings
  const addSectionHeader = (titleText) => {
    checkSpace(18);
    y += 4;
    doc.setFillColor(...purpleDark);
    doc.roundedRect(margin, y, contentWidth, 8, 1.5, 1.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(255, 255, 255);
    doc.text(titleText.toUpperCase(), margin + 4, y + 5.5);
    y += 12;
  };

  // Helper to render subheadings
  const addSubheader = (subText) => {
    checkSpace(10);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(...indigoPrimary);
    doc.text(subText, margin, y);
    y += 4.5;
  };

  // ----------------------------------------------------
  // COVER / HEADER BANNER
  // ----------------------------------------------------
  doc.setFillColor(...primaryDark);
  doc.rect(0, 0, pageWidth, 44, 'F');

  // Convia Title Logo
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(255, 255, 255);
  doc.text('CONVIA', margin, 14);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(199, 210, 254);
  doc.text('TECHNICAL PROJECT BLUEPRINT 2.0 & CONTROL SPECIFICATION', margin, 20);

  // Version Badge
  doc.setFillColor(...indigoPrimary);
  doc.roundedRect(pageWidth - margin - 32, 10, 32, 7, 1, 1, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(255, 255, 255);
  doc.text(`VERSION ${version}`, pageWidth - margin - 29, 15);

  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text(`Export Date: ${dateStr}`, pageWidth - margin - 50, 26);
  doc.text(`Workspace: ${orgName}`, pageWidth - margin - 50, 31);
  doc.text(`Schema: ${isV2 ? 'Blueprint 2.0 (v2)' : 'Legacy (v1)'} · Status: ${statusStr}`, pageWidth - margin - 50, 36);

  // Project Main Title
  y = 50;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(...textDark);
  const titleLines = doc.splitTextToSize(title, contentWidth);
  doc.text(titleLines, margin, y);
  y += titleLines.length * 6.5 + 2;

  // Problem Statement Banner
  const probStatement = blueprintDoc.problemStatement || rawContent.projectUnderstanding?.problemStatement;
  if (probStatement) {
    doc.setFillColor(241, 245, 249);
    doc.setDrawColor(203, 213, 225);
    const probLines = doc.splitTextToSize(`Problem Statement: ${cleanText(probStatement)}`, contentWidth - 8);
    const boxHeight = probLines.length * 4.2 + 6;
    doc.roundedRect(margin, y, contentWidth, boxHeight, 1.5, 1.5, 'FD');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...textDark);
    doc.text(probLines, margin + 4, y + 4.5);
    y += boxHeight + 6;
  }

  // ==========================================================================
  // BRANCH 1: CANONICAL BLUEPRINT 2.0 RENDERER
  // ==========================================================================
  if (isV2) {
    const v2 = rawContent;

    // ----------------------------------------------------
    // 1. PROJECT UNDERSTANDING
    // ----------------------------------------------------
    addSectionHeader('1. Project Understanding & Value Proposition');

    if (v2.projectUnderstanding) {
      const pu = v2.projectUnderstanding;

      if (pu.summary || pu.vision) {
        addSubheader('Strategic Vision & Executive Summary:');
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(...textDark);
        const sumText = `${cleanText(pu.summary || '')} ${pu.vision ? `Vision: ${cleanText(pu.vision)}` : ''}`.trim();
        const sumLines = doc.splitTextToSize(sumText, contentWidth);
        doc.text(sumLines, margin, y);
        y += sumLines.length * 4 + 4;
      }

      if (pu.targetAudience) {
        addSubheader('Target Audience & User Personas:');
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(...textDark);
        const audLines = doc.splitTextToSize(cleanText(pu.targetAudience), contentWidth);
        doc.text(audLines, margin, y);
        y += audLines.length * 4 + 4;
      }

      if (pu.proposedSolution || pu.valueProposition) {
        addSubheader('Proposed Solution & Core Value Propositions:');
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(...textDark);
        const valText = `${cleanText(pu.proposedSolution || '')} ${Array.isArray(pu.valueProposition) ? pu.valueProposition.join('; ') : cleanText(pu.valueProposition || '')}`.trim();
        const valLines = doc.splitTextToSize(valText, contentWidth);
        doc.text(valLines, margin, y);
        y += valLines.length * 4 + 4;
      }

      // MVP Scope Boundaries Table
      if (pu.mvpScope) {
        const inScopeItems = Array.isArray(pu.mvpScope.inScope) ? pu.mvpScope.inScope : [];
        const outScopeItems = Array.isArray(pu.mvpScope.outOfScope) ? pu.mvpScope.outOfScope : [];
        const criteriaItems = Array.isArray(pu.mvpScope.successCriteria) ? pu.mvpScope.successCriteria : [];

        const scopeRows = [
          ['In Scope (Must Have MVP)', inScopeItems.length > 0 ? '• ' + inScopeItems.join('\n• ') : 'Core MVP features'],
          ['Out of Scope (Post-MVP)', outScopeItems.length > 0 ? '• ' + outScopeItems.join('\n• ') : 'Future enhancements'],
          ['Success Criteria & Metrics', criteriaItems.length > 0 ? '• ' + criteriaItems.join('\n• ') : 'Functional completion'],
        ];

        autoTable(doc, {
          startY: y,
          margin: { left: margin, right: margin },
          head: [['Scope Boundary', 'Deliverables, Exclusions & Success Metrics']],
          body: scopeRows,
          theme: 'grid',
          headStyles: { fillColor: primaryDark, textColor: [255, 255, 255], fontSize: 8, fontStyle: 'bold' },
          bodyStyles: { fontSize: 7.5, textColor: textDark },
          columnStyles: { 0: { cellWidth: 50, fontStyle: 'bold' } },
        });
        y = doc.lastAutoTable.finalY + 6;
      }
    }

    // ----------------------------------------------------
    // 2. REQUIREMENTS MATRIX
    // ----------------------------------------------------
    const requirementsList = Array.isArray(v2.requirements) ? v2.requirements : [];
    if (requirementsList.length > 0) {
      addSectionHeader(`2. Requirements Matrix (${requirementsList.length} Items)`);

      const reqRows = requirementsList.map((r) => [
        r.id || 'REQ',
        cleanText(r.title || ''),
        cleanText(r.description || ''),
        (r.type || 'functional').toUpperCase(),
        r.priority || 'Must Have',
        Array.isArray(r.acceptanceCriteria) && r.acceptanceCriteria.length > 0
          ? '• ' + r.acceptanceCriteria.slice(0, 3).map((c) => cleanText(c)).join('\n• ')
          : 'Verified build alignment',
      ]);

      autoTable(doc, {
        startY: y,
        margin: { left: margin, right: margin },
        head: [['ID', 'Requirement Title', 'Description', 'Type', 'Priority', 'Acceptance Criteria']],
        body: reqRows,
        theme: 'striped',
        headStyles: { fillColor: primaryDark, textColor: [255, 255, 255], fontSize: 7.5, fontStyle: 'bold' },
        bodyStyles: { fontSize: 7, textColor: textDark },
        columnStyles: {
          0: { cellWidth: 16, fontStyle: 'bold' },
          1: { cellWidth: 32, fontStyle: 'bold' },
          3: { cellWidth: 20 },
          4: { cellWidth: 20, fontStyle: 'bold' },
        },
      });
      y = doc.lastAutoTable.finalY + 6;
    }

    // ----------------------------------------------------
    // 3. SYSTEM ARCHITECTURE & DATABASE DESIGN
    // ----------------------------------------------------
    if (v2.architecture) {
      addSectionHeader('3. System Architecture & Technical Specifications');
      const arch = v2.architecture;

      if (arch.architecturePattern) {
        addSubheader(`Architecture Pattern: ${arch.architecturePattern}`);
      }

      if (arch.dataFlowDescription) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(...textDark);
        const flowLines = doc.splitTextToSize(cleanText(arch.dataFlowDescription), contentWidth);
        doc.text(flowLines, margin, y);
        y += flowLines.length * 4 + 4;
      }

      // Technology Stack Breakdown
      const techStack = arch.technologyStack || arch.recommendedTechStack || {};
      const stackRows = [
        ['Frontend', (techStack.frontend || []).join(', ') || 'React, Tailwind CSS'],
        ['Backend & API', (techStack.backend || []).join(', ') || 'Node.js, Express'],
        ['Database & State', (techStack.database || []).join(', ') || 'Firebase RTDB / Firestore'],
        ['Hosting & Cloud', (techStack.hosting || []).join(', ') || 'Vercel / Cloud Hosting'],
        ['Third-Party APIs', (techStack.thirdPartyApis || []).join(', ') || 'Google Gemini AI'],
        ['Security & Auth', (techStack.security || []).join(', ') || 'JWT, Firebase Auth, RBAC'],
      ];

      autoTable(doc, {
        startY: y,
        margin: { left: margin, right: margin },
        head: [['Architecture Layer', 'Approved Technology Selection']],
        body: stackRows,
        theme: 'grid',
        headStyles: { fillColor: primaryDark, textColor: [255, 255, 255], fontSize: 7.5, fontStyle: 'bold' },
        bodyStyles: { fontSize: 7, textColor: textDark },
        columnStyles: { 0: { cellWidth: 42, fontStyle: 'bold' } },
      });
      y = doc.lastAutoTable.finalY + 6;

      // Database Entities & Attribute Models
      const dbEntities = arch.dataArchitecture?.entities || arch.databaseDesign?.entities || [];
      if (dbEntities.length > 0) {
        addSubheader('Database Schema & Entity Models:');
        const dbRows = dbEntities.map((ent) => {
          const isOpt = ent.isOptional || (ent.entityType && String(ent.entityType).toLowerCase().includes('optional'));
          const reqFields = (ent.fields || []).join(', ') || 'None';
          const optFields = Array.isArray(ent.optionalFields) && ent.optionalFields.length > 0
            ? `\n(Optional: ${ent.optionalFields.join(', ')})`
            : '';
          const rels = Array.isArray(ent.relationships) && ent.relationships.length > 0
            ? `\nRelations: ${ent.relationships.map((r) => `${r.type || 'rel'} -> ${r.targetEntity || ''}`).join(', ')}`
            : '';

          return [
            `${ent.entityName || 'Entity'}\n[${isOpt ? 'Optional' : 'Core Entity'}]`,
            `Attributes: ${reqFields}${optFields}${rels}`,
          ];
        });

        autoTable(doc, {
          startY: y,
          margin: { left: margin, right: margin },
          head: [['Entity Name & Category', 'Schema Fields & Model Relationships']],
          body: dbRows,
          theme: 'striped',
          headStyles: { fillColor: primaryDark, textColor: [255, 255, 255], fontSize: 7.5, fontStyle: 'bold' },
          bodyStyles: { fontSize: 7, textColor: textDark },
          columnStyles: { 0: { cellWidth: 45, fontStyle: 'bold' } },
        });
        y = doc.lastAutoTable.finalY + 6;
      }

      // Key Architectural Decisions
      const archDecisions = arch.architecturalDecisions || [];
      if (archDecisions.length > 0) {
        addSubheader('Architectural Decisions & Trade-off Analysis:');
        const decRows = archDecisions.map((d) => [
          d.id || 'ARCH-DEC',
          cleanText(d.title || d.topic || ''),
          cleanText(d.chosenOption || ''),
          cleanText(d.rationale || ''),
          cleanText(d.tradeOffs || d.consequence || 'Standard modular architecture balance'),
        ]);

        autoTable(doc, {
          startY: y,
          margin: { left: margin, right: margin },
          head: [['ID', 'Decision Topic', 'Chosen Option', 'Rationale', 'Trade-offs & Impact']],
          body: decRows,
          theme: 'grid',
          headStyles: { fillColor: primaryDark, textColor: [255, 255, 255], fontSize: 7.5, fontStyle: 'bold' },
          bodyStyles: { fontSize: 7, textColor: textDark },
          columnStyles: { 0: { cellWidth: 18, fontStyle: 'bold' }, 1: { cellWidth: 35, fontStyle: 'bold' } },
        });
        y = doc.lastAutoTable.finalY + 6;
      }
    }

    // ----------------------------------------------------
    // 4. EXECUTION PLAN & TASKS
    // ----------------------------------------------------
    if (v2.execution) {
      const exec = v2.execution;
      const tasksList = Array.isArray(exec.tasks) ? exec.tasks : [];
      const featuresList = Array.isArray(exec.features) ? exec.features : [];

      addSectionHeader(`4. Execution Plan & Sprint Task Breakdown (${tasksList.length} Tasks)`);

      // Core Features Summary
      if (featuresList.length > 0) {
        addSubheader(`Core Planned Features (${featuresList.length} Features):`);
        const featRows = featuresList.map((f) => [
          f.id || 'FEAT',
          cleanText(f.featureName || f.name || ''),
          cleanText(f.description || ''),
          f.priority || 'Must Have',
          f.status || 'planned',
        ]);

        autoTable(doc, {
          startY: y,
          margin: { left: margin, right: margin },
          head: [['ID', 'Feature Name', 'Description & Scope', 'Priority', 'Status']],
          body: featRows,
          theme: 'striped',
          headStyles: { fillColor: primaryDark, textColor: [255, 255, 255], fontSize: 7.5, fontStyle: 'bold' },
          bodyStyles: { fontSize: 7, textColor: textDark },
          columnStyles: { 0: { cellWidth: 16, fontStyle: 'bold' }, 1: { cellWidth: 38, fontStyle: 'bold' }, 3: { cellWidth: 22 } },
        });
        y = doc.lastAutoTable.finalY + 6;
      }

      // Detailed Structured Tasks Table
      if (tasksList.length > 0) {
        addSubheader(`Authoritative Task Breakdown (${tasksList.length} Technical Tasks):`);
        const taskRows = tasksList.map((t) => {
          const effort = t.estimatedEffortHours ? `${t.estimatedEffortHours}h` : '1h';
          const cpBadge = t.isCriticalPath ? '[Critical Path]' : '';
          const deps = Array.isArray(t.dependencies) && t.dependencies.length > 0 ? t.dependencies.join(', ') : 'None';
          const assignee = t.assignedUserName || t.assignedRole || 'Unassigned';

          return [
            `${t.id || 'TASK'}\n${cpBadge}`.trim(),
            cleanText(t.title || ''),
            (t.category || 'general').toUpperCase(),
            t.priority || 'Medium',
            effort,
            deps,
            assignee,
            t.status || 'Todo',
          ];
        });

        autoTable(doc, {
          startY: y,
          margin: { left: margin, right: margin },
          head: [['Task ID', 'Title & Description', 'Category', 'Priority', 'Effort', 'Dependencies', 'Assignee / Role', 'Status']],
          body: taskRows,
          theme: 'grid',
          headStyles: { fillColor: primaryDark, textColor: [255, 255, 255], fontSize: 7, fontStyle: 'bold' },
          bodyStyles: { fontSize: 6.5, textColor: textDark },
          columnStyles: {
            0: { cellWidth: 20, fontStyle: 'bold' },
            1: { cellWidth: 42, fontStyle: 'bold' },
            4: { cellWidth: 12 },
            5: { cellWidth: 20 },
            7: { cellWidth: 15, fontStyle: 'bold' },
          },
        });
        y = doc.lastAutoTable.finalY + 6;
      }
    }

    // ----------------------------------------------------
    // 5. TEAM INTELLIGENCE & CAPABILITY MATCHING
    // ----------------------------------------------------
    const teamAlloc = v2.intelligence?.teamAllocation || v2.execution?.roles;
    if (teamAlloc) {
      addSectionHeader('5. Team Intelligence & Strategic Capability Allocation');

      const rolesList = Array.isArray(teamAlloc.roles)
        ? teamAlloc.roles
        : Array.isArray(teamAlloc)
        ? teamAlloc
        : [];

      if (rolesList.length > 0) {
        addSubheader('Strategic Project Roles & Capability Requirements:');
        const roleRows = rolesList.map((r) => [
          r.id || 'ROLE',
          r.roleName || 'Role',
          Array.isArray(r.capabilityRequirements) ? r.capabilityRequirements.join(', ') : cleanText(r.capabilityRequirements || 'Full-Stack'),
          Array.isArray(r.responsibilities) ? '• ' + r.responsibilities.join('\n• ') : cleanText(r.responsibilities || 'Feature implementation'),
          r.recommendedUserName || 'Team Contributor',
        ]);

        autoTable(doc, {
          startY: y,
          margin: { left: margin, right: margin },
          head: [['Role ID', 'Role Title', 'Required Skills / Capabilities', 'Key Responsibilities', 'Recommended Candidate']],
          body: roleRows,
          theme: 'striped',
          headStyles: { fillColor: primaryDark, textColor: [255, 255, 255], fontSize: 7.5, fontStyle: 'bold' },
          bodyStyles: { fontSize: 7, textColor: textDark },
          columnStyles: { 0: { cellWidth: 16, fontStyle: 'bold' }, 1: { cellWidth: 32, fontStyle: 'bold' } },
        });
        y = doc.lastAutoTable.finalY + 6;
      }

      // Workload Distribution
      const workload = teamAlloc.workloadSummary;
      if (workload && Array.isArray(workload.membersWorkload) && workload.membersWorkload.length > 0) {
        addSubheader('Team Workload & Effort Distribution:');
        const workRows = workload.membersWorkload.map((m) => [
          m.memberName || 'Member',
          `${m.activeTaskCount || 0} tasks`,
          `${m.totalEstimatedHours || 0}h`,
          `${m.workloadPercentage || 0}%`,
          (m.workloadLevel || 'Normal').toUpperCase(),
        ]);

        autoTable(doc, {
          startY: y,
          margin: { left: margin, right: margin },
          head: [['Team Member', 'Active Tasks', 'Estimated Effort', 'Project Share', 'Workload Status']],
          body: workRows,
          theme: 'grid',
          headStyles: { fillColor: primaryDark, textColor: [255, 255, 255], fontSize: 7.5, fontStyle: 'bold' },
          bodyStyles: { fontSize: 7, textColor: textDark },
          columnStyles: { 0: { cellWidth: 45, fontStyle: 'bold' } },
        });
        y = doc.lastAutoTable.finalY + 6;
      }
    }

    // ----------------------------------------------------
    // 6. RISKS & MITIGATIONS
    // ----------------------------------------------------
    const risksList = Array.isArray(v2.quality?.risks) ? v2.quality.risks : [];
    if (risksList.length > 0) {
      addSectionHeader(`6. Technical & Operational Risk Assessment (${risksList.length} Risks)`);

      const riskRows = risksList.map((rk) => [
        rk.id || 'RISK',
        cleanText(rk.title || ''),
        (rk.category || 'technical').toUpperCase(),
        `${rk.likelihood || 'Med'} / ${rk.impact || 'Med'}`,
        (rk.severity || 'Medium').toUpperCase(),
        cleanText(rk.mitigation || 'Proactive mitigation plan'),
        cleanText(rk.contingency || 'Contingency plan'),
      ]);

      autoTable(doc, {
        startY: y,
        margin: { left: margin, right: margin },
        head: [['ID', 'Risk Title', 'Category', 'L / I', 'Severity', 'Mitigation Strategy', 'Contingency Plan']],
        body: riskRows,
        theme: 'striped',
        headStyles: { fillColor: primaryDark, textColor: [255, 255, 255], fontSize: 7.5, fontStyle: 'bold' },
        bodyStyles: { fontSize: 6.8, textColor: textDark },
        columnStyles: {
          0: { cellWidth: 16, fontStyle: 'bold' },
          1: { cellWidth: 32, fontStyle: 'bold' },
          4: { cellWidth: 18, fontStyle: 'bold' },
        },
      });
      y = doc.lastAutoTable.finalY + 6;
    }

    // ----------------------------------------------------
    // 7. QUALITY GATES & PRODUCTION READINESS
    // ----------------------------------------------------
    if (v2.quality) {
      const q = v2.quality;
      addSectionHeader('7. Quality Gates, Testing Strategy & Production Readiness');

      // Production Readiness Score
      if (q.productionReadiness) {
        const pr = q.productionReadiness;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.setTextColor(...indigoPrimary);
        doc.text(`Production Readiness: ${pr.readinessScore || 0}% [${(pr.readinessLevel || 'In Progress').toUpperCase()}]`, margin, y);
        y += 4.5;
        if (pr.summary) {
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(8);
          doc.setTextColor(...textDark);
          const prLines = doc.splitTextToSize(cleanText(pr.summary), contentWidth);
          doc.text(prLines, margin, y);
          y += prLines.length * 4 + 4;
        }
      }

      // Quality Gates Table
      const gatesList = Array.isArray(q.qualityGates) ? q.qualityGates : [];
      if (gatesList.length > 0) {
        addSubheader('Automated Quality Gates Verification:');
        const gateRows = gatesList.map((g) => [
          `Gate #${g.gateNumber || 1}`,
          cleanText(g.name || ''),
          (g.phase || 'Development').toUpperCase(),
          (g.status || 'passed').toUpperCase(),
          Array.isArray(g.verificationCriteria) ? '• ' + g.verificationCriteria.join('\n• ') : cleanText(g.verificationCriteria || 'All criteria verified'),
        ]);

        autoTable(doc, {
          startY: y,
          margin: { left: margin, right: margin },
          head: [['Gate', 'Quality Gate Name', 'Phase', 'Status', 'Verification Criteria']],
          body: gateRows,
          theme: 'grid',
          headStyles: { fillColor: primaryDark, textColor: [255, 255, 255], fontSize: 7.5, fontStyle: 'bold' },
          bodyStyles: { fontSize: 7, textColor: textDark },
          columnStyles: { 0: { cellWidth: 16, fontStyle: 'bold' }, 1: { cellWidth: 35, fontStyle: 'bold' }, 3: { cellWidth: 20, fontStyle: 'bold' } },
        });
        y = doc.lastAutoTable.finalY + 6;
      }
    }

    // ----------------------------------------------------
    // 8. DISCUSSION INTELLIGENCE & DECISIONS
    // ----------------------------------------------------
    const discIntel = v2.intelligence?.discussionIntelligence;
    if (discIntel) {
      addSectionHeader('8. Discussion Intelligence, Architectural Decisions & Strategy');

      const decisionsList = Array.isArray(discIntel.decisions) ? discIntel.decisions : [];
      if (decisionsList.length > 0) {
        addSubheader(`Approved Architectural & Product Decisions (${decisionsList.length} Decisions):`);
        const decRows = decisionsList.map((d) => [
          d.id || 'DEC',
          cleanText(d.title || ''),
          cleanText(d.description || ''),
          (d.category || 'architecture').toUpperCase(),
          (d.status || 'approved').toUpperCase(),
        ]);

        autoTable(doc, {
          startY: y,
          margin: { left: margin, right: margin },
          head: [['ID', 'Decision Title', 'Description & Rationale', 'Category', 'Status']],
          body: decRows,
          theme: 'striped',
          headStyles: { fillColor: primaryDark, textColor: [255, 255, 255], fontSize: 7.5, fontStyle: 'bold' },
          bodyStyles: { fontSize: 7, textColor: textDark },
          columnStyles: { 0: { cellWidth: 16, fontStyle: 'bold' }, 1: { cellWidth: 38, fontStyle: 'bold' }, 4: { cellWidth: 20, fontStyle: 'bold' } },
        });
        y = doc.lastAutoTable.finalY + 6;
      }

      const questionsList = Array.isArray(discIntel.unresolvedQuestions) ? discIntel.unresolvedQuestions : [];
      if (questionsList.length > 0) {
        addSubheader(`Open Strategic Questions (${questionsList.length} Questions):`);
        const qRows = questionsList.map((qItem) => [
          qItem.id || 'Q',
          cleanText(qItem.question || ''),
          cleanText(qItem.context || ''),
          qItem.isBlocking ? 'CRITICAL BLOCKER' : 'Non-Blocking',
          (qItem.status || 'open').toUpperCase(),
        ]);

        autoTable(doc, {
          startY: y,
          margin: { left: margin, right: margin },
          head: [['ID', 'Open Question', 'Context / Implication', 'Priority', 'Status']],
          body: qRows,
          theme: 'grid',
          headStyles: { fillColor: primaryDark, textColor: [255, 255, 255], fontSize: 7.5, fontStyle: 'bold' },
          bodyStyles: { fontSize: 7, textColor: textDark },
          columnStyles: { 0: { cellWidth: 16, fontStyle: 'bold' }, 3: { cellWidth: 28, fontStyle: 'bold' } },
        });
        y = doc.lastAutoTable.finalY + 6;
      }
    }

  // ==========================================================================
  // BRANCH 2: LEGACY SCHEMA 1 FALLBACK RENDERER
  // ==========================================================================
  } else {
    const legacy = rawContent;

    if (legacy.projectOverview?.summary) {
      addSectionHeader('1. Executive Project Overview');
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(...textDark);
      const sumLines = doc.splitTextToSize(cleanText(legacy.projectOverview.summary), contentWidth);
      doc.text(sumLines, margin, y);
      y += sumLines.length * 4 + 4;
    }

    if (legacy.mvpScope) {
      addSectionHeader('2. MVP Scope Boundaries');
      const scopeData = [
        ['Must Have', (legacy.mvpScope.inScope || []).join('\n• ') ? '• ' + (legacy.mvpScope.inScope || []).join('\n• ') : 'None'],
        ['Out of Scope', (legacy.mvpScope.outOfScope || []).join('\n• ') ? '• ' + (legacy.mvpScope.outOfScope || []).join('\n• ') : 'None'],
        ['Success Criteria', (legacy.mvpScope.successCriteria || []).join('\n• ') ? '• ' + (legacy.mvpScope.successCriteria || []).join('\n• ') : 'None'],
      ];

      autoTable(doc, {
        startY: y,
        margin: { left: margin, right: margin },
        head: [['Category', 'Scope Deliverables']],
        body: scopeData,
        theme: 'grid',
        headStyles: { fillColor: primaryDark, textColor: [255, 255, 255], fontSize: 8, fontStyle: 'bold' },
        bodyStyles: { fontSize: 7.5, textColor: textDark },
      });
      y = doc.lastAutoTable.finalY + 6;
    }

    if (legacy.recommendedTechStack) {
      addSectionHeader('3. Recommended Technology Stack');
      const stack = legacy.recommendedTechStack;
      const stackRows = [
        ['Frontend', (stack.frontend || []).join(', ') || 'N/A'],
        ['Backend', (stack.backend || []).join(', ') || 'N/A'],
        ['Database', (stack.database || []).join(', ') || 'N/A'],
        ['Hosting', (stack.hosting || []).join(', ') || 'N/A'],
      ];

      autoTable(doc, {
        startY: y,
        margin: { left: margin, right: margin },
        head: [['Layer', 'Technologies']],
        body: stackRows,
        theme: 'striped',
        headStyles: { fillColor: primaryDark, textColor: [255, 255, 255], fontSize: 8, fontStyle: 'bold' },
        bodyStyles: { fontSize: 7.5, textColor: textDark },
      });
      y = doc.lastAutoTable.finalY + 6;
    }
  }

  // ----------------------------------------------------
  // FOOTER & PAGE NUMBERING ON ALL PAGES
  // ----------------------------------------------------
  const totalPages = doc.internal.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setDrawColor(226, 232, 240);
    doc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...textMuted);
    doc.text(`Convia AI Blueprint 2.0 Specification · Version ${version} · Confidential Asset`, margin, pageHeight - 7);
    doc.text(`Page ${p} of ${totalPages}`, pageWidth - margin - 18, pageHeight - 7);
  }

  return {
    doc,
    filename: getSafeFilename(title, version, 'pdf'),
  };
}
