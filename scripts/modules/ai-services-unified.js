/**
 * ai-services-unified.js
 * Centralized AI service layer using provider modules and config-manager.
 */

// Vercel AI SDK functions are NOT called directly anymore.
// import { generateText, streamText, generateObject } from 'ai';

// --- Core Dependencies ---
import {
	getMainProvider,
	getMainModelId,
	getResearchProvider,
	getResearchModelId,
	getFallbackProvider,
	getFallbackModelId,
	getParametersForRole,
	getUserId,
	MODEL_MAP,
	getDebugFlag,
	getBaseUrlForRole
} from './config-manager.js';
import { log, resolveEnvVariable, isSilentMode } from './utils.js';

import * as openai from '../../src/ai-providers/openai.js';





// Helper function to get cost for a specific model
function _getCostForModel(providerName, modelId) {
	if (!MODEL_MAP || !MODEL_MAP[providerName]) {
		log(
			'warn',
			`Provider "${providerName}" not found in MODEL_MAP. Cannot determine cost for model ${modelId}.`
		);
		return { inputCost: 0, outputCost: 0, currency: 'USD' }; // Default to zero cost
	}

	const modelData = MODEL_MAP[providerName].find((m) => m.id === modelId);

	if (!modelData || !modelData.cost_per_1m_tokens) {
		log(
			'debug',
			`Cost data not found for model "${modelId}" under provider "${providerName}". Assuming zero cost.`
		);
		return { inputCost: 0, outputCost: 0, currency: 'USD' }; // Default to zero cost
	}

	// Ensure currency is part of the returned object, defaulting if not present
	const currency = modelData.cost_per_1m_tokens.currency || 'USD';

	return {
		inputCost: modelData.cost_per_1m_tokens.input || 0,
		outputCost: modelData.cost_per_1m_tokens.output || 0,
		currency: currency
	};
}

// --- Provider Function Map ---
// Maps provider names (lowercase) to their respective service functions
const PROVIDER_FUNCTIONS = {
	openai: {
		generateText: openai.generateOpenAIText,
		streamText: openai.streamOpenAIText,
		generateObject: openai.generateOpenAIObject
	},
	
	
	
	
};

// --- Configuration for Retries ---
const MAX_RETRIES = 2;
const INITIAL_RETRY_DELAY_MS = 1000;

// Helper function to check if an error is retryable
function isRetryableError(error) {
	const errorMessage = error.message?.toLowerCase() || '';
	return (
		errorMessage.includes('rate limit') ||
		errorMessage.includes('overloaded') ||
		errorMessage.includes('service temporarily unavailable') ||
		errorMessage.includes('timeout') ||
		errorMessage.includes('network error') ||
		error.status === 429 ||
		error.status >= 500
	);
}

/**
 * Extracts a user-friendly error message from a potentially complex AI error object.
 * Prioritizes nested messages and falls back to the top-level message.
 * @param {Error | object | any} error - The error object.
 * @returns {string} A concise error message.
 */
function _extractErrorMessage(error) {
	try {
		// Attempt 1: Look for Vercel SDK specific nested structure (common)
		if (error?.data?.error?.message) {
			return error.data.error.message;
		}

		// Attempt 2: Look for nested error message directly in the error object
		if (error?.error?.message) {
			return error.error.message;
		}

		// Attempt 3: Look for nested error message in response body if it's JSON string
		if (typeof error?.responseBody === 'string') {
			try {
				const body = JSON.parse(error.responseBody);
				if (body?.error?.message) {
					return body.error.message;
				}
			} catch (parseError) {
				// Ignore if responseBody is not valid JSON
			}
		}

		// Attempt 4: Use the top-level message if it exists
		if (typeof error?.message === 'string' && error.message) {
			return error.message;
		}

		// Attempt 5: Handle simple string errors
		if (typeof error === 'string') {
			return error;
		}

		// Fallback
		return 'An unknown AI service error occurred.';
	} catch (e) {
		// Safety net
		return 'Failed to extract error message.';
	}
}

/**
 * Internal helper to resolve the API key for a given provider.
 * @param {string} providerName - The name of the provider (lowercase).
 * @param {object|null} session - Optional MCP session object.
 * @param {string|null} projectRoot - Optional project root path for .env fallback.
 * @returns {string|null} The API key or null if not found/needed.
 * @throws {Error} If a required API key is missing.
 */
function _resolveApiKey(providerName, session, projectRoot = null) {
	const keyMap = {
		openai: 'OPENAI_API_KEY',
		
		
		

	};

	const envVarName = keyMap[providerName];
	if (!envVarName) {
		// Ollama does not require an API key, so it's not in keyMap
		if (providerName === 'ollama') {
			return 'ollama-no-key-required'; // Special value for Ollama
		}
		throw new Error(
			`Unknown provider '${providerName}' for API key resolution.`
		);
	}

	const apiKey = resolveEnvVariable(envVarName, session, projectRoot);

	if (!apiKey) {
		log('warn', `API key ${envVarName} for provider '${providerName}' is not set. Skipping this provider.`);
		return null; // Return null instead of throwing
	}
	return apiKey;
}

/**
 * Internal helper to attempt a provider-specific AI API call with retries.
 *
 * @param {function} providerApiFn - The specific provider function to call (e.g., generateAnthropicText).
 * @param {object} callParams - Parameters object for the provider function.
 * @param {string} providerName - Name of the provider (for logging).
 * @param {string} modelId - Specific model ID (for logging).
 * @param {string} attemptRole - The role being attempted (for logging).
 * @returns {Promise<object>} The result from the successful API call.
 * @throws {Error} If the call fails after all retries.
 */
async function _attemptProviderCallWithRetries(
	providerApiFn,
	callParams,
	providerName,
	modelId,
	attemptRole
) {
	let retries = 0;
	const fnName = providerApiFn.name;

	while (retries <= MAX_RETRIES) {
		try {
			if (getDebugFlag()) {
				log(
					'info',
					`Attempt ${retries + 1}/${MAX_RETRIES + 1} calling ${fnName} (Provider: ${providerName}, Model: ${modelId}, Role: ${attemptRole})`
				);
			}

			// Call the specific provider function directly
			const result = await providerApiFn(callParams);

			if (getDebugFlag()) {
				log(
					'info',
					`${fnName} succeeded for role ${attemptRole} (Provider: ${providerName}) on attempt ${retries + 1}`
				);
			}
			return result;
		} catch (error) {
			log(
				'warn',
				`Attempt ${retries + 1} failed for role ${attemptRole} (${fnName} / ${providerName}): ${error.message}`
			);

			if (isRetryableError(error) && retries < MAX_RETRIES) {
				retries++;
				const delay = INITIAL_RETRY_DELAY_MS * Math.pow(2, retries - 1);
				log(
					'info',
					`Something went wrong on the provider side. Retrying in ${delay / 1000}s...`
				);
				await new Promise((resolve) => setTimeout(resolve, delay));
			} else {
				log(
					'error',
					`Something went wrong on the provider side. Max retries reached for role ${attemptRole} (${fnName} / ${providerName}).`
				);
				throw error;
			}
		}
	}
	// Should not be reached due to throw in the else block
	throw new Error(
		`Exhausted all retries for role ${attemptRole} (${fnName} / ${providerName})`
	);
}

/**
 * Base logic for unified service functions.
 * @param {string} serviceType - Type of service ('generateText', 'streamText', 'generateObject').
 * @param {object} params - Original parameters passed to the service function.
 * @param {string} params.role - The initial client role.
 * @param {object} [params.session=null] - Optional MCP session object.
 * @param {string} [params.projectRoot] - Optional project root path.
 * @param {string} params.commandName - Name of the command invoking the service.
 * @param {string} params.outputType - 'cli' or 'mcp'.
 * @param {string} [params.systemPrompt] - Optional system prompt.
 * @param {string} [params.prompt] - The prompt for the AI.
 * @param {string} [params.schema] - The Zod schema for the expected object.
 * @param {string} [params.objectName] - Name for object/tool.
 * @returns {Promise<any>} Result from the underlying provider call.
 */
async function _unifiedServiceRunner(serviceType, params) {
	const {
		role: initialRole,
		session,
		projectRoot,
		systemPrompt,
		prompt,
		schema,
		objectName,
		commandName,
		outputType,
		...restApiParams
	} = params;
	if (getDebugFlag()) {
		log('info', `${serviceType}Service called`, {
			role: initialRole,
			commandName,
			outputType,
			projectRoot
		});
	}

	// Determine the effective project root (passed in or detected if needed by config getters)
	const { findProjectRoot: detectProjectRoot } = await import('./utils.js'); // Dynamically import if needed
	const effectiveProjectRoot = projectRoot || detectProjectRoot();

	// Get userId from config - ensure effectiveProjectRoot is passed
	const userId = getUserId(effectiveProjectRoot);

	// Determine provider and model based on the role
	let providerName;
	let modelId;

	switch (initialRole) {
		case 'main':
			providerName = getMainProvider(effectiveProjectRoot);
			modelId = getMainModelId(effectiveProjectRoot);
			break;
		case 'research':
			providerName = getResearchProvider(effectiveProjectRoot);
			modelId = getResearchModelId(effectiveProjectRoot);
			break;
		case 'fallback':
			providerName = getFallbackProvider(effectiveProjectRoot);
			modelId = getFallbackModelId(effectiveProjectRoot);
			break;
		default:
			log('error', `Unknown role: ${initialRole}. Defaulting to main.`);
			providerName = getMainProvider(effectiveProjectRoot);
			modelId = getMainModelId(effectiveProjectRoot);
	}

	let lastError = null;
	let lastCleanErrorMessage =
		'AI service call failed for all configured roles.';

	try {
		log('info', `AI service call with provider: ${providerName}, model: ${modelId}`);

		if (!providerName || !modelId) {
			log(
				'error',
				`Critical: Provider or Model ID not configured for role '${initialRole}'. Provider: ${providerName}, Model: ${modelId}`
			);
			throw new Error(
				`Critical configuration missing for role '${initialRole}': Provider: ${providerName}, Model: ${modelId}`
			);
		}

		// Get parameters for the initial role (main, research, or fallback)
		const roleParams = getParametersForRole(initialRole, effectiveProjectRoot);
		const baseUrl = getBaseUrlForRole(initialRole, effectiveProjectRoot);

		// Get Provider Function Set
		const providerFnSet = PROVIDER_FUNCTIONS[providerName?.toLowerCase()];
		if (!providerFnSet) {
			log(
				'error',
				`Critical: Provider '${providerName}' not supported or map entry missing.`
			);
			throw new Error(`Unsupported provider configured: ${providerName}`);
		}

		// Use the original service type to get the function
		const providerApiFn = providerFnSet[serviceType];
		if (typeof providerApiFn !== 'function') {
			log(
				'error',
				`Critical: Service type '${serviceType}' not implemented for provider '${providerName}'.`
			);
			throw new Error(
				`Service '${serviceType}' not implemented for provider ${providerName}`
			);
		}

		// Resolve API Key (will throw if required and missing)
		const apiKey = _resolveApiKey(
			providerName?.toLowerCase(),
			session,
			effectiveProjectRoot
		);

		// If API key is null, it means it's required but not set.
		if (apiKey === null) {
			throw new Error(`API key missing for provider '${providerName}'.`);
		}

		// Construct Messages Array
		const messages = [];
		if (systemPrompt) {
			messages.push({ role: 'system', content: systemPrompt });
		}

		if (prompt) {
			// Ensure prompt exists before adding
			messages.push({ role: 'user', content: prompt });
		} else {
			// Throw an error if the prompt is missing, as it's essential
			throw new Error('User prompt content is missing.');
		}

		// Prepare call parameters (using messages array)
		const callParams = {
			apiKey,
			modelId,
			maxTokens: roleParams.maxTokens,
			temperature: roleParams.temperature,
			messages,
			baseUrl,
			...(serviceType === 'generateObject' && { schema, objectName }),
			...restApiParams
		};

		// Attempt the call with retries
		const providerResponse = await _attemptProviderCallWithRetries(
			providerApiFn,
			callParams,
			providerName,
			modelId,
			initialRole // Use initialRole for logging consistency
		);

		// --- Log Telemetry & Capture Data ---
		if (userId && providerResponse && providerResponse.usage) {
			try {
				const telemetryData = await logAiUsage({
					userId,
					commandName,
					providerName,
					modelId,
					inputTokens: providerResponse.usage.inputTokens,
					outputTokens: providerResponse.usage.outputTokens,
					outputType
				});
				// --- Extract the correct main result based on serviceType ---
				let finalMainResult;
				if (serviceType === 'generateText') {
					finalMainResult = providerResponse.text;
				} else if (serviceType === 'generateObject') {
					finalMainResult = providerResponse.object;
				} else if (serviceType === 'streamText') {
					finalMainResult = providerResponse; // Return the whole stream object
				} else {
					log(
						'error',
						`Unknown serviceType in _unifiedServiceRunner: ${serviceType}`
					);
					finalMainResult = providerResponse; // Default to returning the whole object as fallback
				}
				// --- End Main Result Extraction ---

				// Return a composite object including the extracted main result and telemetry data
				return {
					mainResult: finalMainResult,
					telemetryData: telemetryData
				};
			} catch (telemetryError) {
				// logAiUsage already logs its own errors and returns null on failure
				// No need to log again here, telemetryData will remain null
				log('warn', `Telemetry logging failed: ${telemetryError.message}`);
				// Proceed without telemetry data
				let finalMainResult;
				if (serviceType === 'generateText') {
					finalMainResult = providerResponse.text;
				} else if (serviceType === 'generateObject') {
					finalMainResult = providerResponse.object;
				} else if (serviceType === 'streamText') {
					finalMainResult = providerResponse;
				} else {
					finalMainResult = providerResponse;
				}
				return {
					mainResult: finalMainResult,
					telemetryData: null
				};
			}
		} else if (userId && providerResponse && !providerResponse.usage) {
			log(
				'warn',
				`Cannot log telemetry for ${commandName} (${providerName}/${modelId}): AI result missing 'usage' data. (May be expected for streams)`
			);
			// Proceed without telemetry data
			let finalMainResult;
			if (serviceType === 'generateText') {
				finalMainResult = providerResponse.text;
			} else if (serviceType === 'generateObject') {
				finalMainResult = providerResponse.object;
			} else if (serviceType === 'streamText') {
				finalMainResult = providerResponse;
			} else {
				finalMainResult = providerResponse;
			}
			return {
				mainResult: finalMainResult,
				telemetryData: null
			};
		} else {
			// No userId or providerResponse, proceed without telemetry
			let finalMainResult;
			if (serviceType === 'generateText') {
				finalMainResult = providerResponse.text;
			} else if (serviceType === 'generateObject') {
				finalMainResult = providerResponse.object;
			} else if (serviceType === 'streamText') {
				finalMainResult = providerResponse;
			} else {
				finalMainResult = providerResponse;
			}
			return {
				mainResult: finalMainResult,
				telemetryData: null
			};
		}
	} catch (error) {
		const cleanMessage = _extractErrorMessage(error);
		log(
			'error',
			`Service call failed for role '${initialRole}' (Provider: ${providerName || 'unknown'}, Model: ${modelId || 'unknown'}): ${cleanMessage}`
		);
		lastError = error;
		lastCleanErrorMessage = cleanMessage;

		if (serviceType === 'generateObject') {
			const lowerCaseMessage = cleanMessage.toLowerCase();
			if (
				lowerCaseMessage.includes(
					'no endpoints found that support tool use'
				) ||
				lowerCaseMessage.includes('does not support tool_use') ||
				lowerCaseMessage.includes('tool use is not supported') ||
				lowerCaseMessage.includes('tools are not supported') ||
				lowerCaseMessage.includes('function calling is not supported')
			) {
				const specificErrorMsg = `Model '${modelId || 'unknown'}' via provider '${providerName || 'unknown'}' does not support the 'tool use' required by generateObjectService. Please configure a model that supports tool/function calling for the '${initialRole}' role, or use generateTextService if structured output is not strictly required.`;
				log('error', `[Tool Support Error] ${specificErrorMsg}`);
				throw new Error(specificErrorMsg);
			}
		}
		// Re-throw the error as there's no fallback
		throw new Error(lastCleanErrorMessage);
	}
}

/**
 * Unified service function for generating text.
 * Handles client retrieval, retries, and fallback sequence.
 *
 * @param {object} params - Parameters for the service call.
 * @param {string} params.role - The initial client role ('main', 'research', 'fallback').
 * @param {object} [params.session=null] - Optional MCP session object.
 * @param {string} [params.projectRoot=null] - Optional project root path for .env fallback.
 * @param {string} params.prompt - The prompt for the AI.
 * @param {string} [params.systemPrompt] - Optional system prompt.
 * @param {string} params.commandName - Name of the command invoking the service.
 * @param {string} [params.outputType='cli'] - 'cli' or 'mcp'.
 * @returns {Promise<object>} Result object containing generated text and usage data.
 */
async function generateTextService(params) {
	// Ensure default outputType if not provided
	const defaults = { outputType: 'cli' };
	const combinedParams = { ...defaults, ...params };
	// TODO: Validate commandName exists?
	return _unifiedServiceRunner('generateText', combinedParams);
}

/**
 * Unified service function for streaming text.
 * Handles client retrieval, retries, and fallback sequence.
 *
 * @param {object} params - Parameters for the service call.
 * @param {string} params.role - The initial client role ('main', 'research', 'fallback').
 * @param {object} [params.session=null] - Optional MCP session object.
 * @param {string} [params.projectRoot=null] - Optional project root path for .env fallback.
 * @param {string} params.prompt - The prompt for the AI.
 * @param {string} [params.systemPrompt] - Optional system prompt.
 * @param {string} params.commandName - Name of the command invoking the service.
 * @param {string} [params.outputType='cli'] - 'cli' or 'mcp'.
 * @returns {Promise<object>} Result object containing the stream and usage data.
 */
async function streamTextService(params) {
	const defaults = { outputType: 'cli' };
	const combinedParams = { ...defaults, ...params };
	// TODO: Validate commandName exists?
	// NOTE: Telemetry for streaming might be tricky as usage data often comes at the end.
	// The current implementation logs *after* the stream is returned.
	// We might need to adjust how usage is captured/logged for streams.
	return _unifiedServiceRunner('streamText', combinedParams);
}

/**
 * Unified service function for generating structured objects.
 * Handles client retrieval, retries, and fallback sequence.
 *
 * @param {object} params - Parameters for the service call.
 * @param {string} params.role - The initial client role ('main', 'research', 'fallback').
 * @param {object} [params.session=null] - Optional MCP session object.
 * @param {string} [params.projectRoot=null] - Optional project root path for .env fallback.
 * @param {import('zod').ZodSchema} params.schema - The Zod schema for the expected object.
 * @param {string} params.prompt - The prompt for the AI.
 * @param {string} [params.systemPrompt] - Optional system prompt.
 * @param {string} [params.objectName='generated_object'] - Name for object/tool.
 * @param {number} [params.maxRetries=3] - Max retries for object generation.
 * @param {string} params.commandName - Name of the command invoking the service.
 * @param {string} [params.outputType='cli'] - 'cli' or 'mcp'.
 * @returns {Promise<object>} Result object containing the generated object and usage data.
 */
async function generateObjectService(params) {
	const defaults = {
		objectName: 'generated_object',
		maxRetries: 3,
		outputType: 'cli'
	};
	const combinedParams = { ...defaults, ...params };
	// TODO: Validate commandName exists?
	return _unifiedServiceRunner('generateObject', combinedParams);
}

// --- Telemetry Function ---
/**
 * Logs AI usage telemetry data.
 * For now, it just logs to the console. Sending will be implemented later.
 * @param {object} params - Telemetry parameters.
 * @param {string} params.userId - Unique user identifier.
 * @param {string} params.commandName - The command that triggered the AI call.
 * @param {string} params.providerName - The AI provider used (e.g., 'openai').
 * @param {string} params.modelId - The specific AI model ID used.
 * @param {number} params.inputTokens - Number of input tokens.
 * @param {number} params.outputTokens - Number of output tokens.
 */
async function logAiUsage({
	userId,
	commandName,
	providerName,
	modelId,
	inputTokens,
	outputTokens,
	outputType
}) {
	try {
		const isMCP = outputType === 'mcp';
		const timestamp = new Date().toISOString();
		const totalTokens = (inputTokens || 0) + (outputTokens || 0);

		// Destructure currency along with costs
		const { inputCost, outputCost, currency } = _getCostForModel(
			providerName,
			modelId
		);

		const totalCost =
			((inputTokens || 0) / 1_000_000) * inputCost +
			((outputTokens || 0) / 1_000_000) * outputCost;

		const telemetryData = {
			timestamp,
			userId,
			commandName,
			modelUsed: modelId, // Consistent field name from requirements
			providerName, // Keep provider name for context
			inputTokens: inputTokens || 0,
			outputTokens: outputTokens || 0,
			totalTokens,
			totalCost: parseFloat(totalCost.toFixed(6)),
			currency // Add currency to the telemetry data
		};

		if (getDebugFlag()) {
			log('info', 'AI Usage Telemetry:', telemetryData);
		}

		// TODO (Subtask 77.2): Send telemetryData securely to the external endpoint.

		return telemetryData;
	} catch (error) {
		log('error', `Failed to log AI usage telemetry: ${error.message}`, {
			error
		});
		// Don't re-throw; telemetry failure shouldn't block core functionality.
		return null;
	}
}

export {
	generateTextService,
	streamTextService,
	generateObjectService,
	logAiUsage
};
