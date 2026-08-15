import type { WorkflowDSL } from '../workflow';

export interface AdminRevenue {
  aiCalls: number;
  tokenIn: number;
  tokenOut: number;
  aiCostUsd: number;
  marketplaceRevenueUsd: number;
}

export interface ModelUsageSummary {
  provider: string;
  model: string;
  _count: number;
  _sum: { inputTokens: number | null; outputTokens: number | null; costUsd: number | null };
}

export interface BillingPlan {
  id: string;
  name: string;
  priceMonthlyUsd: number;
  priceYearlyUsd: number;
  seats: number;
  aiCallsPerMonth: number;
  workflowLimit: number;
}

export interface SubscriptionSummary {
  id: string;
  status: string;
  plan?: BillingPlan;
}

export interface BillingRequest {
  id: string;
  organizationId: string;
  requestedPlan: 'pro' | 'team';
  requestedSeats: number;
  status: 'PENDING' | 'CONTACTED' | 'CONVERTED' | 'CANCELED';
  note?: string | null;
  requestedBy: string;
  createdAt: string;
}

export type UsageSummary = Record<string, number>;

export interface AgentSkillSummary {
  skillKey: string;
  config?: unknown;
}

export interface AgentRunSummary {
  id: string;
  status: string;
  tokensUsed: number;
  costUsd: number;
}

export interface AgentSummary {
  id: string;
  organizationId: string;
  name: string;
  role: string;
  model: string;
  status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
  createdAt: string;
  systemPrompt: Record<string, unknown>;
  skills: AgentSkillSummary[];
  runs?: AgentRunSummary[];
}

export interface CustomerSummary {
  id: string;
  name?: string | null;
  email?: string | null;
  stage: string;
  source?: string | null;
}

export interface LeadSummary {
  id: string;
  score: number;
  customer?: CustomerSummary | null;
}

export interface CustomerTagSummary {
  tag: string;
}

export interface CustomerNoteSummary {
  id: string;
  content: string;
}

export interface ConversationMessageSummary {
  id: string;
  role: string;
  content: string;
}

export interface ConversationSummary {
  id: string;
  messages: ConversationMessageSummary[];
}

export interface CustomerDetail extends CustomerSummary {
  tags: CustomerTagSummary[];
  notes: CustomerNoteSummary[];
  conversations: ConversationSummary[];
}

export interface AiReply {
  reply?: string;
  [key: string]: unknown;
}

export interface ContentProjectSummary {
  id: string;
  name: string;
}

export interface ContentItemSummary {
  id: string;
  type: string;
  body: { raw?: string; parsed?: unknown };
  metadata?: { usage?: unknown; cost?: number } | null;
}

export interface ContentGenerationView {
  itemId: string;
  content: unknown;
  usage?: unknown;
  cost?: number;
}

export interface KnowledgeDocumentSummary {
  id: string;
  title: string;
  status: string;
  chunkCount?: number;
}

export interface KnowledgeBaseSummary {
  id: string;
  name: string;
  description?: string | null;
  _count?: { documents: number };
}

export interface KnowledgeBaseDetail extends KnowledgeBaseSummary {
  documents: KnowledgeDocumentSummary[];
}

export interface RagAnswer {
  answer: string;
  citations: Array<{
    docId: string;
    chunkId: string;
    snippet: string;
    title: string;
    score: number;
  }>;
}

export interface MarketplaceReviewSummary {
  id: string;
  rating: number;
  comment?: string | null;
}

export interface MarketplaceItemSummary {
  id: string;
  type: 'agent' | 'workflow' | 'prompt' | 'content' | 'solution';
  name: string;
  description?: string | null;
  priceUsd: number;
  installs: number;
  ratingAvg: number;
  reviews?: MarketplaceReviewSummary[];
}

export interface MarketplacePurchaseSummary {
  id: string;
  priceUsd: number;
  item?: MarketplaceItemSummary;
}

export interface WorkflowSummary {
  id: string;
  name: string;
  currentVersion: number;
  _count?: { runs: number };
}

export interface WorkflowVersionSummary {
  id: string;
  version: number;
  dsl: WorkflowDSL;
}

export interface WorkflowDetail extends WorkflowSummary {
  versions: WorkflowVersionSummary[];
}

export interface WorkflowRunSummary {
  id: string;
  status: string;
  version: number;
  triggerType: string;
  durationMs?: number | null;
  error?: string | null;
  output?: unknown;
}

export interface WorkflowRunAccepted {
  runId: string;
  status: string;
  output?: unknown;
}
