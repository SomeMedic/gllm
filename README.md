# GLLM: Git to LLM Markdown Exporter

[![NPM Version](https://img.shields.io/npm/v/gllm.svg)](https://www.npmjs.com/package/gllm)
[![License](https://img.shields.io/npm/l/gllm.svg)](https://github.com/SomeMedic/gllm/blob/main/LICENSE)

**GLLM** is a powerful and flexible command-line interface (CLI) tool designed to export a Git repository's history into a structured set of Markdown files. This format is optimized for consumption by Large Language Models (LLMs), enabling deep analysis, code review, and knowledge extraction from your codebase.

The tool intelligently processes branches and commits, performs security scans, and offers robust configuration options to tailor the export to your specific needs.

---

## Features

- **Structured Markdown Export**: Creates a clean, linkable set of Markdown files for branches, commits, and file snapshots.
- **High Performance**: Utilizes parallel processing for branches and commits to significantly speed up the export process on multi-core systems.
- **Incremental Updates**: Saves export state to process only new commits since the last run, making subsequent exports extremely fast.
- **Flexible Configuration**: Supports both `.gllmrc` (key-value) and JSON (`gllm.config.json`) configuration files for project-specific settings.
- **Security First**: Includes a built-in secret scanner to detect potential leaks of sensitive information like API keys and private credentials. Supports custom patterns.
- **Advanced Filtering**: Granular control over the export with options to exclude files, paths, and apply regex patterns.
- **Smart Hierarchy**: Command-line arguments override settings from the configuration file, which in turn override default values.

## Installation

To install GLLM globally via npm, run the following command:

```bash
npm install -g gllm
```

Ensure you have Git and Node.js (v14 or higher) installed on your system.

## Quick Start

1.  **Navigate to your Git repository:**
    ```bash
    cd /path/to/your/repo
    ```

2.  **Initialize a configuration file (optional but recommended):**
    This command creates a `.gllmrc` file in your project root with sensible defaults.
    ```bash
    gllm --init-config
    ```

3.  **Run the export:**
    GLLM will read your configuration and start the export process.
    ```bash
    gllm
    ```

The output will be saved to the `gllm_export` directory (or the directory specified in your configuration).

## Usage

### Commands

GLLM provides a simple yet powerful set of commands. You can always see the full list of options by running:

```bash
gllm --help
```

```
Usage: gllm [options]

Export git repository into Markdown suitable for LLMs

Options:
  -V, --version                 output the version number
  -o, --out <dir>               output folder
  -b, --branches <branches>     'all' or comma-separated branch names
  -c, --commits-per-branch <n>  commits per branch
  --max-file-size <bytes>       max file size to include (bytes)
  --include-files               include file snapshots
  --exclude <paths>             comma-separated paths to exclude
  --no-secret-scan              disable quick secret scanning (not recommended)
  --force-update                force update all branches (ignore incremental state) (default: false)
  --concurrency <n>             number of parallel branches to process
  --stats                       show incremental export statistics (default: false)
  --config-info                 show configuration information (default: false)
  --init-config [path]          create sample configuration file
  -h, --help                    display help for command
```

### Key Commands in Detail

-   `gllm --init-config [path]`
    Creates a sample configuration file. By default, it creates a `.gllmrc` file. You can specify a different name or use a `.json` extension to create a JSON config (e.g., `gllm --init-config gllm.config.json`).

-   `gllm --config-info`
    Displays the current configuration sources (default, file, CLI) and the final, merged configuration that will be used for the export. This is very useful for debugging your setup.

-   `gllm --stats`
    Shows statistics from the last incremental export, including the number of processed commits and branches.

-   `gllm --force-update`
    Forces a full re-export of all specified branches and commits, ignoring the saved incremental state.

## Configuration

GLLM can be configured via a configuration file or command-line arguments.

### Configuration Hierarchy

Settings are applied in the following order of precedence (higher levels override lower ones):
1.  **Command-Line Arguments** (e.g., `gllm --concurrency=8`)
2.  **Project Configuration File** (e.g., `.gllmrc` or `gllm.config.json` in your project root)
3.  **Default Values**

### Configuration File

GLLM automatically searches for one of the following files in the current directory and its parent directories: `.gllmrc`, `.gllmrc.json`, `gllm.config.json`.

You can generate a well-documented sample file using `gllm --init-config`.

#### Example `.gllmrc`

This format is simple and easy to read.

```ini
# GLLM Configuration File
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

# Performance settings
performance.concurrency=6
performance.incremental=true

# Filter settings
filters.exclude=node_modules,.git,dist
filters.excludePatterns=\\.log$,\\.tmp$
filters.includePatterns=\\.(ts|js|py)$
```

#### Example `gllm.config.json`

This format is useful for more complex configurations, especially with custom secret patterns.

```json
{
  "output": {
    "directory": "gllm_export",
    "includeFiles": true,
    "maxFileSize": 500000
  },
  "branches": {
    "selection": ["main", "develop"],
    "commitsPerBranch": 50
  },
  "security": {
    "secretScan": true,
    "customPatterns": [
      {
        "name": "Custom API Key",
        "pattern": "api_key_[a-zA-Z0-9]{32}"
      }
    ]
  },
  "performance": {
    "concurrency": 6,
    "incremental": true
  },
  "filters": {
    "exclude": ["node_modules", ".git", "dist"],
    "excludePatterns": ["\\.log$", "\\.tmp$"],
    "includePatterns": ["\\.(ts|js|py)$"]
  }
}
```

## Contributing

Contributions are welcome! If you have a feature request, bug report, or pull request, please feel free to open an issue or PR on our [GitHub repository](https://github.com/SomeMedic/gllm).

1.  Fork the repository.
2.  Create your feature branch (`git checkout -b feature/AmazingFeature`).
3.  Commit your changes (`git commit -m 'Add some AmazingFeature'`).
4.  Push to the branch (`git push origin feature/AmazingFeature`).
5.  Open a Pull Request.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
