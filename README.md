# mcp-[taskmaster](https://github.com/eyaltoledano/claude-task-master)-sse-openai-endpoint ⚙️
### `-47000 loc` + `OpenAI custom endpoint` & `MCP via SSE`



https://github.com/user-attachments/assets/3212ebe3-9495-4181-bacf-65b431274fe7



[![Discord](https://dcbadge.limes.pink/api/server/https://discord.gg/taskmasterai?style=flat)](https://discord.gg/taskmasterai) [![License: MIT with Commons Clause](https://img.shields.io/badge/license-MIT%20with%20Commons%20Clause-blue.svg)](LICENSE) 

## Requirements

Taskmaster Lite utilizes OpenAI API for AI-driven commands, which requires an OpenAI-compatible API key and compatible provider (Chutes, OpenRouter, OpenAI, self-hosted models, etc!..) <br>
You can define 3 types of models to be used: the main model, the research model, and the search model. <br> Whichever model you decide to use, its API key must be present in either mcp.json or .env as `OPENAI_API_KEY`. <br> Any OpenAI-compatible model can be used by specifying a custom endpoint. <br>
You can configure the main AI model using `TASKMASTER_AI_MODEL`, the research AI model using `TASKMASTER_RESEARCH_MODEL`, and the search AI model using `TASKMASTER_SEARCH_MODEL` in the `.env` file. <br> Reasonable default is set to affordable option "gemini-2.5-flash-preview-05-20" if unset which works wonders on 24k thinking budget for a fraction of cost of alternative models! Except for search model, which is recommended to set to internet-connected model such as Perplexity Sonar if you have access to it (OpenRouter can support lite usage on free tier providers), but it works with default Gemini choice as well, you won't lose much functionality.

## Environment Variables

The following environment variables can be configured in a `.env` file (based on `.env.example`):

- `OPENAI_API_KEY`: Your OpenAI API key. This is required for using any AI role (main, research, search, or fallback). Default: `YOUR_OPENAI_KEY_HERE`
- `OPENAI_API_BASE_URL`: A custom endpoint for OpenAI-compatible models. Defaults to OpenAI provider
- `TASKMASTER_AI_MODEL`: Specifies the AI model to be used for Task Master's main operations. Default: `gemini-2.5-flash-preview-05-20`
- `TASKMASTER_SEARCH_MODEL`: Specifies the AI model to be used for research-backed subtask generation/task updates operations. Default: `gemini-2.5-flash-preview-05-20`
- `TASKMASTER_RESEARCH_MODEL`: Specifies the AI model to be used for in-depth analysis operations. Default: `gemini-2.5-flash-preview-05-20`

## Quick Start

### Option 1 | MCP:

MCP (Model Control Protocol) provides the easiest way to get started with Task Master Lite directly in your editor.

1.  **Install Task Master Lite**:

    ```bash
    git clone https://github.com/daoch4n/zen-ai-mcp-task-master
    cd zen-ai-mcp-task-master
    npm install
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
    docker run -p 3000:3000 -e OPENAI_API_KEY="YOUR_OPENAI_KEY_HERE" -e OPENAI_API_BASE_URL="YOUR_OPENAI_API_BASE_URL_HERE" -e TASKMASTER_AI_MODEL="YOUR_TASKMASTER_AI_MODEL_HERE" -e TASKMASTER_RESEARCH_MODEL="YOUR_TASKMASTER_RESEARCH_MODEL_HERE" -e TASKMASTER_SEARCH_MODEL="YOUR_TASKMASTER_SEARCH_MODEL_HERE" taskmaster-lite-ai
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



