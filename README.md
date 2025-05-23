# Task Master Lite [![GitHub stars](https://img.shields.io/github/stars/zen-ai/zen-ai-mcp-task-master-lite?style=social)](https://github.com/zen-ai/zen-ai-mcp-task-master-lite/stargazers)

[![CI](https://github.com/zen-ai/zen-ai-mcp-task-master-lite/actions/workflows/ci.yml/badge.svg)](https://github.com/zen-ai/zen-ai-mcp-task-master-lite/actions/workflows/ci.yml) [![npm version](https://badge.fury.io/js/task-master-lite-ai.svg)](https://badge.fury.io/js/task-master-lite-ai) [![Discord](https://dcbadge.limes.pink/api/server/https://discord.gg/taskmasterai?style=flat)](https://discord.gg/taskmasterai) [![License: MIT with Commons Clause](https://img.shields.io/badge/license-MIT%20with%20Commons%20Clause-blue.svg)](LICENSE)

### By [@eyaltoledano](https://x.com/eyaltoledano) & [@RalphEcom](https://x.com/RalphEcom)

[![Twitter Follow](https://img.shields.io/twitter/follow/eyaltoledano?style=flat)](https://x.com/eyaltoledano)
[![Twitter Follow](https://img.shields.io/twitter/follow/RalphEcom?style=flat)](https://x.com/RalphEcom)

A stripped down lite version of Task Master focusing on OpenAI integration and network-interfaced MCP server.

## Requirements

Taskmaster Lite utilizes OpenAI for AI-driven commands, which requires an OpenAI API key.
You can define 3 types of models to be used: the main model, the research model, and the fallback model (in case either the main or research fail). Whatever model you use, its provider API key must be present in either mcp.json or .env. Any OpenAI-compatible model can be used by specifying a custom endpoint.
Note: The Gemini Flash 2.5 05-20 model is currently hardcoded.

An OpenAI API key is required.

Using the research model is optional but highly recommended.

## Quick Start

### Option 1 | MCP (Recommended):

MCP (Model Control Protocol) provides the easiest way to get started with Task Master Lite directly in your editor.

1.  **Start the MCP server**:

    ```bash
    node mcp-server/server.js
    ```

2.  **Add the MCP config to your editor** :

    ```json
    {
    	"mcpServers": {
    		"taskmaster-lite-ai": {
    			"env": {
    				"OPENAI_API_KEY": "YOUR_OPENAI_KEY_HERE"
    			},
    			"url": "http://localhost:3000/events"
    		}
    	}
    }
    ```

3.  **Enable the MCP** in your editor

4.  **Prompt the AI** to initialize Task Master Lite:

    ```
    Initialize taskmaster-lite-ai into project.
    ```

5.  **Use common commands** directly through your AI assistant:

    ```txt
    Parse PRD at scripts/prd.txt.
    Get next task.
    Implement task 3.
    Expand task 4.
    ```

### Option 2: Using Command Line

#### Installation

```bash
# Install globally
npm install -g task-master-lite-ai

# OR install locally within your project
npm install task-master-lite-ai
```

#### Initialize a new project

```bash
# If installed globally
task-master-lite init

# If installed locally
npx task-master-lite init
```

This will prompt you for project details and set up a new project with the necessary files and structure.

#### Common Commands

```bash
# Initialize a new project
task-master-lite init

# Parse a PRD and generate tasks
task-master-lite parse-prd your-prd.txt

# List all tasks
task-master-lite list

# Show the next task to work on
task-master-lite next

# Generate task files
task-master-lite generate
```

## Documentation

For more detailed information, check out the documentation in the `docs` directory:

- [Configuration Guide](docs/configuration.md) - Set up environment variables and customize Task Master Lite
- [Tutorial](docs/tutorial.md) - Step-by-step guide to getting started with Task Master Lite
- [Command Reference](docs/command-reference.md) - Complete list of all available commands
- [Task Structure](docs/task-structure.md) - Understanding the task format and features
- [Example Interactions](docs/examples.md) - Common Cursor AI interaction examples

## Troubleshooting

### If `task-master-lite init` doesn't respond:

Try running it with Node directly:

```bash
npx task-master-lite-ai init
```

Or clone the repository and run:

```bash
git clone https://github.com/zen-ai/zen-ai-mcp-task-master-lite.git
cd zen-ai-mcp-task-master-lite
node scripts/init.js
```

## Contributors

<a href="https://github.com/zen-ai/zen-ai-mcp-task-master-lite/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=zen-ai/zen-ai-mcp-task-master-lite" alt="Task Master Lite project contributors" />
</a>

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=zen-ai/zen-ai-mcp-task-master-lite&type=Timeline)](https://www.star-history.com/#zen-ai/zen-ai-mcp-task-master-lite&Timeline)

## Licensing

Task Master Lite is licensed under the MIT License with Commons Clause. This means you can:

✅ **Allowed**:

- Use Task Master Lite for any purpose (personal, commercial, academic)
- Modify the code
- Distribute copies
- Create and sell products built using Task Master Lite

❌ **Not Allowed**:

- Sell Task Master Lite itself
- Offer Task Master Lite as a hosted service
- Create competing products based on Task Master Lite

See the [LICENSE](LICENSE) file for the complete license text and [licensing details](docs/licensing.md) for more information.
