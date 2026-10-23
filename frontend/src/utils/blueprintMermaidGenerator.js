/**
 * Convia Blueprint 2.0 — Deterministic Mermaid Architecture Diagram Generator
 * Synthesizes valid Mermaid syntax from Canonical Blueprint 2.0 schemas.
 */

import { safeText, safeArray } from './safeRender';

/**
 * Sanitizes labels for Mermaid nodes (removes special chars, quotes safely)
 */
function sanitizeLabel(text) {
  if (!text) return 'Component';
  return String(text).replace(/["`()[\]{}]/g, '').trim();
}

/**
 * Generates System Topology & Service Flowchart (graph TD)
 */
export function generateSystemTopologyChart(content) {
  const v2 = content?.rawV2Content || content?.__v2Content || content || {};
  const arch = v2.architecture || {};
  const techStack = arch.technologyStack || content?.recommendedTechStack || {};

  const frontend = sanitizeLabel(techStack.frontend || 'React / Next.js Client');
  const backend = sanitizeLabel(techStack.backend || 'Node.js / Express API');
  const database = sanitizeLabel(techStack.database || arch.dataArchitecture?.primaryDatabase || 'Primary Database');
  const cacheOrState = sanitizeLabel(techStack.caching || arch.stateManagementStrategy || 'State Management');
  const externalAi = sanitizeLabel(techStack.aiModel || 'Gemini AI Engine');
  const authService = sanitizeLabel(techStack.authentication || 'Auth Provider');

  return `graph TD
    classDef client fill:#1e1b4b,stroke:#818cf8,stroke-width:2px,color:#e0e7ff;
    classDef api fill:#0f172a,stroke:#38bdf8,stroke-width:2px,color:#f0f9ff;
    classDef storage fill:#064e3b,stroke:#34d399,stroke-width:2px,color:#ecfdf5;
    classDef ext fill:#451a03,stroke:#fbbf24,stroke-width:2px,color:#fef3c7;

    Client["💻 Client Layer: ${frontend}"]:::client
    Gateway["⚡ API Layer: ${backend}"]:::api
    Auth["🔐 Auth: ${authService}"]:::ext
    State["📦 Store: ${cacheOrState}"]:::client
    DB[("🗄️ Database: ${database}")]:::storage
    AI["🤖 AI Service: ${externalAi}"]:::ext

    Client -->|"User Actions & State"| State
    Client -->|"Authenticated HTTPS / WSS"| Gateway
    Gateway -->|"Verify JWT"| Auth
    Gateway -->|"CRUD & Query Pipelines"| DB
    Gateway -->|"Prompts & Context Synthesis"| AI
    AI -->|"Structured JSON Responses"| Gateway
    Gateway -->|"Real-time State Broadcast"| Client
`;
}

/**
 * Generates Database Entity-Relationship Diagram (erDiagram)
 */
export function generateDatabaseErdChart(content) {
  const v2 = content?.rawV2Content || content?.__v2Content || content || {};
  const dataArch = v2.architecture?.dataArchitecture || {};
  const rawEntities = safeArray(dataArch.entities || content?.databaseDesign?.entities);

  if (!rawEntities.length) {
    return `erDiagram
      USER ||--o{ PROJECT : creates
      PROJECT ||--o{ TASK : contains
      PROJECT ||--o{ BLUEPRINT : generates
      USER {
        string uid PK
        string email
        string displayName
      }
      PROJECT {
        string id PK
        string title
        string status
      }
      TASK {
        string id PK
        string title
        string status
      }
      BLUEPRINT {
        string version PK
        int schemaVersion
        string status
      }
    `;
  }

  const lines = ['erDiagram'];
  const entityNames = new Set();

  rawEntities.forEach((ent) => {
    const rawName = safeText(ent.name || ent.entityName || 'Entity').replace(/[^a-zA-Z0-9_]/g, '');
    const name = rawName.toUpperCase();
    entityNames.add(name);

    const fields = safeArray(ent.attributes || ent.fields);
    lines.push(`    ${name} {`);
    if (fields.length) {
      fields.slice(0, 5).forEach((f) => {
        const fieldName = safeText(typeof f === 'string' ? f : f.name || 'field').replace(/[^a-zA-Z0-9_]/g, '');
        const fieldType = safeText(typeof f === 'object' ? f.type || 'string' : 'string').toLowerCase();
        lines.push(`        ${fieldType || 'string'} ${fieldName || 'id'}`);
      });
    } else {
      lines.push('        string id PK');
      lines.push('        string title');
      lines.push('        string status');
      lines.push('        timestamp createdAt');
    }
    lines.push('    }');
  });

  // Relate adjacent entities
  const namesArr = Array.from(entityNames);
  if (namesArr.length >= 2) {
    for (let i = 0; i < namesArr.length - 1; i++) {
      lines.push(`    ${namesArr[i]} ||--o{ ${namesArr[i + 1]} : references`);
    }
  }

  return lines.join('\n');
}

/**
 * Generates User Journey & Sequence Diagram (sequenceDiagram)
 */
export function generateSequenceFlowChart(content) {
  const v2 = content?.rawV2Content || content?.__v2Content || content || {};
  const execution = v2.execution || {};
  const workflow = safeArray(execution.workflow || content?.userFlow);

  if (!workflow.length) {
    return `sequenceDiagram
      autonumber
      actor User as User / Team Member
      participant Client as Convia Client App
      participant API as Backend Services
      participant DB as Realtime Storage

      User->>Client: Triggers Primary Feature Action
      Client->>API: Dispatches Authenticated Request (JWT)
      API->>DB: Validates & Updates Realtime State Node
      DB-->>Client: Realtime Push Notification / State Sync
      Client-->>User: Renders Optimistic Confirmation
    `;
  }

  const lines = [
    'sequenceDiagram',
    'autonumber',
    'actor User as User / Member',
    'participant Client as Frontend UI',
    'participant API as Application Server',
    'participant Storage as Database / State',
  ];

  workflow.slice(0, 5).forEach((step, idx) => {
    const title = sanitizeLabel(typeof step === 'string' ? step : step.step || step.name || `Action ${idx + 1}`);
    lines.push(`User->>Client: Step ${idx + 1}: ${title}`);
    lines.push(`Client->>API: Execute ${title}`);
    lines.push(`API->>Storage: Persist step data`);
    lines.push(`Storage-->>Client: Return confirmed state`);
  });

  return lines.join('\n');
}
