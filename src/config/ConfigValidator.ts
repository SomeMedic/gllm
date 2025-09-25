import { GllmConfig, ConfigValidationResult } from "../types";

export class ConfigValidator {
  validate(config: GllmConfig): ConfigValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate output configuration
    if (config.output) {
      if (config.output.directory && typeof config.output.directory !== 'string') {
        errors.push("output.directory must be a string");
      }
      
      if (config.output.includeFiles !== undefined && typeof config.output.includeFiles !== 'boolean') {
        errors.push("output.includeFiles must be a boolean");
      }
      
      if (config.output.maxFileSize !== undefined) {
        if (typeof config.output.maxFileSize !== 'number' || config.output.maxFileSize <= 0) {
          errors.push("output.maxFileSize must be a positive number");
        } else if (config.output.maxFileSize > 100 * 1024 * 1024) { // 100MB
          warnings.push("output.maxFileSize is very large (>100MB), this may cause performance issues");
        }
      }
    }

    // Validate branches configuration
    if (config.branches) {
      if (config.branches.selection !== undefined) {
        if (typeof config.branches.selection === 'string' && config.branches.selection !== 'all') {
          // Check if it's a valid comma-separated list
          const branches = config.branches.selection.split(',').map(s => s.trim());
          if (branches.some(b => !b || b.includes(' '))) {
            errors.push("branches.selection must be 'all' or a comma-separated list of branch names");
          }
        } else if (Array.isArray(config.branches.selection)) {
          if (config.branches.selection.some(b => typeof b !== 'string' || !b.trim())) {
            errors.push("branches.selection array must contain non-empty strings");
          }
        } else if (typeof config.branches.selection !== 'string') {
          errors.push("branches.selection must be a string or array of strings");
        }
      }
      
      if (config.branches.commitsPerBranch !== undefined) {
        if (typeof config.branches.commitsPerBranch !== 'number' || config.branches.commitsPerBranch <= 0) {
          errors.push("branches.commitsPerBranch must be a positive number");
        } else if (config.branches.commitsPerBranch > 1000) {
          warnings.push("branches.commitsPerBranch is very large (>1000), this may cause performance issues");
        }
      }
    }

    // Validate security configuration
    if (config.security) {
      if (config.security.secretScan !== undefined && typeof config.security.secretScan !== 'boolean') {
        errors.push("security.secretScan must be a boolean");
      }
      
      if (config.security.customPatterns) {
        if (!Array.isArray(config.security.customPatterns)) {
          errors.push("security.customPatterns must be an array");
        } else {
          config.security.customPatterns.forEach((pattern, index) => {
            if (!pattern.name || typeof pattern.name !== 'string') {
              errors.push(`security.customPatterns[${index}].name must be a non-empty string`);
            }
            if (!pattern.pattern || typeof pattern.pattern !== 'string') {
              errors.push(`security.customPatterns[${index}].pattern must be a non-empty string`);
            } else {
              try {
                new RegExp(pattern.pattern);
              } catch {
                errors.push(`security.customPatterns[${index}].pattern is not a valid regular expression`);
              }
            }
          });
        }
      }
    }

    // Validate performance configuration
    if (config.performance) {
      if (config.performance.concurrency !== undefined) {
        if (typeof config.performance.concurrency !== 'number' || config.performance.concurrency <= 0) {
          errors.push("performance.concurrency must be a positive number");
        } else if (config.performance.concurrency > 20) {
          warnings.push("performance.concurrency is very high (>20), this may cause system overload");
        }
      }
      
      if (config.performance.incremental !== undefined && typeof config.performance.incremental !== 'boolean') {
        errors.push("performance.incremental must be a boolean");
      }
    }

    // Validate filters configuration
    if (config.filters) {
      if (config.filters.exclude && !Array.isArray(config.filters.exclude)) {
        errors.push("filters.exclude must be an array");
      }
      
      if (config.filters.include && !Array.isArray(config.filters.include)) {
        errors.push("filters.include must be an array");
      }
      
      if (config.filters.excludePatterns) {
        if (!Array.isArray(config.filters.excludePatterns)) {
          errors.push("filters.excludePatterns must be an array");
        } else {
          config.filters.excludePatterns.forEach((pattern, index) => {
            try {
              new RegExp(pattern);
            } catch {
              errors.push(`filters.excludePatterns[${index}] is not a valid regular expression`);
            }
          });
        }
      }
      
      if (config.filters.includePatterns) {
        if (!Array.isArray(config.filters.includePatterns)) {
          errors.push("filters.includePatterns must be an array");
        } else {
          config.filters.includePatterns.forEach((pattern, index) => {
            try {
              new RegExp(pattern);
            } catch {
              errors.push(`filters.includePatterns[${index}] is not a valid regular expression`);
            }
          });
        }
      }
    }

    // Validate metadata configuration
    if (config.metadata) {
      const booleanFields = ['includeStats', 'includeTimeline', 'includeDependencies'];
      for (const field of booleanFields) {
        const value = (config.metadata as any)[field];
        if (value !== undefined && typeof value !== 'boolean') {
          errors.push(`metadata.${field} must be a boolean`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  validateConfig(config: GllmConfig): void {
    const result = this.validate(config);
    
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

  getDefaultConfig(): GllmConfig {
    return {
      output: {
        directory: "gllm_export",
        includeFiles: false,
        maxFileSize: 200000
      },
      branches: {
        selection: "all",
        commitsPerBranch: 30
      },
      security: {
        secretScan: true,
        customPatterns: []
      },
      performance: {
        concurrency: 4,
        incremental: true
      },
      filters: {
        exclude: [],
        include: [],
        excludePatterns: [],
        includePatterns: []
      },
      metadata: {
        includeStats: true,
        includeTimeline: false,
        includeDependencies: false
      }
    };
  }
}
