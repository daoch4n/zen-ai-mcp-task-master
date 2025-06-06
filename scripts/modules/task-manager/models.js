/**
 * models.js
 * Core functionality for managing AI model configurations
 */

import path from 'path';
import fs from 'fs';
import {
	getMainModelId,
	getResearchModelId,
	getFallbackModelId,
	getAvailableModels,
	getMainProvider,
	getResearchProvider,
	getFallbackProvider,
	isApiKeySet,
	getMcpApiKeyStatus,
	getConfig,
	writeConfig,
	isConfigFilePresent,
	getAllProviders
} from '../config-manager.js';


/**
 * Get the current model configuration
 * @param {Object} [options] - Options for the operation
 * @param {Object} [options.session] - Session object containing environment variables (for MCP)
 * @param {Function} [options.mcpLog] - MCP logger object (for MCP)
 * @param {string} [options.projectRoot] - Project root directory
 * @returns {Object} RESTful response with current model configuration
 */
async function getModelConfiguration(options = {}) {
	const { mcpLog, projectRoot, session } = options;

	const report = (level, ...args) => {
		if (mcpLog && typeof mcpLog[level] === 'function') {
			mcpLog[level](...args);
		}
	};

	// Check if configuration file exists using provided project root
	let configPath;
	let configExists = false;

	if (projectRoot) {
		configPath = path.join(projectRoot, '.taskmasterconfig');
		configExists = fs.existsSync(configPath);
		report(
			'info',
			`Checking for .taskmasterconfig at: ${configPath}, exists: ${configExists}`
		);
	} else {
		configExists = isConfigFilePresent();
		report(
			'info',
			`Checking for .taskmasterconfig using isConfigFilePresent(), exists: ${configExists}`
		);
	}

	if (!configExists) {
		return {
			success: false,
			error: {
				code: 'CONFIG_MISSING',
				message:
					'The .taskmasterconfig file is missing. Run "task-master models --setup" to create it.'
			}
		};
	}

	try {
		// Get current settings - these should use the config from the found path automatically
		const mainProvider = getMainProvider(projectRoot);
		const mainModelId = getMainModelId(projectRoot);
		const researchProvider = getResearchProvider(projectRoot);
		const researchModelId = getResearchModelId(projectRoot);
		const searchProvider = getSearchProvider(projectRoot); // Get search provider
		const searchModelId = getSearchModelId(projectRoot); // Get search model ID
		const fallbackProvider = getFallbackProvider(projectRoot);
		const fallbackModelId = getFallbackModelId(projectRoot);

		// Check API keys
		const mainCliKeyOk = isApiKeySet(mainProvider, session, projectRoot);
		const mainMcpKeyOk = getMcpApiKeyStatus(mainProvider, projectRoot);
		const researchCliKeyOk = isApiKeySet(
			researchProvider,
			session,
			projectRoot
		);
		const researchMcpKeyOk = getMcpApiKeyStatus(researchProvider, projectRoot);
		const searchCliKeyOk = searchProvider
			? isApiKeySet(searchProvider, session, projectRoot)
			: true; // Check only if provider exists
		const searchMcpKeyOk = searchProvider
			? getMcpApiKeyStatus(searchProvider, projectRoot)
			: true; // Check only if provider exists
		const fallbackCliKeyOk = fallbackProvider
			? isApiKeySet(fallbackProvider, session, projectRoot)
			: true;
		const fallbackMcpKeyOk = fallbackProvider
			? getMcpApiKeyStatus(fallbackProvider, projectRoot)
			: true;

		// Get available models to find detailed info
		const availableModels = getAvailableModels(projectRoot);

		// Find model details
		const mainModelData = availableModels.find((m) => m.id === mainModelId);
		const researchModelData = availableModels.find(
			(m) => m.id === researchModelId
		);
		const searchModelData = searchModelId
			? availableModels.find((m) => m.id === searchModelId)
			: null; // Find search model data
		const fallbackModelData = fallbackModelId
			? availableModels.find((m) => m.id === fallbackModelId)
			: null;

		// Return structured configuration data
		return {
			success: true,
			data: {
				activeModels: {
					main: {
						provider: mainProvider,
						modelId: mainModelId,
						sweScore: mainModelData?.swe_score || null,
						cost: mainModelData?.cost_per_1m_tokens || null,
						keyStatus: {
							cli: mainCliKeyOk,
							mcp: mainMcpKeyOk
						}
					},
					research: {
						provider: researchProvider,
						modelId: researchModelId,
						sweScore: researchModelData?.swe_score || null,
						cost: researchModelData?.cost_per_1m_tokens || null,
						keyStatus: {
							cli: researchCliKeyOk,
							mcp: researchMcpKeyOk
						}
					},
					search: searchProvider
						? {
								provider: searchProvider,
								modelId: searchModelId,
								sweScore: searchModelData?.swe_score || null,
								cost: searchModelData?.cost_per_1m_tokens || null,
								keyStatus: {
									cli: searchCliKeyOk,
									mcp: searchMcpKeyOk
								}
							}
						: null, // Include search model
					fallback: fallbackProvider
						? {
								provider: fallbackProvider,
								modelId: fallbackModelId,
								sweScore: fallbackModelData?.swe_score || null,
								cost: fallbackModelData?.cost_per_1m_tokens || null,
								keyStatus: {
									cli: fallbackCliKeyOk,
									mcp: fallbackMcpKeyOk
								}
							}
						: null
				},
				message: 'Successfully retrieved current model configuration'
			}
		};
	} catch (error) {
		report('error', `Error getting model configuration: ${error.message}`);
		return {
			success: false,
			error: {
				code: 'CONFIG_ERROR',
				message: error.message
			}
		};
	}
}

/**
 * Get all available models not currently in use
 * @param {Object} [options] - Options for the operation
 * @param {Object} [options.session] - Session object containing environment variables (for MCP)
 * @param {Function} [options.mcpLog] - MCP logger object (for MCP)
 * @param {string} [options.projectRoot] - Project root directory
 * @returns {Object} RESTful response with available models
 */
async function getAvailableModelsList(options = {}) {
	const { mcpLog, projectRoot } = options;

	const report = (level, ...args) => {
		if (mcpLog && typeof mcpLog[level] === 'function') {
			mcpLog[level](...args);
		}
	};

	// Check if configuration file exists using provided project root
	let configPath;
	let configExists = false;

	if (projectRoot) {
		configPath = path.join(projectRoot, '.taskmasterconfig');
		configExists = fs.existsSync(configPath);
		report(
			'info',
			`Checking for .taskmasterconfig at: ${configPath}, exists: ${configExists}`
		);
	} else {
		configExists = isConfigFilePresent();
		report(
			'info',
			`Checking for .taskmasterconfig using isConfigFilePresent(), exists: ${configExists}`
		);
	}

	if (!configExists) {
		return {
			success: false,
			error: {
				code: 'CONFIG_MISSING',
				message:
					'The .taskmasterconfig file is missing. Run "task-master models --setup" to create it.'
			}
		};
	}

	try {
		// Get all available models
		const allAvailableModels = getAvailableModels(projectRoot);

		if (!allAvailableModels || allAvailableModels.length === 0) {
			return {
				success: true,
				data: {
					models: [],
					message: 'No available models found'
				}
			};
		}

		// Get currently used model IDs
		const mainModelId = getMainModelId(projectRoot);
		const researchModelId = getResearchModelId(projectRoot);
		const searchModelId = getSearchModelId(projectRoot); // Get search model ID
		const fallbackModelId = getFallbackModelId(projectRoot);

		// Filter out placeholder models and active models
		const activeIds = [
			mainModelId,
			researchModelId,
			searchModelId, // Include search model ID
			fallbackModelId
		].filter(Boolean);
		const otherAvailableModels = allAvailableModels.map((model) => ({
			provider: model.provider || 'N/A',
			modelId: model.id,
			sweScore: model.swe_score || null,
			cost: model.cost_per_1m_tokens || null,
			allowedRoles: model.allowed_roles || []
		}));

		return {
			success: true,
			data: {
				models: otherAvailableModels,
				message: `Successfully retrieved ${otherAvailableModels.length} available models`
			}
		};
	} catch (error) {
		report('error', `Error getting available models: ${error.message}`);
		return {
			success: false,
			error: {
				code: 'MODELS_LIST_ERROR',
				message: error.message
			}
		};
	}
}

/**
 * Update a specific model in the configuration
 * @param {string} role - The model role to update ('main', 'research', 'fallback')
 * @param {string} modelId - The model ID to set for the role
 * @param {Object} [options] - Options for the operation
 * @param {string} [options.providerHint] - Provider hint if already determined ('ollama')
 * @param {Object} [options.session] - Session object containing environment variables (for MCP)
 * @param {Function} [options.mcpLog] - MCP logger object (for MCP)
 * @param {string} [options.projectRoot] - Project root directory
 * @returns {Object} RESTful response with result of update operation
 */
async function setModel(role, modelId, options = {}) {
	const { mcpLog, projectRoot, providerHint } = options;

	const report = (level, ...args) => {
		if (mcpLog && typeof mcpLog[level] === 'function') {
			mcpLog[level](...args);
		}
	};

	// Check if configuration file exists using provided project root
	let configPath;
	let configExists = false;

	if (projectRoot) {
		configPath = path.join(projectRoot, '.taskmasterconfig');
		configExists = fs.existsSync(configPath);
		report(
			'info',
			`Checking for .taskmasterconfig at: ${configPath}, exists: ${configExists}`
		);
	} else {
		configExists = isConfigFilePresent();
		report(
			'info',
			`Checking for .taskmasterconfig using isConfigFilePresent(), exists: ${configExists}`
		);
	}

	if (!configExists) {
		return {
			success: false,
			error: {
				code: 'CONFIG_MISSING',
				message:
					'The .taskmasterconfig file is missing. Run "task-master models --setup" to create it.'
			}
		};
	}

	// Validate role
	if (!['main', 'research', 'search', 'fallback'].includes(role)) {
		return {
			success: false,
			error: {
				code: 'INVALID_ROLE',
				message: `Invalid role: ${role}. Must be one of: main, research, search, fallback.`
			}
		};
	}

	// Validate model ID
	if (typeof modelId !== 'string' || modelId.trim() === '') {
		return {
			success: false,
			error: {
				code: 'INVALID_MODEL_ID',
				message: `Invalid model ID: ${modelId}. Must be a non-empty string.`
			}
		};
	}

	try {
		const availableModels = getAvailableModels(projectRoot);
		const currentConfig = getConfig(projectRoot);
		let determinedProvider = null; // Initialize provider
		let warningMessage = null;

		// Find the model data in internal list initially to see if it exists at all
		let modelData = availableModels.find((m) => m.id === modelId);

		// --- Revised Logic: Prioritize providerHint --- //

		if (providerHint) {
			// Hint provided (--ollama flag used)
			if (modelData && modelData.provider === providerHint) {
				// Model is in supported list AND matches provider hint
				determinedProvider = providerHint;
				report(
					'info',
					`Model ${modelId} found internally with matching provider hint ${determinedProvider}.`
				);
			} else if (providerHint === 'ollama') {
				// Hinted as Ollama - set provider directly
				determinedProvider = 'ollama';
				warningMessage = `Warning: Custom Ollama model '${modelId}' set. Ensure your Ollama server is running and has pulled this model. Taskmaster cannot guarantee compatibility.`;
				report('warn', warningMessage);
			} else {
				// Invalid provider hint - should not happen
				throw new Error(`Invalid provider hint received: ${providerHint}`);
			}
		} else if (modelData) {
			// No hint, found internally, use the provider from the internal list
			determinedProvider = modelData.provider;
			report(
				'info',
				`Model ${modelId} found internally with provider ${determinedProvider}.`
			);
		} else {
			// No hint, not in supported models - try to guess based on known custom models
			if (isOllamaModel(modelId)) {
				determinedProvider = 'ollama';
			} else {
				return {
					success: false,
					error: {
						code: 'MODEL_NOT_FOUND_NO_HINT',
						message: `Model ID "${modelId}" not found in Taskmaster's supported models. If this is a custom model, please specify the provider using --ollama.`,
					},
				};
			}
		}

		// --- End of Revised Logic --- //

		// At this point, we should have a determinedProvider if the model is valid (internally or custom)
		if (!determinedProvider) {
			// This case acts as a safeguard
			return {
				success: false,
				error: {
					code: 'PROVIDER_UNDETERMINED',
					message: `Could not determine the provider for model ID "${modelId}".`
				}
			};
		}

		// Update configuration
		currentConfig.models[role] = {
			...currentConfig.models[role], // Keep existing params like maxTokens
			provider: determinedProvider,
			modelId: modelId
		};

		// Write updated configuration
		const writeResult = writeConfig(currentConfig, projectRoot);
		if (!writeResult) {
			return {
				success: false,
				error: {
					code: 'WRITE_ERROR',
					message: 'Error writing updated configuration to .taskmasterconfig'
				}
			};
		}

		const successMessage = `Successfully set ${role} model to ${modelId} (Provider: ${determinedProvider})`;
		report('info', successMessage);

		return {
			success: true,
			data: {
				role,
				provider: determinedProvider,
				modelId,
				message: successMessage,
				warning: warningMessage // Include warning in the response data
			}
		};
	} catch (error) {
		report('error', `Error setting ${role} model: ${error.message}`);
		return {
			success: false,
			error: {
				code: 'SET_MODEL_ERROR',
				message: error.message
			}
		};
	}
}

/**
 * Get API key status for all known providers.
 * @param {Object} [options] - Options for the operation
 * @param {Object} [options.session] - Session object containing environment variables (for MCP)
 * @param {Function} [options.mcpLog] - MCP logger object (for MCP)
 * @param {string} [options.projectRoot] - Project root directory
 * @returns {Object} RESTful response with API key status report
 */
async function getApiKeyStatusReport(options = {}) {
	const { mcpLog, projectRoot, session } = options;
	const report = (level, ...args) => {
		if (mcpLog && typeof mcpLog[level] === 'function') {
			mcpLog[level](...args);
		}
	};

	try {
		const providers = getAllProviders();
		const providersToCheck = providers.filter(
			(p) => p.toLowerCase() !== 'ollama'
		); // Ollama is not a provider, it's a service, doesn't need an api key usually
		const statusReport = providersToCheck.map((provider) => {
			// Use provided projectRoot for MCP status check
			const cliOk = isApiKeySet(provider, session, projectRoot); // Pass session and projectRoot for CLI check
			const mcpOk = getMcpApiKeyStatus(provider, projectRoot);
			return {
				provider,
				cli: cliOk,
				mcp: mcpOk
			};
		});

		report('info', 'Successfully generated API key status report.');
		return {
			success: true,
			data: {
				report: statusReport,
				message: 'API key status report generated.'
			}
		};
	} catch (error) {
		report('error', `Error generating API key status report: ${error.message}`);
		return {
			success: false,
			error: {
				code: 'API_KEY_STATUS_ERROR',
				message: error.message
			}
		};
	}
}

export {
	getModelConfiguration,
	getAvailableModelsList,
	setModel,
	getApiKeyStatusReport,
};
