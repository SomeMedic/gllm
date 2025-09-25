export interface PackageJson {
  version: string;
  name: string;
  description: string;
}

export interface CommitInfo {
  sha: string;
  author_name: string;
  author_email: string;
  date: string;
  message: string;
  parents: string[];
}

export interface Options {
  out: string;
  branches: string;
  commitsPerBranch: number;
  maxFileSize: number;
  includeFiles: boolean;
  exclude: string;
  secretScan: boolean;
}

export interface BranchExportResult {
  branch: string;
  commits: string[];
  success: boolean;
  error?: string;
}

export interface ExportProgress {
  totalBranches: number;
  completedBranches: number;
  currentBranch?: string;
  errors: string[];
}

export interface IncrementalState {
  lastExport: Date;
  processedCommits: Set<string>;
  exportedBranches: Set<string>;
}

export interface GitRepository {
  name: string;
  topLevel: string;
  branches: string[];
  tags: string[];
}

export interface GllmConfig {
  output?: {
    directory?: string;
    includeFiles?: boolean;
    maxFileSize?: number;
  };
  branches?: {
    selection?: string | string[];
    commitsPerBranch?: number;
  };
  security?: {
    secretScan?: boolean;
    customPatterns?: Array<{
      name: string;
      pattern: string;
    }>;
  };
  performance?: {
    concurrency?: number;
    incremental?: boolean;
  };
  filters?: {
    exclude?: string[];
    include?: string[];
    excludePatterns?: string[];
    includePatterns?: string[];
  };
  metadata?: {
    includeStats?: boolean;
    includeTimeline?: boolean;
    includeDependencies?: boolean;
  };
}

export interface ConfigValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface ConfigSource {
  type: 'file' | 'cli' | 'default';
  path?: string;
  priority: number;
}
