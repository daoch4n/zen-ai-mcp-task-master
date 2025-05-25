# Configuration

Taskmaster uses two primary methods for configuration:

1.  **`.taskmasterconfig` File (Project Root - Recommended for most settings)**

    - This JSON file stores most configuration settings, including AI model selections, parameters, logging levels, and project defaults.
    - **Location:** This file is created in the root directory of your project when you run the `task-master models --setup` interactive setup. You typically do this during the initialization sequence. Do not manually edit this file beyond adjusting Temperature and Max Tokens depending on your model.
    - **Management:** Use the `task-master models --setup` command (or `models` MCP tool) to interactively create and manage this file. You can also set specific models directly using `task-master models --set-<role>=<model_id>`, adding `--ollama` flag for custom models. Manual editing is possible but not recommended unless you understand the structure.
    - **Example Structure:**
      ```json
      {
      	"models": {
      		"main": {
      			"provider": "openai",
      			"modelId": "gpt-4o",
      			"maxTokens": 64000,
      			"temperature": 0.2
      		},
      		"research": {
      			"provider": "perplexity",
      			"modelId": "sonar-pro",
      			"maxTokens": 8700,
      			"temperature": 0.1
      		},
      		"fallback": {
      			"provider": "openai",
      			"modelId": "gpt-4o",
      			"maxTokens": 64000,
      			"temperature": 0.2
      		}
      	},
      	"global": {
      		"logLevel": "info",
      		"debug": false,
      		"defaultSubtasks": 5,
      		"defaultPriority": "medium",
      		"projectName": "Your Project Name",
      		"ollamaBaseUrl": "http://localhost:11434/api",
      		"azureOpenaiBaseUrl": "https://your-endpoint.openai.azure.com/"
      	}
      }
      ```

2.  **Environment Variables (`.env` file or MCP `env` block - For API Keys Only)**
    - Used **exclusively** for sensitive API keys and specific endpoint URLs.
    - **Location:**
      - For CLI usage: Create a `.env` file in your project root.
      - For MCP/Cursor usage: Configure keys in the `env` section of your `.cursor/mcp.json` file.
    - **Required API Keys (Depending on configured providers):**
      - `PERPLEXITY_API_KEY`: Your Perplexity API key.
      - `OPENAI_API_KEY`: Your OpenAI API key.
      - `MISTRAL_API_KEY`: Your Mistral API key.
      - `AZURE_OPENAI_API_KEY`: Your Azure OpenAI API key (also requires `AZURE_OPENAI_ENDPOINT`).
      - `XAI_API_KEY`: Your X-AI API key.
    - **Optional Endpoint Overrides:**
      - **Per-role `baseUrl` in `.taskmasterconfig`:** You can add a `baseUrl` property to any model role (`main`, `research`, `fallback`) to override the default API endpoint for that provider. If omitted, the provider's standard endpoint is used.
      - `AZURE_OPENAI_ENDPOINT`: Required if using Azure OpenAI key (can also be set as `baseUrl` for the Azure model role).
      - `OLLAMA_BASE_URL`: Override the default Ollama API URL (Default: `http://localhost:11434/api`).

**Important:** Settings like model ID selections (`main`, `research`, `fallback`), `maxTokens`, `temperature`, `logLevel`, `defaultSubtasks`, `defaultPriority`, and `projectName` are **managed in `.taskmasterconfig`**, not environment variables.

## Example `.env` File (for API Keys)

```
# Required API keys for providers configured in .taskmasterconfig
PERPLEXITY_API_KEY=pplx-your-key-here
# OPENAI_API_KEY=sk-your-key-here
# etc.

# Optional Endpoint Overrides
# AZURE_OPENAI_ENDPOINT=https://your-azure-endpoint.openai.azure.com/
# OLLAMA_BASE_URL=http://custom-ollama-host:11434/api
```

## Troubleshooting

### Configuration Errors

- If Task Master reports errors about missing configuration or cannot find `.taskmasterconfig`, run `task-master models --setup` in your project root to create or repair the file.
- Ensure API keys are correctly placed in your `.env` file (for CLI) or `.cursor/mcp.json` (for MCP) and are valid for the providers selected in `.taskmasterconfig`.

### If `task-master init` doesn't respond:

Try running it with Node directly:

```bash
node node_modules/task-master-ai/scripts/init.js
```

Or clone the repository and run:

```bash
git clone https://github.com/eyaltoledano/task-master.git
cd task-master
node scripts/init.js
