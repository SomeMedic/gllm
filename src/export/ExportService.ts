import { EventEmitter } from "events";
import { Options, BranchExportResult, ExportProgress } from "../types";
import { GitService } from "../git/GitService";
import { SecretScanner } from "../security/SecretScanner";
import { IncrementalManager } from "./IncrementalManager";
import { FileExporter } from "./FileExporter";
import { ParallelBranchProcessor } from "./ParallelBranchProcessor";

export class ExportService extends EventEmitter {
  private readonly gitService: GitService;
  private readonly secretScanner: SecretScanner;
  private readonly fileExporter: FileExporter;
  private readonly incrementalManager: IncrementalManager;
  private readonly parallelProcessor: ParallelBranchProcessor;

  constructor(options: Options, concurrency: number = 4, customSecretPatterns?: Array<{ name: string; pattern: string }>) {
    super();
    
    this.gitService = new GitService();
    this.secretScanner = new SecretScanner();
    
    // Add custom secret patterns if provided
    if (customSecretPatterns && customSecretPatterns.length > 0) {
      this.secretScanner.addCustomPatterns(customSecretPatterns);
    }
    
    this.fileExporter = new FileExporter(options.out);
    this.incrementalManager = new IncrementalManager(options.out);
    this.parallelProcessor = new ParallelBranchProcessor(
      this.gitService,
      this.secretScanner,
      this.incrementalManager,
      this.fileExporter,
      options,
      concurrency
    );

    // Forward progress events
    this.parallelProcessor.on("progress", (progress: ExportProgress) => {
      this.emit("progress", progress);
    });
  }

  async export(options: Options, forceUpdate: boolean = false): Promise<BranchExportResult[]> {
    try {
      // Load incremental state
      const state = this.incrementalManager.loadState() ?? this.incrementalManager.getInitialState();
      this.incrementalManager.state = state;

      // Get repository information
      const repo = this.gitService.getRepositoryInfo();
      console.log(`Repo: ${repo.name}`);
      console.log(`Top-level: ${repo.topLevel}`);
      console.log(`Writing export to: ${options.out}\n`);

      // Write initial files
      await this.fileExporter.writeReadme(repo.name);
      await this.fileExporter.writeTags(repo.tags);

      // Determine branches to process
      let branches: string[];
      if (options.branches === "all") {
        branches = repo.branches;
      } else {
        branches = options.branches.split(",").map(s => s.trim()).filter(Boolean);
      }

      await this.fileExporter.writeIndex(branches);

      // Process branches in parallel
      const results = await this.parallelProcessor.processBranches(branches, forceUpdate);

      // Save incremental state
      this.incrementalManager.saveState(state);

      // Report results
      this.reportResults(results);

      return results;

    } catch (error: any) {
      console.error("Export failed:", error.message ?? error);
      throw error;
    }
  }

  private reportResults(results: BranchExportResult[]): void {
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    const totalCommits = results.reduce((sum, r) => sum + r.commits.length, 0);

    console.log(`\nExport finished:`);
    console.log(`- Branches processed: ${successful.length}/${results.length}`);
    console.log(`- Total commits exported: ${totalCommits}`);
    
    if (failed.length > 0) {
      console.log(`- Failed branches: ${failed.map(f => f.branch).join(", ")}`);
    }

    console.log(`\nRecommendation: first feed index.md + branch/<branch>.md + last N commits. Then request diffs/files for specific commits.`);
  }

  getIncrementalStats(): { processedCommits: number; exportedBranches: number } {
    const state = this.incrementalManager.loadState();
    return {
      processedCommits: state?.processedCommits.size ?? 0,
      exportedBranches: state?.exportedBranches.size ?? 0
    };
  }
}
