import { execSync } from "child_process";

export function run(cmd: string, cwd?: string): string {
  try {
    return execSync(cmd, { cwd, stdio: ["ignore", "pipe", "pipe"], encoding: "utf-8", maxBuffer: 50 * 1024 * 1024 });
  } catch (e: any) {
    throw new Error(`Command failed: ${cmd}\n${e?.message || String(e)}`);
  }
}

export function safeName(s: string) {
  return s.replace(/[/\\\s]+/g, "__").replace(/[^0-9A-Za-z._\-@]/g, "");
}

export function guessLangByExt(path: string) {
  const ext = path.split(".").pop()?.toLowerCase() || "";
  const map: Record<string, string> = {
    "py": "python",
    "js": "javascript",
    "ts": "typescript",
    "java": "java",
    "go": "go",
    "rb": "ruby",
    "rs": "rust",
    "c": "c",
    "cpp": "cpp",
    "h": "c",
    "json": "json",
    "md": "markdown",
    "sh": "bash",
    "yml": "yaml",
    "yaml": "yaml",
    "html": "html",
    "css": "css"
  };
  return map[ext] || "";
}