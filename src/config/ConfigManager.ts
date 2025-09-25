import { GllmConfig, ConfigSource, Options } from "../types";
import { ConfigLoader } from "./ConfigLoader";
import { ConfigValidator } from "./ConfigValidator";

export class ConfigManager {
  private readonly loader: ConfigLoader;
  private readonly validator: ConfigValidator;
  private config: GllmConfig | null = null;
  private sources: ConfigSource[] = [];

  constructor() {
    this.loader = new ConfigLoader();
    this.validator = new ConfigValidator();
  }

  loadConfig(workingDir?: string): GllmConfig {
    const { config, sources } = this.loader.loadConfig(workingDir);
    this.config = config;
    this.sources = sources;
    
    this.validator.validateConfig(config);
    return config;
  }

  mergeWithCliOptions(cliOptions: Partial<Options>): GllmConfig {
    if (!this.config) {
      this.config = this.validator.getDefaultConfig();
    }

    const mergedConfig = { ...this.config };

    // Map CLI options to config structure
    if (cliOptions.out !== undefined) {
      mergedConfig.output = { ...mergedConfig.output, directory: cliOptions.out };
    }
    
    if (cliOptions.branches !== undefined) {
      mergedConfig.branches = { ...mergedConfig.branches, selection: cliOptions.branches };
    }
    
    if (cliOptions.commitsPerBranch !== undefined) {
      mergedConfig.branches = { ...mergedConfig.branches, commitsPerBranch: cliOptions.commitsPerBranch };
    }
    
    if (cliOptions.maxFileSize !== undefined) {
      mergedConfig.output = { ...mergedConfig.output, maxFileSize: cliOptions.maxFileSize };
    }
    
    if (cliOptions.includeFiles !== undefined) {
      mergedConfig.output = { ...mergedConfig.output, includeFiles: cliOptions.includeFiles };
    }
    
    if (cliOptions.exclude !== undefined) {
      const excludeArray = cliOptions.exclude ? cliOptions.exclude.split(',').map(s => s.trim()).filter(Boolean) : [];
      mergedConfig.filters = { ...mergedConfig.filters, exclude: excludeArray };
    }
    
    if (cliOptions.secretScan !== undefined) {
      mergedConfig.security = { ...mergedConfig.security, secretScan: cliOptions.secretScan };
    }

    this.config = mergedConfig;
    this.validator.validateConfig(mergedConfig);
    
    return mergedConfig;
  }

  getConfig(): GllmConfig {
    if (!this.config) {
      throw new Error("Configuration not loaded. Call loadConfig() first.");
    }
    return this.config;
  }

  getSources(): ConfigSource[] {
    return this.sources;
  }

  convertToOptions(): Options {
    const config = this.getConfig();
    
    return {
      out: config.output?.directory ?? "gllm_export",
      branches: Array.isArray(config.branches?.selection) 
        ? config.branches.selection.join(',')
        : config.branches?.selection ?? "all",
      commitsPerBranch: config.branches?.commitsPerBranch ?? 30,
      maxFileSize: config.output?.maxFileSize ?? 200000,
      includeFiles: config.output?.includeFiles ?? false,
      exclude: config.filters?.exclude?.join(',') ?? "",
      secretScan: config.security?.secretScan ?? true
    };
  }

  createSampleConfig(outputPath: string): void {
    this.loader.createSampleConfig(outputPath);
  }

  getConfigInfo(): string {
    const sources = this.getSources();
    const config = this.getConfig();
    
    let info = "Configuration sources (in order of priority):\n";
    
    sources
      .sort((a, b) => b.priority - a.priority)
      .forEach(source => {
        switch (source.type) {
          case 'file':
            info += `  📄 ${source.path}\n`;
            break;
          case 'cli':
            info += `  🖥️  CLI arguments\n`;
            break;
          case 'default':
            info += `  ⚙️  Default values\n`;
            break;
        }
      });
    
    info += "\nActive configuration:\n";
    info += `  Output directory: ${config.output?.directory}\n`;
    info += `  Branches: ${Array.isArray(config.branches?.selection) ? config.branches.selection.join(', ') : config.branches?.selection}\n`;
    info += `  Commits per branch: ${config.branches?.commitsPerBranch}\n`;
    info += `  Include files: ${config.output?.includeFiles}\n`;
    info += `  Max file size: ${config.output?.maxFileSize} bytes\n`;
    info += `  Secret scan: ${config.security?.secretScan}\n`;
    info += `  Concurrency: ${config.performance?.concurrency}\n`;
    info += `  Incremental: ${config.performance?.incremental}\n`;
    
    return info;
  }
}
