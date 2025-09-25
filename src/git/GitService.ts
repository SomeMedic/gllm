import { execSync } from "child_process";
import { CommitInfo, GitRepository } from "../types";

export class GitService {
  private readonly maxBuffer = 50 * 1024 * 1024; // 50MB

  run(cmd: string, cwd?: string): string {
    try {
      return execSync(cmd, { 
        cwd, 
        stdio: ["ignore", "pipe", "pipe"], 
        encoding: "utf-8", 
        maxBuffer: this.maxBuffer 
      });
    } catch (e: any) {
      throw new Error(`Command failed: ${cmd}\n${e?.message ?? String(e)}`);
    }
  }

  getTopLevel(): string {
    return this.run("git rev-parse --show-toplevel");
  }

  getRepositoryInfo(): GitRepository {
    const topLevel = this.getTopLevel();
    const name = this.getRepositoryName(topLevel);
    const branches = this.getBranches();
    const tags = this.getTags();

    return {
      name,
      topLevel,
      branches,
      tags
    };
  }

  private getRepositoryName(topLevel: string): string {
    const path = require("path");
    return path.basename(topLevel);
  }

  getBranches(): string[] {
    const out = this.run("git for-each-ref --format='%(refname:short)' refs/heads/");
    return out.split(/\r?\n/)
      .map(s => s.trim())
      .filter(Boolean)
      .map(s => s.replace(/^'|'$/g, ""));
  }

  getTags(): string[] {
    const out = this.run("git tag --list");
    return out.split(/\r?\n/)
      .map(s => s.trim())
      .filter(Boolean);
  }

  getCommitsOfBranch(branch: string, limit: number): string[] {
    const out = this.run(`git rev-list --max-count=${limit} --first-parent ${this.escapeShellArg(branch)}`);
    return out.split(/\r?\n/)
      .map(s => s.trim())
      .filter(Boolean);
  }

  getCommitInfo(sha: string): CommitInfo {
    const fmt = "%H%n%an%n%ae%n%ad%n%B";
    const out = this.run(`git show -s --format=${this.escapeShellArg(fmt)} ${sha}`);
    const parts = out.split(/\r?\n/);
    const parents = this.run(`git rev-list --parents -n 1 ${sha}`)
      .split(/\s+/)
      .slice(1);
    
    return {
      sha: parts[0],
      author_name: parts[1],
      author_email: parts[2],
      date: parts[3],
      message: parts.slice(4).join("\n").trim(),
      parents
    };
  }

  getCommitPatch(sha: string): string {
    return this.run(`git show --no-color --pretty=fuller --patch ${sha}`);
  }

  getTreeFiles(sha: string): string[] {
    const out = this.run(`git ls-tree -r --name-only ${sha}`);
    return out.split(/\r?\n/)
      .map(s => s.trim())
      .filter(Boolean);
  }

  getBlobSize(sha: string, filePath: string): number | null {
    try {
      const out = this.run(`git cat-file -s ${sha}:${this.escapeShellArg(filePath)}`);
      return parseInt(out, 10);
    } catch {
      return null;
    }
  }

  getBlobContent(sha: string, filePath: string, maxBytes: number): string | null {
    try {
      const size = this.getBlobSize(sha, filePath);
      if (size === null || size > maxBytes) return null;
      return this.run(`git show ${sha}:${this.escapeShellArg(filePath)}`);
    } catch {
      return null;
    }
  }

  private escapeShellArg(s: string): string {
    if (/^[a-zA-Z0-9_@%+=:,./-]+$/.test(s)) return s;
    return `'${s.replace(/'/g, "'\\''")}'`;
  }
}
