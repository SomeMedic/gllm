import { EventEmitter } from "events";
import { BranchExportResult, ExportProgress, Options, CommitInfo } from "../types";
import { GitService } from "../git/GitService";
import { SecretScanner } from "../security/SecretScanner";
import { IncrementalManager } from "./IncrementalManager";
import { FileExporter } from "./FileExporter";
import { safeName, guessLangByExt } from "../utils";

export class ParallelBranchProcessor extends EventEmitter {
  private readonly gitService: GitService;
  private readonly secretScanner: SecretScanner;
  private readonly incrementalManager: IncrementalManager;
  private readonly fileExporter: FileExporter;
  private readonly options: Options;
  private readonly concurrency: number;

  constructor(
    gitService: GitService,
    secretScanner: SecretScanner,
    incrementalManager: IncrementalManager,
    fileExporter: FileExporter,
    options: Options,
    concurrency: number = 4
  ) {
    super();
    this.gitService = gitService;
    this.secretScanner = secretScanner;
    this.incrementalManager = incrementalManager;
    this.fileExporter = fileExporter;
    this.options = options;
    this.concurrency = concurrency;
  }

  async processBranches(branches: string[], forceUpdate: boolean = false): Promise<BranchExportResult[]> {
    const results: BranchExportResult[] = [];
    const progress: ExportProgress = {
      totalBranches: branches.length,
      completedBranches: 0,
      errors: []
    };

    this.emit("progress", progress);

    // Process branches in batches to control concurrency
    for (let i = 0; i < branches.length; i += this.concurrency) {
      const batch = branches.slice(i, i + this.concurrency);
      
      const batchPromises = batch.map(branch => 
        this.processBranch(branch, forceUpdate)
          .catch(error => ({
            branch,
            commits: [],
            success: false,
            error: error.message
          }))
      );

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      progress.completedBranches += batch.length;
      this.emit("progress", progress);
    }

    return results;
  }

  private async processBranch(branch: string, forceUpdate: boolean): Promise<BranchExportResult> {
    try {
      // Check if we should skip this branch
      if (this.incrementalManager.shouldSkipBranch(branch, forceUpdate)) {
        console.log(`Skipping branch ${branch} (already exported)`);
        return {
          branch,
          commits: [],
          success: true
        };
      }

      console.log(`Processing branch: ${branch}`);
      
      const allCommits = this.gitService.getCommitsOfBranch(branch, this.options.commitsPerBranch);
      const unprocessedCommits = this.incrementalManager.getUnprocessedCommits(allCommits);
      
      if (unprocessedCommits.length === 0) {
        console.log(`No new commits in branch ${branch}`);
        this.incrementalManager.markBranchExported(branch);
        return {
          branch,
          commits: [],
          success: true
        };
      }

      // Export branch summary
      await this.exportBranchSummary(branch, allCommits);

      // Process commits in parallel (smaller batches for commits)
      const commitBatches = this.chunkArray(unprocessedCommits, Math.min(10, this.concurrency));
      
      for (const batch of commitBatches) {
        const commitPromises = batch.map(sha => this.processCommit(sha, branch));
        await Promise.all(commitPromises);
      }

      this.incrementalManager.markBranchExported(branch);
      
      return {
        branch,
        commits: unprocessedCommits,
        success: true
      };

    } catch (error: any) {
      console.error(`Error processing branch ${branch}:`, error);
      return {
        branch,
        commits: [],
        success: false,
        error: error.message
      };
    }
  }

  private async exportBranchSummary(branch: string, commits: string[]): Promise<void> {
    const safeBranch = safeName(branch);
    const branchMdLines: string[] = [];
    
    branchMdLines.push(`# Branch ${branch}\n`);
    branchMdLines.push(`Commits (last ${commits.length}):\n`);
    
    for (const sha of commits) {
      const info = this.gitService.getCommitInfo(sha);
      branchMdLines.push(`- ${info.sha}: ${info.message.split(/\r?\n/)[0] ?? ""} (${info.author_name})`);
    }
    
    await this.fileExporter.writeBranchSummary(safeBranch, branchMdLines.join("\n"));
  }

  private async processCommit(sha: string, branch: string): Promise<void> {
    try {
      const info = this.gitService.getCommitInfo(sha);
      const patch = this.gitService.getCommitPatch(sha);
      const files = this.gitService.getTreeFiles(sha);
      
      const excludeArr = this.options.exclude 
        ? this.options.exclude.split(",").map(s => s.trim()).filter(Boolean) 
        : [];
      
      const filteredFiles = files.filter(f => 
        !excludeArr.some(e => f.startsWith(e))
      );

      const metaLines = this.buildCommitMetadata(info, branch, filteredFiles);
      metaLines.push(`# Commit ${info.sha}\n`);
      metaLines.push(`**Author:** ${info.author_name}  \n**Date:** ${info.date}\n\n## Message\n${info.message}\n\n---\n`);
      metaLines.push("## Patch (diff)\n");
      metaLines.push("```diff\n");
      metaLines.push(patch);
      metaLines.push("\n```\n");

      metaLines.push("## Files snapshot (links)\n");
      
      // Process files in parallel
      const filePromises = filteredFiles.map(file => this.processFile(sha, file, branch));
      await Promise.all(filePromises);

      for (const file of filteredFiles) {
        const fnameSafe = safeName(file);
        const link = `files/${fnameSafe}@${sha}.md`;
        metaLines.push(`- \`${file}\` — snapshot: \`${link}\``);
      }

      await this.fileExporter.writeCommit(sha, metaLines.join("\n"));
      this.incrementalManager.markCommitProcessed(sha);

    } catch (error: any) {
      console.error(`Error processing commit ${sha}:`, error);
      throw error;
    }
  }

  private async processFile(sha: string, filePath: string, branch: string): Promise<void> {
    if (!this.options.includeFiles) return;

    const blob = this.gitService.getBlobContent(sha, filePath, this.options.maxFileSize);
    const fnameSafe = safeName(filePath);
    const link = `files/${fnameSafe}@${sha}.md`;

    if (blob !== null) {
      const lang = guessLangByExt(filePath);
      const fileMd = [
        `# Snapshot of \`${filePath}\` @ ${sha}`,
        `Commit: ${sha}`,
        "```" + (lang ?? ""),
        blob,
        "```"
      ].join("\n");
      
      await this.fileExporter.writeFile(link, fileMd);

      if (this.options.secretScan) {
        const hits = this.secretScanner.scanForSecrets(blob);
        if (hits.length) {
          const alertContent = `Potential secrets detected in ${filePath} @ ${sha}:\n` + hits.join("\n");
          await this.fileExporter.writeAlert(`alerts/${fnameSafe}@${sha}.secret.txt`, alertContent);
          console.warn(`⚠️ Potential secrets detected in ${filePath} @ ${sha}: ${hits.join(", ")} — alert file written.`);
        }
      }
    } else {
      const note = `# Snapshot skipped (too large or binary) \`${filePath}\` @ ${sha}\nSize exceeded ${this.options.maxFileSize} bytes or can't read blob.`;
      await this.fileExporter.writeFile(link, note);
    }
  }

  private buildCommitMetadata(info: CommitInfo, branch: string, files: string[]): string[] {
    const metaLines: string[] = [];
    metaLines.push("---");
    metaLines.push(`repo: ${this.options.out}`);
    metaLines.push(`branch: ${branch}`);
    metaLines.push(`commit: ${info.sha}`);
    metaLines.push(`author: ${info.author_name} <${info.author_email}>`);
    metaLines.push(`date: ${info.date}`);
    
    if (info.parents && info.parents.length) {
      metaLines.push("parents:");
      for (const p of info.parents) metaLines.push(`  - ${p}`);
    }
    
    metaLines.push(`files_changed: ${files.length}`);
    metaLines.push(`summary: ${info.message.split(/\r?\n/)[0] ?? ""}`);
    metaLines.push("---\n");
    
    return metaLines;
  }

  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }
}
