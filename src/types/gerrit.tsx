export interface GerritConfig {
  id: string;
  name: string;
  baseUrl: string;
  username: string;
  password: string; // HTTP密码或API Token
  isActive: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface GerritProject {
  id: string;
  name: string;
  description: string;
  state: 'ACTIVE' | 'READ_ONLY' | 'HIDDEN';
  parent: string;
  branches?: Record<string, string>;
  web_links?: Array<{
    name: string;
    url: string;
  }>;
}

export interface GerritChange {
  id: string;
  project: string;
  branch: string;
  topic?: string;
  change_id: string;
  subject: string;
  status: 'NEW' | 'MERGED' | 'ABANDONED';
  created: string;
  updated: string;
  owner: {
    _account_id: number;
    name: string;
    email: string;
  };
  labels?: Record<string, unknown>;
  current_revision?: string;
  revisions?: Record<string, unknown>;
}

export interface GerritWikiData {
  project: GerritProject;
  changes: GerritChange[];
  branches: Array<{
    ref: string;
    revision: string;
  }>;
  statistics: {
    totalChanges: number;
    mergedChanges: number;
    openChanges: number;
    abandonedChanges: number;
    lastActivity: string;
  };
}