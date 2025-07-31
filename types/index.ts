// User and Authentication Types
export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  githubId?: string;
  githubUsername?: string;
  role: 'admin' | 'user';
  organizationId: string;
  createdAt: string;
  lastLoginAt: string;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  githubOrg?: string;
  settings: OrganizationSettings;
  createdAt: string;
  updatedAt: string;
}

export interface OrganizationSettings {
  allowGithubSync: boolean;
  requireMFA: boolean;
  defaultPlaybookId?: string;
  webhookUrl?: string;
  slackWebhook?: string;
}

// Playbook and Onboarding Types
export interface Playbook {
  id: string;
  organizationId: string;
  name: string;
  description: string;
  version: string;
  isActive: boolean;
  steps: PlaybookStep[];
  secrets: string[]; // References to secret IDs
  githubRepos: string[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  analytics: PlaybookAnalytics;
}

export interface PlaybookStep {
  id: string;
  title: string;
  description: string;
  type: 'task' | 'documentation' | 'secret' | 'github' | 'verification';
  order: number;
  isRequired: boolean;
  estimatedTime?: number; // in minutes
  prerequisites: string[]; // step IDs
  content: StepContent;
  verification?: StepVerification;
  assignee?: string; // user ID or role
}

export interface StepContent {
  markdown?: string;
  codeSnippet?: {
    language: string;
    code: string;
  };
  links?: Array<{
    title: string;
    url: string;
    type: 'documentation' | 'tool' | 'repository' | 'external';
  }>;
  secrets?: string[]; // secret IDs needed for this step
  checklist?: string[];
}

export interface StepVerification {
  type: 'manual' | 'github_pr' | 'github_commit' | 'api_call' | 'file_exists';
  config: Record<string, any>;
  autoVerify: boolean;
}

export interface PlaybookAnalytics {
  totalStarts: number;
  completions: number;
  averageTimeToComplete?: number;
  commonBlockers: Array<{
    stepId: string;
    count: number;
    averageTimeStuck: number;
  }>;
  lastUpdated: string;
}

// User Progress and Sessions
export interface UserProgress {
  userId: string;
  playbookId: string;
  organizationId: string;
  status: 'not_started' | 'in_progress' | 'completed' | 'blocked';
  currentStepId?: string;
  completedSteps: StepProgress[];
  startedAt?: string;
  completedAt?: string;
  totalTimeSpent: number; // in minutes
  notes: string;
}

export interface StepProgress {
  stepId: string;
  status: 'pending' | 'in_progress' | 'completed' | 'skipped' | 'blocked';
  startedAt?: string;
  completedAt?: string;
  timeSpent: number; // in minutes
  notes?: string;
  verificationData?: Record<string, any>;
  blockerReason?: string;
}

// Documentation Types
export interface Documentation {
  id: string;
  organizationId: string;
  title: string;
  slug: string;
  content: string;
  type: 'setup' | 'api' | 'deployment' | 'troubleshooting' | 'general';
  tags: string[];
  githubPath?: string;
  lastSyncedAt?: string;
  version: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  viewCount: number;
}

// Secrets Management Types
export interface Secret {
  id: string;
  organizationId: string;
  name: string;
  description: string;
  type: 'env_var' | 'api_key' | 'certificate' | 'config_file';
  category: 'development' | 'staging' | 'production' | 'shared';
  encryptedValue: string;
  isRotatable: boolean;
  lastRotated?: string;
  expiresAt?: string;
  accessLog: SecretAccess[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface SecretAccess {
  userId: string;
  accessedAt: string;
  ipAddress: string;
  userAgent: string;
  action: 'view' | 'copy' | 'rotate';
}

// GitHub Integration Types
export interface GitHubRepository {
  id: string;
  name: string;
  fullName: string;
  organizationId: string;
  isConnected: boolean;
  webhookId?: string;
  defaultBranch: string;
  lastSyncedAt?: string;
  syncedFiles: string[];
  settings: {
    autoImportDocs: boolean;
    autoCreateOnboardingIssues: boolean;
    trackPRsForVerification: boolean;
  };
}

export interface GitHubWebhookPayload {
  action: string;
  repository: {
    id: number;
    name: string;
    full_name: string;
  };
  sender: {
    login: string;
    id: number;
  };
  [key: string]: any;
}

// Analytics and Reporting Types
export interface AnalyticsData {
  organizationId: string;
  period: 'day' | 'week' | 'month' | 'quarter';
  startDate: string;
  endDate: string;
  metrics: {
    totalOnboardings: number;
    completedOnboardings: number;
    averageCompletionTime: number;
    activePlaybooks: number;
    blockedUsers: number;
    commonStepFailures: Array<{
      stepId: string;
      stepTitle: string;
      failureCount: number;
      averageTimeStuck: number;
    }>;
    userSatisfactionScore?: number;
  };
  trends: {
    completionRate: Array<{ date: string; rate: number }>;
    timeToComplete: Array<{ date: string; avgTime: number }>;
    newUsers: Array<{ date: string; count: number }>;
  };
}

// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, any>;
  };
  meta?: {
    total?: number;
    page?: number;
    limit?: number;
    hasMore?: boolean;
  };
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  filter?: Record<string, any>;
}

// Cloudflare Types
export interface CloudflareEnv {
  ONBOARDING_KV: KVNamespace;
  SECRETS_KV: KVNamespace;
  PLAYBOOK_STATE: DurableObjectNamespace;
  JWT_SECRET: string;
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
  ENCRYPTION_KEY: string;
  WEBHOOK_SECRET: string;
  ENVIRONMENT: string;
}

export interface KVStorageKey {
  // Organizations
  organization: `org:${string}`;
  organizationBySlug: `org_slug:${string}`;
  
  // Users
  user: `user:${string}`;
  userByEmail: `user_email:${string}`;
  usersByOrg: `users:org:${string}`;
  
  // Playbooks
  playbook: `playbook:${string}`;
  playbooksByOrg: `playbooks:org:${string}`;
  
  // User Progress
  userProgress: `progress:${string}:${string}`; // userId:playbookId
  progressByOrg: `progress:org:${string}`;
  
  // Documentation
  doc: `doc:${string}`;
  docsByOrg: `docs:org:${string}`;
  
  // Secrets
  secret: `secret:${string}`;
  secretsByOrg: `secrets:org:${string}`;
  
  // GitHub
  githubRepo: `github:repo:${string}`;
  githubReposByOrg: `github:repos:org:${string}`;
  
  // Analytics
  analytics: `analytics:${string}:${string}`; // orgId:period
  
  // Sessions and Auth
  session: `session:${string}`;
  authCode: `auth_code:${string}`;
}

// Webhook and Event Types
export interface WebhookEvent {
  id: string;
  type: 'github.push' | 'github.pr' | 'user.completed_step' | 'user.started_playbook' | 'user.blocked';
  organizationId: string;
  data: Record<string, any>;
  timestamp: string;
  processed: boolean;
  retryCount: number;
}

// Form and Input Types
export interface CreatePlaybookRequest {
  name: string;
  description: string;
  steps: Omit<PlaybookStep, 'id'>[];
  githubRepos?: string[];
  isActive?: boolean;
}

export interface UpdatePlaybookRequest extends Partial<CreatePlaybookRequest> {
  version?: string;
}

export interface CreateSecretRequest {
  name: string;
  description: string;
  value: string;
  type: Secret['type'];
  category: Secret['category'];
  expiresAt?: string;
}

export interface InviteUserRequest {
  email: string;
  role: User['role'];
  playbookId?: string;
  sendEmail?: boolean;
}

// Real-time Updates Types
export interface RealtimeUpdate {
  type: 'user_progress' | 'playbook_update' | 'new_user' | 'step_completion';
  organizationId: string;
  data: Record<string, any>;
  timestamp: string;
}