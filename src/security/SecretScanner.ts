export interface SecretPattern {
  name: string;
  pattern: RegExp;
}

export class SecretScanner {
  private patterns: SecretPattern[] = [
    { name: "AWS Access Key ID", pattern: /AKIA[0-9A-Z]{16}/ },
    { name: "Private RSA", pattern: /-----BEGIN( RSA)? PRIVATE KEY-----/ },
    { name: "Slack token", pattern: /xox[baprs]-[0-9A-Za-z]{10,}/ },
    { name: "JWT-looking", pattern: /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/ },
    { name: "Generic password-like", pattern: /(password|passwd|pwd)[\s:=]{1,6}['"]?[^'"\s]{6,}/i },
    { name: "GitHub token", pattern: /ghp_[0-9A-Za-z]{36}/ },
    { name: "API key pattern", pattern: /[a-zA-Z0-9]{32,}/ },
    { name: "Database URL", pattern: /(mongodb|postgres|mysql):\/\/[^:]+:[^@]+@/i }
  ];

  scanForSecrets(text: string): string[] {
    const hits: string[] = [];
    
    for (const { name, pattern } of this.patterns) {
      if (pattern.test(text)) {
        hits.push(name);
      }
    }
    
    return hits;
  }

  addCustomPattern(name: string, pattern: RegExp): void {
    this.patterns.push({ name, pattern });
  }

  addCustomPatterns(patterns: Array<{ name: string; pattern: string }>): void {
    for (const { name, pattern } of patterns) {
      try {
        const regex = new RegExp(pattern);
        this.patterns.push({ name, pattern: regex });
      } catch (error) {
        console.warn(`Failed to add custom pattern "${name}": ${error}`);
      }
    }
  }

  removePattern(name: string): void {
    const index = this.patterns.findIndex(p => p.name === name);
    if (index !== -1) {
      this.patterns.splice(index, 1);
    }
  }

  getPatterns(): SecretPattern[] {
    return [...this.patterns];
  }
}
