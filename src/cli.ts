#!/usr/bin/env node
import { Command } from "commander";
import { ExportService } from "./export/ExportService";
import { Options, ExportProgress } from "./types";
import { ConfigManager } from "./config/ConfigManager";

const pkg = require("../package.json");

async function main() {
  const program = new Command();
  program
    .name("gllm")
    .version(pkg.version)
    .description("Export git repository into Markdown suitable for LLMs")
    .option("-o, --out <dir>", "output folder")
    .option("-b, --branches <branches>", "'all' or comma-separated branch names")
    .option("-c, --commits-per-branch <n>", "commits per branch", (v) => parseInt(v, 10))
    .option("--max-file-size <bytes>", "max file size to include (bytes)", (v) => parseInt(v, 10))
    .option("--include-files", "include file snapshots")
    .option("--exclude <paths>", "comma-separated paths to exclude")
    .option("--no-secret-scan", "disable quick secret scanning (not recommended)")
    .option("--force-update", "force update all branches (ignore incremental state)", false)
    .option("--concurrency <n>", "number of parallel branches to process", (v) => parseInt(v, 10))
    .option("--stats", "show incremental export statistics", false)
    .option("--config-info", "show configuration information", false)
    .option("--init-config [path]", "create sample configuration file")
  
    .parse(process.argv);

  const opts = program.opts() as Options & { 
    forceUpdate: boolean; 
    concurrency: number; 
    stats: boolean;
    configInfo: boolean;
    initConfig: string | boolean;
  };

  try {
    const configManager = new ConfigManager();

    // Handle init-config command
    if (opts.initConfig !== undefined && opts.initConfig !== false) {
      const configPath = typeof opts.initConfig === 'string' ? opts.initConfig : '.gllmrc';
      configManager.createSampleConfig(configPath);
      console.log(`✅ Sample configuration created: ${configPath}`);
      console.log("Edit this file to customize your export settings.");
      return;
    }

    // Load configuration
    configManager.loadConfig();
    
    // Handle config-info command
    if (opts.configInfo) {
      console.log(configManager.getConfigInfo());
      return;
    }

    // Merge CLI options with config
    configManager.mergeWithCliOptions(opts);
    const finalOptions = configManager.convertToOptions();
    const config = configManager.getConfig();
    const concurrency = opts.concurrency ?? config.performance?.concurrency ?? 4;
    const customSecretPatterns = config.security?.customPatterns;

    const exportService = new ExportService(finalOptions, concurrency, customSecretPatterns);

    // Handle stats command
    if (opts.stats) {
      const stats = exportService.getIncrementalStats();
      console.log("Incremental Export Statistics:");
      console.log(`- Processed commits: ${stats.processedCommits}`);
      console.log(`- Exported branches: ${stats.exportedBranches}`);
      return;
    }

    // Set up progress reporting
    exportService.on("progress", (progress: ExportProgress) => {
      const percentage = Math.round((progress.completedBranches / progress.totalBranches) * 100);
      console.log(`Progress: ${progress.completedBranches}/${progress.totalBranches} branches (${percentage}%)`);
      
      if (progress.currentBranch) {
        console.log(`Current: ${progress.currentBranch}`);
      }
      
      if (progress.errors.length > 0) {
        console.log(`Errors: ${progress.errors.length}`);
      }
    });

    // Run export
    await exportService.export(finalOptions, opts.forceUpdate);

  } catch (err: any) {
    console.error("Fatal:", err.message ?? err);
    process.exit(1);
  }
}

main().catch(err => {
  console.error("Fatal:", err.message ?? err);
  process.exit(1);
});
