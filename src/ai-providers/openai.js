import { createOpenAI } from '@ai-sdk/openai'; // Using openai provider from Vercel AI SDK
import { generateText } from 'ai'; // Only generateText remains using ai-sdk
import OpenAI from 'openai'; // Import OpenAI from the official package
import { log } from '../../scripts/modules/utils.js';

// This client is for generateText and streamText
function getAiSdkClient(apiKey, baseUrl) {
	if (!apiKey) {
		throw new Error('OpenAI API key is required.');
	}
	const openAIBaseUrl = baseUrl || process.env.OPENAI_API_BASE_URL || 'https://api.openai.com/v1';
	return createOpenAI({
		apiKey: apiKey,
		baseURL: openAIBaseUrl
	});
}

// This client is for generateOpenAIObject
function getOpenAIClient(apiKey, baseUrl) {
	if (!apiKey) {
		throw new Error('OpenAI API key is required.');
	}
	const effectiveBaseUrl = baseUrl || process.env.OPENAI_API_BASE_URL || 'https://api.openai.com/v1';
	return new OpenAI({
		apiKey: apiKey,
		baseURL: effectiveBaseUrl,
        dangerouslyAllowBrowser: true, // For environments where this might be an issue (e.g., edge runtimes)
	});
}

/**
 * Generates text using OpenAI models via Vercel AI SDK.
 *
 * @param {object} params - Parameters including apiKey, modelId, messages, maxTokens, temperature, baseUrl.
 * @returns {Promise<object>} The generated text content and usage.
 * @throws {Error} If API call fails.
 */
export async function generateOpenAIText(params) {
	const { apiKey, modelId, messages, maxTokens, temperature, baseUrl } = params;
	log('debug', `generateOpenAIText called with model: ${modelId}`);

	if (!apiKey) {
		throw new Error('OpenAI API key is required.');
	}
	if (!modelId) {
		throw new Error('OpenAI Model ID is required.');
	}
	if (!messages || !Array.isArray(messages) || messages.length === 0) {
		throw new Error('Invalid or empty messages array provided for OpenAI.');
	}

	const openaiClient = getClient(apiKey, baseUrl);

	try {
		const result = await generateText({
			model: openaiClient(modelId),
			messages,
			maxTokens,
			temperature
		});

		if (!result || !result.text) {
			log(
				'warn',
				'OpenAI generateText response did not contain expected content.',
				{ result }
			);
			throw new Error('Failed to extract content from OpenAI response.');
		}
		log(
			'debug',
			`OpenAI generateText completed successfully for model: ${modelId}`
		);
		return {
			text: result.text.trim(),
			usage: {
				inputTokens: result.usage.promptTokens,
				outputTokens: result.usage.completionTokens
			}
		};
	} catch (error) {
		log(
			'error',
			`Error in generateOpenAIText (Model: ${modelId}): ${error.message}`,
			{ error }
		);
		throw new Error(
			`OpenAI API error during text generation: ${error.message}`
		);
	}
}

/**
 * Streams text using OpenAI models via Vercel AI SDK.
 *
 * @param {object} params - Parameters including apiKey, modelId, messages, maxTokens, temperature, baseUrl.
 * @returns {Promise<ReadableStream>} A readable stream of text deltas.
 * @throws {Error} If API call fails.
 */
export async function streamOpenAIText(params) {
	const { apiKey, modelId, messages, maxTokens, temperature, baseUrl } = params;
	log('debug', `streamOpenAIText called with model: ${modelId}`);

	if (!apiKey) {
		throw new Error('OpenAI API key is required.');
	}
	if (!modelId) {
		throw new Error('OpenAI Model ID is required.');
	}
	if (!messages || !Array.isArray(messages) || messages.length === 0) {
		throw new Error(
			'Invalid or empty messages array provided for OpenAI streaming.'
		);
	}

	const openaiClient = getClient(apiKey, baseUrl);

	try {
		const stream = await openaiClient.chat.stream(messages, {
			model: modelId,
			max_tokens: maxTokens,
			temperature
		});

		log(
			'debug',
			`OpenAI streamText initiated successfully for model: ${modelId}`
		);
		return stream;
	} catch (error) {
		log(
			'error',
			`Error initiating OpenAI stream (Model: ${modelId}): ${error.message}`,
			{ error }
		);
		throw new Error(
			`OpenAI API error during streaming initiation: ${error.message}`
		);
	}
}

/**
 * Generates structured objects using OpenAI models via Vercel AI SDK.
 *
 * @param {object} params - Parameters including apiKey, modelId, messages, schema, objectName, maxTokens, temperature, baseUrl.
 * @returns {Promise<object>} The generated object matching the schema and usage.
 * @throws {Error} If API call fails or object generation fails.
 */
export async function generateOpenAIObject(params) {
	const {
		apiKey,
		modelId,
		messages,
		schema, // This is now a plain JSON schema, not Zod
		objectName,
		maxTokens,
		temperature,
		baseUrl
	} = params;
	log(
		'debug',
		`generateOpenAIObject called with model: ${modelId}, object: ${objectName}`
	);

	if (!apiKey) throw new Error('OpenAI API key is required.');
	if (!modelId) throw new Error('OpenAI Model ID is required.');
	if (!messages || !Array.isArray(messages) || messages.length === 0)
		throw new Error('Invalid messages array for OpenAI object generation.');
	if (!schema)
		throw new Error('Schema is required for OpenAI object generation.');
	if (!objectName)
		throw new Error('Object name is required for OpenAI object generation.');

	const openaiClient = getOpenAIClient(apiKey, baseUrl); // Use the direct OpenAI client

	try {
		log('debug', 'Schema being sent to OpenAI:', schema);

		// Construct the tools array with the cleaned JSON schema
		const tools = [
			{
				type: 'function',
				function: {
					name: objectName, // Use the provided objectName as the tool name
					description: `Generate a JSON object for ${objectName}`,
					parameters: schema // Pass the cleaned JSON schema directly
				}
			}
		];

		const response = await openaiClient.chat.completions.create({
			model: modelId,
			messages: messages,
			tools: tools,
			tool_choice: { type: 'function', function: { name: objectName } }, // Force tool use
			max_tokens: maxTokens,
			temperature: temperature
		});

		log(
			'debug',
			`OpenAI chat.completions.create completed successfully for model: ${modelId}`
		);

		// Extract the tool call and parse the arguments
		const toolCall = response.choices[0]?.message?.tool_calls?.[0];

		if (
			!toolCall ||
			toolCall.function.name !== objectName ||
			!toolCall.function.arguments
		) {
			log(
				'warn',
				'OpenAI response did not contain expected tool call for object generation.',
				{ response }
			);
			throw new Error('Failed to extract object from OpenAI response.');
		}

		const parsedObject = JSON.parse(toolCall.function.arguments);

		return {
			object: parsedObject,
			usage: {
				inputTokens: response.usage?.prompt_tokens || 0,
				outputTokens: response.usage?.completion_tokens || 0
			}
		};
	} catch (error) {
		log(
			'error',
			`Error in generateOpenAIObject (Model: ${modelId}, Object: ${objectName}): ${error.message}`,
			{ error }
		);
		// If the error message indicates a tool_use/function_calling issue
		const lowerCaseMessage = error.message?.toLowerCase();
		if (
			lowerCaseMessage?.includes('no endpoints found that support tool use') ||
			lowerCaseMessage?.includes('does not support tool_use') ||
			lowerCaseMessage?.includes('tool use is not supported') ||
			lowerCaseMessage?.includes('tools are not supported') ||
			lowerCaseMessage?.includes('function calling is not supported')
		) {
			const specificErrorMsg = `Model '${modelId}' via OpenAI API does not support the 'tool use' (function calling) required for object generation. Please configure a model that supports tool/function calling for this role.`;
			log('error', `[Tool Support Error] ${specificErrorMsg}`);
			throw new Error(specificErrorMsg);
		}
		throw new Error(
			`OpenAI API error during object generation: ${error.message}`
		);
	}
}
