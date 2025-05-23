# [Task Master](https://github.com/eyaltoledano/claude-task-master) Lite [![GitHub stars](https://img.shields.io/github/stars/daoch4n/zen-ai-mcp-task-master?style=social)](https://github.com/daoch4n/zen-ai-mcp-task-master/stargazers)
### Focusing on OpenAI custom endpoint & MCP server exposed via network



https://github.com/user-attachments/assets/3212ebe3-9495-4181-bacf-65b431274fe7



[![Discord](https://dcbadge.limes.pink/api/server/https://discord.gg/taskmasterai?style=flat)](https://discord.gg/taskmasterai) [![License: MIT with Commons Clause](https://img.shields.io/badge/license-MIT%20with%20Commons%20Clause-blue.svg)](LICENSE) [![Twitter Follow](https://img.shields.io/twitter/follow/eyaltoledano?style=flat)](https://x.com/eyaltoledano) [![Twitter Follow](https://img.shields.io/twitter/follow/RalphEcom?style=flat)](https://x.com/RalphEcom)

## Requirements

Taskmaster Lite utilizes OpenAI API for AI-driven commands, which requires an OpenAI-compatible API key and compatible provider (OpenAI , OpenRouter , self-hosted models not relying on Ollama etc!..) <br>
You can define 3 types of models to be used: the main model, the research model, and the fallback model (in case either fail). <br> Whichever model you decide to use, its API key must be present in either mcp.json or .env as `OPENAI_API_KEY`. <br> Any OpenAI-compatible model can be used by specifying a custom endpoint. <br>
You can configure the main AI model using `TASKMASTER_AI_MODEL` and the research AI model using `TASKMASTER_RESEARCH_MODEL` in the `.env` file. <br> Both default to affordable option "gemini-2.5-flash-preview-05-20" if unset which works wonders on 24k thinking budget for a fraction of cost of alternative models!

- Bring your own OpenAI-compatible API key

- Using dedicated research model is optional but highly recommended

## Environment Variables

The following environment variables can be configured in a `.env` file (based on `.env.example`):

- `OPENAI_API_KEY`: Your OpenAI API key. This is required for using any AI role (main, research, or fallback). Default: `YOUR_OPENAI_KEY_HERE`
- `OPENAI_API_BASE_URL`: A custom endpoint for OpenAI-compatible models. Defaults to OpenAI provider
- `TASKMASTER_AI_MODEL`: Specifies the AI model to be used for Task Master's main operations. Default: `gemini-2.5-flash-preview-05-20`
- `TASKMASTER_RESEARCH_MODEL`: Specifies the AI model to be used for research operations. Default: `gemini-2.5-flash-preview-05-20`

## Quick Start

### Option 1 | MCP:

MCP (Model Control Protocol) provides the easiest way to get started with Task Master Lite directly in your editor.

1.  **Clone the repository**:

    ```bash
    git clone https://github.com/daoch4n/zen-ai-mcp-task-master
    cd zen-ai-mcp-task-master
    ```

2.  **Start the MCP server**:

    ```bash
    node mcp-server/server.js
    ```

3.  **Add the MCP config to your editor** :

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

4.  **Enable the MCP** in your editor

5.  **Prompt the AI** to initialize Task Master Lite:

    ```
    Initialize taskmaster-lite-ai into project.
    ```

6.  **Use common commands** directly through your AI assistant:

    ```txt
    Parse PRD at scripts/prd.txt.
    Get next task.
    Implement task 3.
    Expand task 4.
    ```

### Option 2 | MCP via Docker:

For a containerized environment, you can run Task Master Lite using Docker.

1.  **Clone the repository**:

    ```bash
    git clone https://github.com/daoch4n/zen-ai-mcp-task-master
    cd zen-ai-mcp-task-master
    ```

2.  **Build the Docker image**:

    ```bash
    docker build -t taskmaster-lite-ai .
    ```

3.  **Run the Docker container**:

    ```bash
    docker run -p 3000:3000 -e OPENAI_API_KEY="YOUR_OPENAI_KEY_HERE" -e OPENAI_API_BASE_URL="YOUR_OPENAI_API_BASE_URL_HERE" -e TASKMASTER_AI_MODEL="YOUR_TASKMASTER_AI_MODEL_HERE" -e TASKMASTER_RESEARCH_MODEL="YOUR_TASKMASTER_RESEARCH_MODEL_HERE" taskmaster-lite-ai
    ```

    Ensure you replace `YOUR_OPENAI_KEY_HERE` with your actual OpenAI API key.

4.  **Add the MCP config to your editor** (same as Option 1, step 3).
5.  **Enable the MCP** in your editor.
6.  **Prompt the AI** to initialize Task Master Lite (same as Option 1, step 5).
7.  **Use common commands** directly through your AI assistant (same as Option 1, step 6).

### Option 3 | Terminal:

#### Initialize a new project

```bash
node /path-to/zen-ai-mcp-task-master/bin/task-master.js init
```

This will prompt you for project details and set up a new project with the necessary files and structure.

#### Common Commands

```bash
# Initialize a new project
node /path-to/zen-ai-mcp-task-master/bin/task-master.js init

# Parse a PRD and generate tasks
node /path-to/zen-ai-mcp-task-master/bin/task-master.js parse-prd your-prd.txt

# List all tasks
node /path-to/zen-ai-mcp-task-master/bin/task-master.js list

# Show the next task to work on
node /path-to/zen-ai-mcp-task-master/bin/task-master.js next

# Generate task files
node /path-to/zen-ai-mcp-task-master/bin/task-master.js generate
```

## Documentation

For more detailed information, check out the documentation in the `docs` directory:

- [Configuration Guide](docs/configuration.md) - Set up environment variables and customize Task Master Lite
- [Tutorial](docs/tutorial.md) - Step-by-step guide to getting started with Task Master Lite
- [Command Reference](docs/command-reference.md) - Complete list of all available commands
- [Task Structure](docs/task-structure.md) - Understanding the task format and features
- [Example Interactions](docs/examples.md) - Common Cursor AI interaction examples

## Licensing

Task Master is licensed under the MIT License with Commons Clause:

✅ **Allowed**:

- Use Task Master for any purpose (personal, commercial, academic)
- Modify the code
- Distribute copies
- Create and sell products built using Task Master

❌ **Not Allowed**:

- Sell Task Master itself
- Offer Task Master as a hosted service
- Create competing products based on Task Master

See the [LICENSE](LICENSE) file for the complete license text and [licensing details](docs/licensing.md) for more information.
