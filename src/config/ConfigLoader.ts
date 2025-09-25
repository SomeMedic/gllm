import * as fs from "fs";
import * as path from "path";
import { GllmConfig, ConfigSource } from "../types";
import { ConfigValidator } from "./ConfigValidator";

export class ConfigLoader {
  private readonly validator: ConfigValidator;
  private readonly configFileNames = ['.gllmrc', '.gllmrc.json', 'gllm.config.json'];

  constructor() {
    this.validator = new ConfigValidator();
  }

  loadConfig(workingDir: string = process.cwd()): { config: GllmConfig; sources: ConfigSource[] } {
    const sources: ConfigSource[] = [];
    let mergedConfig = this.validator.getDefaultConfig();
    
    // Add default config source
    sources.push({
      type: 'default',
      priority: 0
    });

    // Try to find and load config file
    const configPath = this.findConfigFile(workingDir);
    if (configPath) {
      try {
        const fileConfig = this.loadConfigFile(configPath);
        mergedConfig = this.mergeConfigs(mergedConfig, fileConfig);
        
        sources.push({
          type: 'file',
          path: configPath,
          priority: 1
        });
      } catch (error: any) {
        console.warn(`Warning: Failed to load config file ${configPath}: ${error.message}`);
      }
    }

    return { config: mergedConfig, sources };
  }

  private findConfigFile(workingDir: string): string | null {
    let currentDir = workingDir;
    
    while (currentDir !== path.dirname(currentDir)) {
      for (const fileName of this.configFileNames) {
        const configPath = path.join(currentDir, fileName);
        if (fs.existsSync(configPath)) {
          return configPath;
        }
      }
      currentDir = path.dirname(currentDir);
    }
    
    return null;
  }

  private loadConfigFile(configPath: string): GllmConfig {
    const content = fs.readFileSync(configPath, 'utf-8');
    const ext = path.extname(configPath).toLowerCase();
    
    if (ext === '.json') {
      return JSON.parse(content);
    } else {
      // Try to parse as JSON first, then as YAML-like format
      try {
        return JSON.parse(content);
      } catch {
        return this.parseSimpleConfig(content);
      }
    }
  }

  private parseSimpleConfig(content: string): GllmConfig {
    const config: GllmConfig = {};
    const lines = content.split('\n');
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      
      const [key, ...valueParts] = trimmed.split('=');
      if (!key || valueParts.length === 0) continue;
      
      const value = valueParts.join('=').trim();
      this.setConfigValue(config, key.trim(), value);
    }
    
    return config;
  }

  private setConfigValue(config: GllmConfig, key: string, value: string): void {
    const keys = key.split('.');
    let current: any = config;
    
    for (let i = 0; i < keys.length - 1; i++) {
      if (!current[keys[i]]) {
        current[keys[i]] = {};
      }
      current = current[keys[i]];
    }
    
    const lastKey = keys[keys.length - 1];
    
    const parsedValue = this.parseValue(value);

    // Ensure fields that should be arrays are always arrays
    const arrayFields = ['exclude', 'include', 'excludePatterns', 'includePatterns'];
    if (arrayFields.includes(lastKey) && !Array.isArray(parsedValue)) {
      current[lastKey] = [parsedValue];
    } else {
      current[lastKey] = parsedValue;
    }
  }

  private parseValue(value: string): any {
    // Remove quotes if present
    const trimmed = value.replace(/^["']|["']$/g, '');
    
    // Try to parse as boolean
    if (trimmed.toLowerCase() === 'true') return true;
    if (trimmed.toLowerCase() === 'false') return false;
    
    // Try to parse as number
    if (/^\d+$/.test(trimmed)) return parseInt(trimmed, 10);
    if (/^\d+\.\d+$/.test(trimmed)) return parseFloat(trimmed);
    
    // Try to parse as array (comma-separated)
    if (trimmed.includes(',')) {
      return trimmed.split(',').map(s => this.parseValue(s.trim()));
    }
    
    // Return as string
    return trimmed;
  }

  private mergeConfigs(base: GllmConfig, override: GllmConfig): GllmConfig {
    const result = { ...base };
    
    for (const [key, value] of Object.entries(override)) {
      if (value === null || value === undefined) continue;
      
      if (typeof value === 'object' && !Array.isArray(value) && result[key as keyof GllmConfig]) {
        result[key as keyof GllmConfig] = {
          ...(result[key as keyof GllmConfig] as any),
          ...value
        } as any;
      } else {
        result[key as keyof GllmConfig] = value as any;
      }
    }
    
    return result;
  }

  createSampleConfig(outputPath: string): void {
    const ext = path.extname(outputPath).toLowerCase();
    
    if (ext === '.json') {
      this.createJsonConfig(outputPath);
    } else {
      this.createSimpleConfig(outputPath);
    }
  }

  private createJsonConfig(outputPath: string): void {
    const sampleConfig: GllmConfig = {
      output: {
        directory: "gllm_export",
        includeFiles: true,
        maxFileSize: 500000
      },
      branches: {
        selection: "main,develop",
        commitsPerBranch: 50
      },
      security: {
        secretScan: true,
        customPatterns: [
          {
            name: "Custom API Key",
            pattern: "api_key_[a-zA-Z0-9]{32}"
          }
        ]
      },
      performance: {
        concurrency: 6,
        incremental: true
      },
      filters: {
        exclude: ["node_modules", ".git", "dist"],
        excludePatterns: ["\\.log$", "\\.tmp$"],
        includePatterns: ["\\.(ts|js|py|java|go|rs)$"]
      },
      metadata: {
        includeStats: true,
        includeTimeline: true,
        includeDependencies: false
      }
    };

    const content = JSON.stringify(sampleConfig, null, 2);
    fs.writeFileSync(outputPath, content);
  }

  private createSimpleConfig(outputPath: string): void {
    const content = `# GLLM Configuration File
# Simple key=value format

# Output settings
output.directory=gllm_export
output.includeFiles=true
output.maxFileSize=500000

# Branch settings
branches.selection=main,develop
branches.commitsPerBranch=50

# Security settings
security.secretScan=true
# Custom patterns (uncomment and modify as needed)
# security.customPatterns[0].name=Custom API Key
# security.customPatterns[0].pattern=api_key_[a-zA-Z0-9]{32}

# Performance settings
performance.concurrency=6
performance.incremental=true

# Filter settings
filters.exclude=node_modules,.git,dist
filters.excludePatterns=\\.log$,\\.tmp$
filters.includePatterns=\\.(ts|js|py|java|go|rs)$

# Metadata settings
metadata.includeStats=true
metadata.includeTimeline=true
metadata.includeDependencies=false

# Examples of other settings:
# branches.selection=all
# output.maxFileSize=1000000
# performance.concurrency=8
`;

    fs.writeFileSync(outputPath, content);
  }

  validateConfig(config: GllmConfig): void {
    const result = this.validator.validate(config);
    
    if (!result.valid) {
      console.error("Configuration validation failed:");
      result.errors.forEach(error => console.error(`  ❌ ${error}`));
      throw new Error("Invalid configuration");
    }
    
    if (result.warnings.length > 0) {
      console.warn("Configuration warnings:");
      result.warnings.forEach(warning => console.warn(`  ⚠️  ${warning}`));
    }
  }
}
