export const DATABASE_ID = 'matrixflow';
export const KNOWLEDGE_BUCKET_ID = 'knowledge-files';
export const CORE_FUNCTION_ID = 'matrixflow-core';

export const TABLES = {
  agents: 'agents',
  agentRuns: 'agent_runs',
  contentProjects: 'content_projects',
  contentItems: 'content_items',
  knowledgeBases: 'knowledge_bases',
  knowledgeDocuments: 'knowledge_documents',
  workflows: 'workflows',
  workflowVersions: 'workflow_versions',
  workflowRuns: 'workflow_runs',
  customers: 'customers',
  leads: 'leads',
  conversations: 'conversations',
  messages: 'messages',
  marketplaceItems: 'marketplace_items',
  marketplacePurchases: 'marketplace_purchases',
  marketplaceReviews: 'marketplace_reviews',
  usageRecords: 'usage_records',
  auditLogs: 'audit_logs',
} as const;
