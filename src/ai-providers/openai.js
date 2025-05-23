import { createOpenAI } from '@ai-sdk/openai'; // Using openai provider from Vercel AI SDK
import { generateObject, generateText } from 'ai'; // Import necessary functions from 'ai'
import { log } from '../../scripts/modules/utils.js';

function getClient(apiKey, baseUrl) {
	if (!apiKey) {
		throw new Error('OpenAI API key is required.');
	}
	const openAIBaseUrl = process.env.OPENAI_API_BASE_URL || 'https://api.openai.com/v1';
	return createOpenAI({
		apiKey: apiKey,
		baseURL: openAIBaseUrl
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
		schema,
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

	const openaiClient = getClient(apiKey, baseUrl);

	let processedSchema = schema;

	// If the schema is a Zod schema, convert it to JSON schema
	if (typeof schema === 'object' && schema !== null && typeof schema.json === 'function') {
		processedSchema = schema.json();
	}

	// Deep copy the schema to avoid modifying the original object
	const cleanedSchema = JSON.parse(JSON.stringify(processedSchema));

	// Recursively remove unsupported keywords
	function cleanSchema(obj) {
		for (const key in obj) {
			if (Object.prototype.hasOwnProperty.call(obj, key)) {
				if (key === '$schema' || key === 'exclusiveMinimum') {
					delete obj[key];
				} else if (typeof obj[key] === 'object' && obj[key] !== null) {
					cleanSchema(obj[key]);
				}
			}
		}
	}
	cleanSchema(cleanedSchema);

	try {
		const result = await generateObject({
			model: openaiClient(modelId),
			schema: cleanedSchema, // Use the cleaned schema
			messages: messages,
			mode: 'tool',
			maxTokens: maxTokens,
			temperature: temperature
		});

		log(
			'debug',
			`OpenAI generateObject completed successfully for model: ${modelId}`
		);
		if (!result || typeof result.object === 'undefined') {
			log(
				'warn',
				'OpenAI generateObject response did not contain expected object.',
				{ result }
			);
			throw new Error('Failed to extract object from OpenAI response.');
		}
		return {
			object: result.object,
			usage: {
				inputTokens: result.usage.promptTokens,
				outputTokens: result.usage.completionTokens
			}
		};
	} catch (error) {
		log(
			'error',
			`Error in generateOpenAIObject (Model: ${modelId}, Object: ${objectName}): ${error.message}`,
			{ error }
		);
		throw new Error(
			`OpenAI API error during object generation: ${error.message}`
		);
	}
}
