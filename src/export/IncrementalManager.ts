import * as fs from "fs";
import * as path from "path";
import { IncrementalState } from "../types";

export class IncrementalManager {
  private readonly stateFile: string;
  public state: IncrementalState | null = null;

  constructor(outputDir: string) {
    this.stateFile = path.join(outputDir, ".gllm-state.json");
  }

  loadState(): IncrementalState | null {
    try {
      if (fs.existsSync(this.stateFile)) {
        const content = fs.readFileSync(this.stateFile, "utf-8");
        const parsed = JSON.parse(content);
        
        // Convert arrays back to Sets
        return {
          lastExport: new Date(parsed.lastExport),
          processedCommits: new Set(parsed.processedCommits),
          exportedBranches: new Set(parsed.exportedBranches)
        };
      }
    } catch (error) {
      console.warn(`Failed to load incremental state: ${error}`);
    }
    
    return null;
  }

  saveState(state: IncrementalState): void {
    try {
      const serializable = {
        lastExport: state.lastExport.toISOString(),
        processedCommits: Array.from(state.processedCommits),
        exportedBranches: Array.from(state.exportedBranches)
      };
      
      fs.writeFileSync(this.stateFile, JSON.stringify(serializable, null, 2));
    } catch (error) {
      console.warn(`Failed to save incremental state: ${error}`);
    }
  }

  getInitialState(): IncrementalState {
    return {
      lastExport: new Date(),
      processedCommits: new Set(),
      exportedBranches: new Set()
    };
  }

  isCommitProcessed(sha: string): boolean {
    return this.state?.processedCommits.has(sha) ?? false;
  }

  isBranchExported(branch: string): boolean {
    return this.state?.exportedBranches.has(branch) ?? false;
  }

  markCommitProcessed(sha: string): void {
    if (this.state) {
      this.state.processedCommits.add(sha);
    }
  }

  markBranchExported(branch: string): void {
    if (this.state) {
      this.state.exportedBranches.add(branch);
    }
  }

  getUnprocessedCommits(commits: string[]): string[] {
    if (!this.state) return commits;
    
    return commits.filter(sha => !this.state!.processedCommits.has(sha));
  }

  shouldSkipBranch(branch: string, forceUpdate: boolean = false): boolean {
    if (forceUpdate) return false;
    return this.isBranchExported(branch);
  }
}
