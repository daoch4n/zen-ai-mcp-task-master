#!/usr/bin/env node

import TaskMasterMCPServer from './src/index.js';
import dotenv from 'dotenv';
import logger from './src/logger.js';

console.log('MCP Server script started.'); // Added for early diagnostic

// Load environment variables
try {
	dotenv.config();
	console.log('Environment variables loaded.'); // Added for diagnostic
} catch (e) {
	console.error('Error loading environment variables:', e);
	process.exit(1);
}

/**
 * Start the MCP server
 */
async function startServer() {
	let server;
	try {
		server = new TaskMasterMCPServer();
		console.log('TaskMasterMCPServer instantiated.'); // Added for diagnostic
	} catch (e) {
		console.error('Error instantiating TaskMasterMCPServer:', e);
		process.exit(1);
	}

	// Handle graceful shutdown
	process.on('SIGINT', async () => {
		await server.stop();
		process.exit(0);
	});

	process.on('SIGTERM', async () => {
		await server.stop();
		process.exit(0);
	});

	try {
		await server.start();
		console.log('MCP Server started successfully.'); // Added for diagnostic
	} catch (error) {
		logger.error(`Failed to start MCP server: ${error.message}`);
		process.exit(1);
	}
}

// Start the server
startServer();
