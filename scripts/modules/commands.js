/**
 * commands.js
 * Command-line interface for the Task Master CLI
 */

import { program } from 'commander';
import path from 'path';
import chalk from 'chalk';
import boxen from 'boxen';
import fs from 'fs';
import https from 'https';
import inquirer from 'inquirer';
import ora from 'ora'; // Import ora

import { log, readJSON } from './utils.js';
import {
	parsePRD,
	updateTasks,
	generateTaskFiles,
	setTaskStatus,
	listTasks,
	expandTask,
	expandAllTasks,
	clearSubtasks,
	addTask,
	addSubtask,
	removeSubtask,
	analyzeTaskComplexity,
	updateTaskById,
	updateSubtaskById,
	removeTask,
	findTaskById,
	taskExists
} from './task-manager.js';

import {
	addDependency,
	removeDependency,
	validateDependenciesCommand,
	fixDependenciesCommand
} from './dependency-manager.js';

import {
	isApiKeySet,
	getDebugFlag,
	getConfig,
	writeConfig,
	ConfigurationError,
	isConfigFilePresent,
	getAvailableModels
} from './config-manager.js';

import {
	displayBanner,
	displayHelp,
	displayNextTask,
	displayTaskById,
	displayComplexityReport,
	getStatusWithColor,
	confirmTaskOverwrite,
	startLoadingIndicator,
	stopLoadingIndicator,
	displayModelConfiguration,
	displayAvailableModels,
	displayApiKeyStatus,
	displayAiUsageSummary
} from './ui.js';

import { initializeProject } from '../init.js';
import {
	getModelConfiguration,
	getAvailableModelsList,
	setModel,
	getApiKeyStatusReport
} from './task-manager/models.js';
import { findProjectRoot } from './utils.js';
import {
	isValidTaskStatus,
	TASK_STATUS_OPTIONS
} from '../../src/constants/task-status.js';
import { getTaskMasterVersion } from '../../src/utils/getVersion.js';
/**
 * Runs the interactive setup process for model configuration.
 * @param {string|null} projectRoot - The resolved project root directory.
 */
async function runInteractiveSetup(projectRoot) {
	if (!projectRoot) {
		console.error(
			chalk.red(
				'Error: Could not determine project root for interactive setup.'
			)
		);
		process.exit(1);
	}

	const currentConfigResult = await getModelConfiguration({ projectRoot });
	const currentModels = currentConfigResult.success


		? currentConfigResult.data.activeModels
		: { main: null, research: null, search: null };
	// Handle potential config load failure gracefully for the setup flow
	if (
		!currentConfigResult.success &&
		currentConfigResult.error?.code !== 'CONFIG_MISSING'
	) {
		console.warn(
			chalk.yellow(
				`Warning: Could not load current model configuration: ${currentConfigResult.error?.message || 'Unknown'}. Proceeding with defaults.`
			)
		);
	}

	// Helper function to fetch OpenRouter models (duplicated for CLI context)

	// Helper to get choices and default index for a role
	const getPromptData = (role, allowNone = false) => {
		const currentModel = currentModels[role]; // Use the fetched data
		const allModelsRaw = getAvailableModels(); // Get all available models

		// Manually group models by provider
		const modelsByProvider = allModelsRaw.reduce((acc, model) => {
			if (!acc[model.provider]) {
				acc[model.provider] = [];
			}
			acc[model.provider].push(model);
			return acc;
		}, {});

		const cancelOption = { name: '⏹ Cancel Model Setup', value: '__CANCEL__' }; // Symbol updated
		const noChangeOption = currentModel?.modelId
			? {
					name: `✔ No change to current ${role} model (${currentModel.modelId})`, // Symbol updated
					value: '__NO_CHANGE__'
				}
			: null;


		let choices = [];
		let defaultIndex = 0; // Default to 'Cancel'

		// Filter and format models allowed for this role using the manually grouped data
		const roleChoices = Object.entries(modelsByProvider)
			.map(([provider, models]) => {
				const providerModels = models
					.filter((m) => m.allowed_roles.includes(role))
					.map((m) => ({
						name: `${provider} / ${m.id} ${
							m.cost_per_1m_tokens
								? chalk.gray(
										`($${m.cost_per_1m_tokens.input.toFixed(2)} input | $${m.cost_per_1m_tokens.output.toFixed(2)} output)`
									)
								: ''
						}`,
						value: { id: m.id, provider },
						short: `${provider}/${m.id}`
					}));
				if (providerModels.length > 0) {
					return [...providerModels];
				}
				return null;
			})
			.filter(Boolean)
			.flat();

		// Find the index of the currently selected model for setting the default
		let currentChoiceIndex = -1;
		if (currentModel?.modelId && currentModel?.provider) {
			currentChoiceIndex = roleChoices.findIndex(
				(choice) =>
					typeof choice.value === 'object' &&
					choice.value.id === currentModel.modelId &&
					choice.value.provider === currentModel.provider
			);
		}

		// Construct final choices list based on whether 'None' is allowed
		const commonPrefix = [];
		if (noChangeOption) {
			commonPrefix.push(noChangeOption);
		}
		commonPrefix.push(cancelOption);

		let prefixLength = commonPrefix.length; // Initial prefix length

		if (allowNone) {
			choices = [
				...commonPrefix,
				new inquirer.Separator(),
				{ name: '⚪ None (disable)', value: null }, // Symbol updated
				new inquirer.Separator(),
				...roleChoices
			];
			// Adjust default index: Prefix + Sep1 + None + Sep2 (+3)
			const noneOptionIndex = prefixLength + 1;
			defaultIndex =
				currentChoiceIndex !== -1
					? currentChoiceIndex + prefixLength + 3 // Offset by prefix and separators
					: noneOptionIndex; // Default to 'None' if no current model matched
		} else {
			choices = [
				...commonPrefix,
				new inquirer.Separator(),
				...roleChoices,
				new inquirer.Separator()
			];
			// Adjust default index: Prefix + Sep (+1)
			defaultIndex =
				currentChoiceIndex !== -1
					? currentChoiceIndex + prefixLength + 1 // Offset by prefix and separator
					: noChangeOption
						? 1
						: 0; // Default to 'No Change' if present, else 'Cancel'
		}

		// Ensure defaultIndex is valid within the final choices array length
		if (defaultIndex < 0 || defaultIndex >= choices.length) {
			// If default calculation failed or pointed outside bounds, reset intelligently
			defaultIndex = 0; // Default to 'Cancel'
			console.warn(
				`Warning: Could not determine default model for role '${role}'. Defaulting to 'Cancel'.`
			); // Add warning
		}

		return { choices, default: defaultIndex };
	};

	// --- Generate choices using the helper ---


	const mainPromptData = getPromptData('main');
	const researchPromptData = getPromptData('research', true); // Allow 'None' for research model
	const searchPromptData = getPromptData('search', true); // Allow 'None' for search model

	const answers = await inquirer.prompt([
		{
			type: 'list',
			name: 'mainModel',
			message: 'Select the main model for generation/updates:',
			choices: mainPromptData.choices,
			default: mainPromptData.default
		},
		{
			type: 'list',
			name: 'researchModel',
			message: 'Select the research model:',
			choices: researchPromptData.choices,
			default: researchPromptData.default,
			when: (ans) => ans.mainModel !== '__CANCEL__'
		},
		{
			type: 'list',
			name: 'searchModel',
			message: 'Select the search model (for research-backed subtask generation and task updates):',
			choices: searchPromptData.choices,
			default: searchPromptData.default,
			when: (ans) => ans.mainModel !== '__CANCEL__'
		},
	]);
	let setupSuccess = true;
	let setupConfigModified = false;
	const coreOptionsSetup = { projectRoot }; // Pass root for setup actions

	// Helper to handle setting a model (including custom)
	async function handleSetModel(role, selectedValue, currentModelId) {
		if (selectedValue === '__CANCEL__') {
			console.log(
				chalk.yellow(`\nSetup canceled during ${role} model selection.`)
			);
			setupSuccess = false; // Also mark success as false on cancel
			return false; // Indicate cancellation
		}

		// Handle the new 'No Change' option
		if (selectedValue === '__NO_CHANGE__') {
			console.log(chalk.gray(`No change selected for ${role} model.`));
			return true; // Indicate success, continue setup
		}

		let modelIdToSet = null;
		let providerHint = null;
		let isCustomSelection = false;

		if (
			selectedValue &&
			typeof selectedValue === 'object' &&
			selectedValue.id
		) {
			// Standard model selected from list
			modelIdToSet = selectedValue.id;
			providerHint = selectedValue.provider; // Provider is known
		} else if (selectedValue) {
			console.error(
				chalk.red(
					`Internal Error: Unexpected selection value for ${role}: ${JSON.stringify(selectedValue)}`
				)
			);
			setupSuccess = false;
			return true;
		}

		// Only proceed if there's a change to be made
		if (modelIdToSet !== currentModelId) {
			if (modelIdToSet) {
				// Set a specific model (standard or custom)
				const result = await setModel(role, modelIdToSet, {
					...coreOptionsSetup,
					providerHint // Pass the hint
				});
				if (result.success) {
					console.log(
						chalk.blue(
							`Set ${role} model: ${result.data.provider} / ${result.data.modelId}`
						)
					);
					if (result.data.warning) {
						// Display warning if returned by setModel
						console.log(chalk.yellow(result.data.warning));
					}
					setupConfigModified = true;
				} else {
					console.error(
						chalk.red(
							`Error setting ${role} model: ${result.error?.message || 'Unknown'}`
						)
					);
					setupSuccess = false;
				}
			}
		}
		return true; // Indicate setup should continue
	}

	// Process answers using the handler
	if (
		!(await handleSetModel(
			'main',
			answers.mainModel,
			currentModels.main?.modelId // <--- Now 'currentModels' is defined
		))
	) {
		return false; // Explicitly return false if cancelled
	}
	if (
		!(await handleSetModel(
			'research',
			answers.researchModel,
			currentModels.research?.modelId // <--- Now 'currentModels' is defined
		))
	) {
		return false; // Explicitly return false if cancelled
	}
	if (
		!(await handleSetModel(
			'search',
			answers.searchModel,
			currentModels.search?.modelId
		))
	) {
		return false; // Explicitly return false if cancelled
	}


	if (setupSuccess && setupConfigModified) {
		console.log(chalk.green.bold('\nModel setup complete!'));
	} else if (setupSuccess && !setupConfigModified) {
		console.log(chalk.yellow('\nNo changes made to model configuration.'));
	} else if (!setupSuccess) {
		console.error(
			chalk.red(
				'\nErrors occurred during model selection. Please review and try again.'
			)
		);
	}
	return true; // Indicate setup flow completed (not cancelled)
	// Let the main command flow continue to display results
}

/**
 * Configure and register CLI commands
 * @param {Object} program - Commander program instance
 */
function registerCommands(programInstance) {
	// Add global error handler for unknown options
	programInstance.on('option:unknown', function (unknownOption) {
		const commandName = this._name || 'unknown';
		console.error(chalk.red(`Error: Unknown option '${unknownOption}'`));
		console.error(
			chalk.yellow(
				`Run 'task-master ${commandName} --help' to see available options`
			)
		);
		process.exit(1);
	});

	// parse-prd command
	programInstance
		.command('parse-prd')
		.description('Parse a PRD file and generate tasks')
		.argument('[file]', 'Path to the PRD file')
		.option(
			'-i, --input <file>',
			'Path to the PRD file (alternative to positional argument)'
		)
		.option('-o, --output <file>', 'Output file path', 'tasks/tasks.json')
		.option('-n, --num-tasks <number>', 'Number of tasks to generate', '10')
		.option('-f, --force', 'Skip confirmation when overwriting existing tasks')
		.option(
			'--append',
			'Append new tasks to existing tasks.json instead of overwriting'
		)
		.action(async (file, options) => {
			// Use input option if file argument not provided
			const inputFile = file || options.input;
			const defaultPrdPath = 'scripts/prd.txt';
			const numTasks = parseInt(options.numTasks, 10);
			const outputPath = options.output;
			const force = options.force || false;
			const append = options.append || false;
			let useForce = force;
			let useAppend = append;

			// Helper function to check if tasks.json exists and confirm overwrite
			async function confirmOverwriteIfNeeded() {
				if (fs.existsSync(outputPath) && !useForce && !useAppend) {
					const overwrite = await confirmTaskOverwrite(outputPath);
					if (!overwrite) {
						log('info', 'Operation cancelled.');
						return false;
					}
					// If user confirms 'y', we should set useForce = true for the parsePRD call
					// Only overwrite if not appending
					useForce = true;
				}
				return true;
			}

			let spinner;

			try {
				if (!inputFile) {
					if (fs.existsSync(defaultPrdPath)) {
						console.log(
							chalk.blue(`Using default PRD file path: ${defaultPrdPath}`)
						);
						if (!(await confirmOverwriteIfNeeded())) return;

						console.log(chalk.blue(`Generating ${numTasks} tasks...`));
						spinner = ora('Parsing PRD and generating tasks...\n').start();
						await parsePRD(defaultPrdPath, outputPath, numTasks, {
							append: useAppend, // Changed key from useAppend to append
							force: useForce // Changed key from useForce to force
						});
						spinner.succeed('Tasks generated successfully!');
						return;
					}

					console.log(
						chalk.yellow(
							'No PRD file specified and default PRD file not found at scripts/prd.txt.'
						)
					);
					console.log(
						boxen(
							chalk.white.bold('Parse PRD Help') +
								'\n\n' +
								chalk.cyan('Usage:') +
								'\n' +
								`  task-master parse-prd <prd-file.txt> [options]\n\n` +
								chalk.cyan('Options:') +
								'\n' +
								'  -i, --input <file>       Path to the PRD file (alternative to positional argument)\n' +
								'  -o, --output <file>      Output file path (default: "tasks/tasks.json")\n' +
								'  -n, --num-tasks <number> Number of tasks to generate (default: 10)\n' +
								'  -f, --force              Skip confirmation when overwriting existing tasks\n' +
								'  --append                 Append new tasks to existing tasks.json instead of overwriting\n\n' +
								chalk.cyan('Example:') +
								'\n' +
								'  task-master parse-prd requirements.txt --num-tasks 15\n' +
								'  task-master parse-prd --input=requirements.txt\n' +
								'  task-master parse-prd --force\n' +
								'  task-master parse-prd requirements_v2.txt --append\n\n' +
								chalk.yellow('Note: This command will:') +
								'\n' +
								'  1. Look for a PRD file at scripts/prd.txt by default\n' +
								'  2. Use the file specified by --input or positional argument if provided\n' +
								'  3. Generate tasks from the PRD and either:\n' +
								'     - Overwrite any existing tasks.json file (default)\n' +
								'     - Append to existing tasks.json if --append is used',
							{ padding: 1, borderColor: 'blue', borderStyle: 'round' }
						)
					);
					return;
				}

				if (!fs.existsSync(inputFile)) {
					console.error(
						chalk.red(`Error: Input PRD file not found: ${inputFile}`)
					);
					process.exit(1);
				}

				if (!(await confirmOverwriteIfNeeded())) return;

				console.log(chalk.blue(`Parsing PRD file: ${inputFile}`));
				console.log(chalk.blue(`Generating ${numTasks} tasks...`));
				if (append) {
					console.log(chalk.blue('Appending to existing tasks...'));
				}

				spinner = ora('Parsing PRD and generating tasks...\n').start();
				await parsePRD(inputFile, outputPath, numTasks, {
					useAppend: useAppend,
					useForce: useForce
				});
				spinner.succeed('Tasks generated successfully!');
			} catch (error) {
				if (spinner) {
					spinner.fail(`Error parsing PRD: ${error.message}`);
				} else {
					console.error(chalk.red(`Error parsing PRD: ${error.message}`));
				}
				process.exit(1);
			}
		});

	// update command
	programInstance
		.command('update')
		.description(
			'Update multiple tasks with ID >= "from" based on new information or implementation changes'
		)
		.option('-f, --file <file>', 'Path to the tasks file', 'tasks/tasks.json')
		.option(
			'--from <id>',
			'Task ID to start updating from (tasks with ID >= this value will be updated)',
			'1'
		)
		.option(
			'-p, --prompt <text>',
			'Prompt explaining the changes or new context (required)'
		)
		.option(
			'-r, --research',
			'Enable in-depth analysis for task updates'
		)
		.action(async (options) => {
			const tasksPath = options.file;
			const fromId = parseInt(options.from, 10); // Validation happens here
			const prompt = options.prompt;
			const useResearch = options.research || false;

			// Check if there's an 'id' option which is a common mistake (instead of 'from')
			if (
				process.argv.includes('--id') ||
				process.argv.some((arg) => arg.startsWith('--id='))
			) {
				console.error(
					chalk.red('Error: The update command uses --from=<id>, not --id=<id>')
				);
				console.log(chalk.yellow('\nTo update multiple tasks:'));
				console.log(
					`  task-master update --from=${fromId} --prompt="Your prompt here"`
				);
				console.log(
					chalk.yellow(
						'\nTo update a single specific task, use the update-task command instead:'
					)
				);
				console.log(
					`  task-master update-task --id=<id> --prompt="Your prompt here"`
				);
				process.exit(1);
			}

			if (!prompt) {
				console.error(
					chalk.red(
						'Error: --prompt parameter is required. Please provide information about the changes.'
					)
				);
				process.exit(1);
			}

			console.log(
				chalk.blue(
					`Updating tasks from ID >= ${fromId} with prompt: "${prompt}"`
				)
			);
			console.log(chalk.blue(`Tasks file: ${tasksPath}`));

			if (useResearch) {
				console.log(
					chalk.blue('Using in-depth analysis for task updates')
				);
			}

			// Call core updateTasks, passing empty context for CLI
			await updateTasks(
				tasksPath,
				fromId,
				prompt,
				useResearch,
				{} // Pass empty context
			);
		});

	// update-task command
	programInstance
		.command('update-task')
		.description(
			'Update a single specific task by ID with new information (use --id parameter)'
		)
		.option('-f, --file <file>', 'Path to the tasks file', 'tasks/tasks.json')
		.option('-i, --id <id>', 'Task ID to update (required)')
		.option(
			'-p, --prompt <text>',
			'Prompt explaining the changes or new context (required)'
		)
		.option(
			'-r, --research',
			'Enable in-depth analysis for task updates'
		)
		.action(async (options) => {
			try {
				const tasksPath = options.file;

				// Validate required parameters
				if (!options.id) {
					console.error(chalk.red('Error: --id parameter is required'));
					console.log(
						chalk.yellow(
							'Usage example: task-master update-task --id=23 --prompt="Update with new information"'
						)
					);
					process.exit(1);
				}

				// Parse the task ID and validate it's a number
				const taskId = parseInt(options.id, 10);
				if (isNaN(taskId) || taskId <= 0) {
					console.error(
						chalk.red(
							`Error: Invalid task ID: ${options.id}. Task ID must be a positive integer.`
						)
					);
					console.log(
						chalk.yellow(
							'Usage example: task-master update-task --id=23 --prompt="Update with new information"'
						)
					);
					process.exit(1);
				}

				if (!options.prompt) {
					console.error(
						chalk.red(
							'Error: --prompt parameter is required. Please provide information about the changes.'
						)
					);
					console.log(
						chalk.yellow(
							'Usage example: task-master update-task --id=23 --prompt="Update with new information"'
						)
					);
					process.exit(1);
				}

				const prompt = options.prompt;
				const useResearch = options.research || false;

				// Validate tasks file exists
				if (!fs.existsSync(tasksPath)) {
					console.error(
						chalk.red(`Error: Tasks file not found at path: ${tasksPath}`)
					);
					if (tasksPath === 'tasks/tasks.json') {
						console.log(
							chalk.yellow(
								'Please ensure you have run `task-master parse-prd` to generate your tasks file.'
							)
						);
					}
					process.exit(1);
				}

				// Check if the task exists
				const task = findTaskById(taskId, tasksPath);
				if (!task) {
					console.error(
						chalk.red(`Error: Task with ID ${taskId} not found in ${tasksPath}`)
					);
					process.exit(1);
				}

				console.log(
					chalk.blue(
						`Updating task ${taskId} with prompt: "${prompt}"`
					)
				);
				console.log(chalk.blue(`Tasks file: ${tasksPath}`));

				if (useResearch) {
					console.log(
						chalk.blue('Using in-depth analysis for task updates')
					);
				}

				// Call core updateTaskById, passing empty context for CLI
				await updateTaskById(
					taskId,
					prompt,
					tasksPath,
					useResearch,
					{} // Pass empty context
				);
				console.log(chalk.green(`Task ${taskId} updated successfully!`));
			} catch (error) {
				console.error(
					chalk.red(`Error updating task: ${error.message}`)
				);
				process.exit(1);
			}
		});

	// update-subtask command
	programInstance
		.command('update-subtask')
		.description(
			'Append information to a specific subtask by ID (use --id parameter in parentId.subtaskId format)'
		)
		.option('-f, --file <file>', 'Path to the tasks file', 'tasks/tasks.json')
		.option(
			'-i, --id <id>',
			'Subtask ID to update (e.g., "5.2") (required)'
		)
		.option(
			'-p, --prompt <text>',
			'Information to add to the subtask (required)'
		)
		.option(
			'-r, --research',
			'Enable in-depth analysis for subtask updates'
		)
		.action(async (options) => {
			try {
				const tasksPath = options.file;

				// Validate required parameters
				if (!options.id) {
					console.error(chalk.red('Error: --id parameter is required.'));
					console.log(
						boxen(
							chalk.white.bold('Add Subtask Help') +
								'\n\n' +
								chalk.cyan('Usage (New Subtask):') +
								'\n' +
								'  task-master add-subtask --id=<parentId> --title="New Subtask Title" --description="Details..."\n\n' +
								chalk.cyan('Usage (Convert Existing Task):') +
								'\n' +
								'  task-master add-subtask --id=<parentId> --task-id=<existingTaskId>\n\n' +
								chalk.cyan('Options:') +
								'\n' +
								'  -i, --id <id>                Parent task ID (required)\n' +
								'  --task-id <id>               Existing task ID to convert to subtask\n' +
								'  --title <text>               Title for the new subtask\n' +
								'  --description <text>         Description for the new subtask\n' +
								'  --details <text>             Implementation details for the new subtask\n' +
								'  --status <status>            Status for the new subtask (default: pending)\n' +
								'  --dependencies <ids>         Comma-separated dependency IDs for the new subtask\n' +
								'  --file <file>                Path to the tasks file (default: tasks/tasks.json)\n' +
								'  --skip-generate              Skip regenerating task files after adding subtask',
							{ padding: 1, borderColor: 'blue', borderStyle: 'round' }
						)
					);
					process.exit(1);
				}

				const idParts = options.id.split('.');
				if (idParts.length !== 2) {
					console.error(
						chalk.red(
							`Error: Invalid subtask ID format: ${options.id}. Expected format "parentId.subtaskId" (e.g., "5.2").`
						)
					);
					process.exit(1);
				}

				const parentId = parseInt(idParts[0], 10);
				const subtaskId = parseInt(idParts[1], 10);

				if (isNaN(parentId) || parentId <= 0 || isNaN(subtaskId) || subtaskId <= 0) {
					console.error(
						chalk.red(
							`Error: Invalid parent or subtask ID: ${options.id}. Both must be positive integers.`
						)
					);
					process.exit(1);
				}

				if (!options.prompt) {
					console.error(
						chalk.red(
							'Error: --prompt parameter is required. Please provide information to add to the subtask.'
						)
					);
					console.exit(1);
				}

				const prompt = options.prompt;
				const useResearch = options.research || false;

				// Validate tasks file exists
				if (!fs.existsSync(tasksPath)) {
					console.error(
						chalk.red(`Error: Tasks file not found at path: ${tasksPath}`)
					);
					if (tasksPath === 'tasks/tasks.json') {
						console.log(
							chalk.yellow(
								'Please ensure you have run `task-master parse-prd` to generate your tasks file.'
							)
						);
					}
					process.exit(1);
				}

				// Check if the parent task exists
				const parentTask = findTaskById(parentId, tasksPath);
				if (!parentTask) {
					console.error(
						chalk.red(`Error: Parent task with ID ${parentId} not found.`)
					);
					process.exit(1);
				}

				// Check if the subtask exists within the parent
				const subtask = parentTask.subtasks?.find(st => st.id === subtaskId);
				if (!subtask) {
					console.error(
						chalk.red(`Error: Subtask with ID ${subtaskId} not found in task ${parentId}.`)
					);
					process.exit(1);
				}

				console.log(
					chalk.blue(
						`Updating subtask ${options.id} with prompt: "${prompt}"`
					)
				);
				console.log(chalk.blue(`Tasks file: ${tasksPath}`));

				if (useResearch) {
					console.log(
						chalk.blue('Using in-depth analysis for subtask updates')
					);
				}

				// Call core updateSubtaskById, passing empty context for CLI
				await updateSubtaskById(
					options.id,
					prompt,
					tasksPath,
					useResearch,
					{} // Pass empty context
				);
				console.log(chalk.green(`Subtask ${options.id} updated successfully!`));
			} catch (error) {
				console.error(
					chalk.red(`Error updating subtask: ${error.message}`)
				);
				process.exit(1);
			}
		});

	// generate command
	programInstance
		.command('generate')
		.description('Generate individual task files from tasks.json')
		.option('-f, --file <file>', 'Path to the tasks file', 'tasks/tasks.json')
		.option(
			'-o, --output <directory>',
			'Output directory for generated task files (default: same directory as tasks file)'
		)
		.action(async (options) => {
			const tasksPath = options.file;
			const outputDir = options.output || path.dirname(tasksPath);

			if (!fs.existsSync(tasksPath)) {
				console.error(
					chalk.red(`Error: Tasks file not found at path: ${tasksPath}`)
				);
				if (tasksPath === 'tasks/tasks.json') {
					console.log(
						chalk.yellow(
							'Please ensure you have run `task-master parse-prd` to generate your tasks file.'
						)
					);
				}
				process.exit(1);
			}

			console.log(chalk.blue(`Generating task files from: ${tasksPath}`));
			console.log(chalk.blue(`Output directory: ${outputDir}`));

			let spinner = ora('Generating task files...\n').start();
			try {
				await generateTaskFiles(tasksPath, outputDir);
				spinner.succeed('Task files generated successfully!');
			} catch (error) {
				spinner.fail(`Error generating task files: ${error.message}`);
				process.exit(1);
			}
		});

	// list command
	programInstance
		.command('list')
		.description('List all tasks')
		.option('-s, --status <status>', 'Filter tasks by status')
		.option('-w, --with-subtasks', 'Include subtasks in the list', false)
		.option('-f, --file <file>', 'Path to the tasks file', 'tasks/tasks.json')
		.action(async (options) => {
			const tasksPath = options.file;
			const statusFilter = options.status;
			const withSubtasks = options.withSubtasks;

			if (statusFilter && !isValidTaskStatus(statusFilter)) {
				console.error(
					chalk.red(
						`Error: Invalid status filter "${statusFilter}". Valid statuses are: ${TASK_STATUS_OPTIONS.join(', ')}`
					)
				);
				process.exit(1);
			}

			if (!fs.existsSync(tasksPath)) {
				console.error(
					chalk.red(`Error: Tasks file not found at path: ${tasksPath}`)
				);
				if (tasksPath === 'tasks/tasks.json') {
					console.log(
						chalk.yellow(
							'Please ensure you have run `task-master parse-prd` to generate your tasks file.'
						)
					);
				}
				process.exit(1);
			}

			try {
				const tasks = listTasks(tasksPath, statusFilter, withSubtasks);
				if (tasks.length === 0) {
					console.log(chalk.yellow('No tasks found.'));
				}
			} catch (error) {
				console.error(
					chalk.red(`Error listing tasks: ${error.message}`)
				);
				process.exit(1);
			}
		});

	// next command
	programInstance
		.command('next')
		.description('Show the next task to work on based on dependencies and status')
		.option('-f, --file <file>', 'Path to the tasks file', 'tasks/tasks.json')
		.action(async (options) => {
			const tasksPath = options.file;

			if (!fs.existsSync(tasksPath)) {
				console.error(
					chalk.red(`Error: Tasks file not found at path: ${tasksPath}`)
				);
				if (tasksPath === 'tasks/tasks.json') {
					console.log(
						chalk.yellow(
							'Please ensure you have run `task-master parse-prd` to generate your tasks file.'
						)
					);
				}
				process.exit(1);
			}

			try {
				await displayNextTask(tasksPath);
			} catch (error) {
				console.error(
					chalk.red(`Error determining next task: ${error.message}`)
				);
				process.exit(1);
			}
		});

	// show command
	programInstance
		.command('show')
		.description('Show details of a specific task or subtask')
		.argument('[id]', 'ID of the task or subtask (e.g., "5" or "5.2")')
		.option('-i, --id <id>', 'ID of the task or subtask (alternative to argument)')
		.option('-f, --file <file>', 'Path to the tasks file', 'tasks/tasks.json')
		.action(async (idArg, options) => {
			const tasksPath = options.file;
			const taskId = idArg || options.id;

			if (!taskId) {
				console.error(chalk.red('Error: Task ID is required.'));
				console.log(
					chalk.yellow(
						'Usage examples: task-master show 5 or task-master show --id=5.2'
					)
				);
				process.exit(1);
			}

			if (!fs.existsSync(tasksPath)) {
				console.error(
					chalk.red(`Error: Tasks file not found at path: ${tasksPath}`)
				);
				if (tasksPath === 'tasks/tasks.json') {
					console.log(
						chalk.yellow(
							'Please ensure you have run `task-master parse-prd` to generate your tasks file.'
						)
					);
				}
				process.exit(1);
			}

			try {
				displayTaskById(taskId, tasksPath);
			} catch (error) {
				console.error(
					chalk.red(`Error displaying task: ${error.message}`)
				);
				process.exit(1);
			}
		});

	// set-status command
	programInstance
		.command('set-status')
		.description('Set the status of one or more tasks or subtasks')
		.option('-i, --id <id>', 'Comma-separated list of task/subtask IDs (e.g., "1,2,3" or "1.1,1.2") (required)')
		.option('-s, --status <status>', `New status to set (${TASK_STATUS_OPTIONS.join(', ')}) (required)`)
		.option('-f, --file <file>', 'Path to the tasks file', 'tasks/tasks.json')
		.action(async (options) => {
			const tasksPath = options.file;
			const ids = options.id;
			const status = options.status;

			if (!ids) {
				console.error(chalk.red('Error: --id parameter is required.'));
				process.exit(1);
			}
			if (!status) {
				console.error(chalk.red('Error: --status parameter is required.'));
				process.exit(1);
			}
			if (!isValidTaskStatus(status)) {
				console.error(
					chalk.red(
						`Error: Invalid status "${status}". Valid statuses are: ${TASK_STATUS_OPTIONS.join(', ')}`
					)
				);
				process.exit(1);
			}

			if (!fs.existsSync(tasksPath)) {
				console.error(
					chalk.red(`Error: Tasks file not found at path: ${tasksPath}`)
				);
				if (tasksPath === 'tasks/tasks.json') {
					console.log(
						chalk.yellow(
							'Please ensure you have run `task-master parse-prd` to generate your tasks file.'
						)
					);
				}
				process.exit(1);
			}

			try {
				const idList = ids.split(',').map(id => id.trim());
				await setTaskStatus(idList, status, tasksPath);
				console.log(chalk.green(`Status updated for IDs: ${ids}`));
			} catch (error) {
				console.error(
					chalk.red(`Error setting task status: ${error.message}`)
				);
				process.exit(1);
			}
		});

	// expand command
	programInstance
		.command('expand')
		.description('Expand a task into subtasks for detailed implementation')
		.option('-i, --id <id>', 'ID of task to expand')
		.option('-n, --num <number>', 'Number of subtasks to generate')
		.option('-p, --prompt <text>', 'Additional context for subtask generation')
		.option('-a, --all', 'Expand all pending tasks')
		.option('-f, --force', 'Force expansion even if subtasks exist')
		.option('-r, --research', 'Enable in-depth analysis for subtask generation')
		.option('--file <file>', 'Path to the tasks file', 'tasks/tasks.json')
		.action(async (options) => {
			const tasksPath = options.file;
			const taskId = options.id;
			const numSubtasks = options.num ? parseInt(options.num, 10) : undefined;
			const prompt = options.prompt;
			const expandAll = options.all || false;
			const force = options.force || false;
			const useResearch = options.research || false;

			if (!fs.existsSync(tasksPath)) {
				console.error(
					chalk.red(`Error: Tasks file not found at path: ${tasksPath}`)
				);
				if (tasksPath === 'tasks/tasks.json') {
					console.log(
						chalk.yellow(
							'Please ensure you have run `task-master parse-prd` to generate your tasks file.'
						)
					);
				}
				process.exit(1);
			}

			if (expandAll && taskId) {
				console.error(
					chalk.red('Error: Cannot use --all and --id together.')
				);
				process.exit(1);
			}

			if (!expandAll && !taskId) {
				console.error(
					chalk.red('Error: Either --id or --all must be provided.')
				);
				console.log(
					chalk.yellow(
						'Usage examples: task-master expand --id=5 or task-master expand --all'
					)
				);
				process.exit(1);
			}

			let spinner = ora('Expanding tasks...\n').start();
			try {
				if (expandAll) {
					await expandAllTasks(tasksPath, numSubtasks, prompt, useResearch, force);
					spinner.succeed('All pending tasks expanded successfully!');
				} else {
					await expandTask(taskId, tasksPath, numSubtasks, prompt, useResearch, force);
					spinner.succeed(`Task ${taskId} expanded successfully!`);
				}
			} catch (error) {
				spinner.fail(`Error expanding tasks: ${error.message}`);
				process.exit(1);
			}
		});

	// clear-subtasks command
	programInstance
		.command('clear-subtasks')
		.description('Clear subtasks from specified tasks')
		.option('-i, --id <id>', 'Comma-separated list of task IDs (e.g., "1,2,3")')
		.option('-a, --all', 'Clear subtasks from all tasks')
		.option('-f, --file <file>', 'Path to the tasks file', 'tasks/tasks.json')
		.action(async (options) => {
			const tasksPath = options.file;
			const ids = options.id;
			const clearAll = options.all || false;

			if (!fs.existsSync(tasksPath)) {
				console.error(
					chalk.red(`Error: Tasks file not found at path: ${tasksPath}`)
				);
				if (tasksPath === 'tasks/tasks.json') {
					console.log(
						chalk.yellow(
							'Please ensure you have run `task-master parse-prd` to generate your tasks file.'
						)
					);
				}
				process.exit(1);
			}

			if (clearAll && ids) {
				console.error(
					chalk.red('Error: Cannot use --all and --id together.')
				);
				process.exit(1);
			}

			if (!clearAll && !ids) {
				console.error(
					chalk.red('Error: Either --id or --all must be provided.')
				);
				console.log(
					chalk.yellow(
						'Usage examples: task-master clear-subtasks --id=5 or task-master clear-subtasks --all'
					)
				);
				process.exit(1);
			}

			try {
				const idList = ids ? ids.split(',').map(id => parseInt(id.trim(), 10)) : [];
				await clearSubtasks(idList, clearAll, tasksPath);
				console.log(chalk.green('Subtasks cleared successfully!'));
			} catch (error) {
				console.error(
					chalk.red(`Error clearing subtasks: ${error.message}`)
				);
				process.exit(1);
			}
		});

	// add-dependency command
	programInstance
		.command('add-dependency')
		.description('Add a dependency relationship between two tasks')
		.option('-i, --id <id>', 'ID of task that will depend on another task (required)')
		.option('-d, --depends-on <id>', 'ID of task that will become a dependency (required)')
		.option('-f, --file <file>', 'Path to the tasks file', 'tasks/tasks.json')
		.action(async (options) => {
			const tasksPath = options.file;
			const taskId = parseInt(options.id, 10);
			const dependsOnId = parseInt(options.dependsOn, 10);

			if (isNaN(taskId) || taskId <= 0) {
				console.error(chalk.red('Error: Invalid --id. Must be a positive integer.'));
				process.exit(1);
			}
			if (isNaN(dependsOnId) || dependsOnId <= 0) {
				console.error(chalk.red('Error: Invalid --depends-on. Must be a positive integer.'));
				process.exit(1);
			}
			if (taskId === dependsOnId) {
				console.error(chalk.red('Error: A task cannot depend on itself.'));
				process.exit(1);
			}

			if (!fs.existsSync(tasksPath)) {
				console.error(
					chalk.red(`Error: Tasks file not found at path: ${tasksPath}`)
				);
				if (tasksPath === 'tasks/tasks.json') {
					console.log(
						chalk.yellow(
							'Please ensure you have run `task-master parse-prd` to generate your tasks file.'
						)
					);
				}
				process.exit(1);
			}

			try {
				await addDependency(taskId, dependsOnId, tasksPath);
				console.log(chalk.green(`Task ${taskId} now depends on Task ${dependsOnId}.`));
			} catch (error) {
				console.error(
					chalk.red(`Error adding dependency: ${error.message}`)
				);
				process.exit(1);
			}
		});

	// remove-dependency command
	programInstance
		.command('remove-dependency')
		.description('Remove a dependency from a task')
		.option('-i, --id <id>', 'Task ID to remove dependency from (required)')
		.option('-d, --depends-on <id>', 'Task ID to remove as a dependency (required)')
		.option('-f, --file <file>', 'Path to the tasks file', 'tasks/tasks.json')
		.action(async (options) => {
			const tasksPath = options.file;
			const taskId = parseInt(options.id, 10);
			const dependsOnId = parseInt(options.dependsOn, 10);

			if (isNaN(taskId) || taskId <= 0) {
				console.error(chalk.red('Error: Invalid --id. Must be a positive integer.'));
				process.exit(1);
			}
			if (isNaN(dependsOnId) || dependsOnId <= 0) {
				console.error(chalk.red('Error: Invalid --depends-on. Must be a positive integer.'));
				process.exit(1);
			}

			if (!fs.existsSync(tasksPath)) {
				console.error(
					chalk.red(`Error: Tasks file not found at path: ${tasksPath}`)
				);
				if (tasksPath === 'tasks/tasks.json') {
					console.log(
						chalk.yellow(
							'Please ensure you have run `task-master parse-prd` to generate your tasks file.'
						)
					);
				}
				process.exit(1);
			}

			try {
				await removeDependency(taskId, dependsOnId, tasksPath);
				console.log(chalk.green(`Dependency ${dependsOnId} removed from Task ${taskId}.`));
			} catch (error) {
				console.error(
					chalk.red(`Error removing dependency: ${error.message}`)
				);
				process.exit(1);
			}
		});

	// validate-dependencies command
	programInstance
		.command('validate-dependencies')
		.description('Check tasks for dependency issues (like circular references or links to non-existent tasks)')
		.option('-f, --file <file>', 'Path to the tasks file', 'tasks/tasks.json')
		.action(async (options) => {
			const tasksPath = options.file;

			if (!fs.existsSync(tasksPath)) {
				console.error(
					chalk.red(`Error: Tasks file not found at path: ${tasksPath}`)
				);
				if (tasksPath === 'tasks/tasks.json') {
					console.log(
						chalk.yellow(
							'Please ensure you have run `task-master parse-prd` to generate your tasks file.'
						)
					);
				}
				process.exit(1);
			}

			try {
				const result = validateDependenciesCommand(tasksPath);
				if (result.isValid) {
					console.log(chalk.green('All dependencies are valid.'));
				} else {
					console.error(chalk.red('Dependency validation failed:'));
					result.errors.forEach(error => console.error(chalk.red(`- ${error}`)));
					process.exit(1);
				}
			} catch (error) {
				console.error(
					chalk.red(`Error validating dependencies: ${error.message}`)
				);
				process.exit(1);
			}
		});

	// fix-dependencies command
	programInstance
		.command('fix-dependencies')
		.description('Find and fix invalid dependencies in tasks automatically')
		.option('-f, --file <file>', 'Path to the tasks file', 'tasks/tasks.json')
		.action(async (options) => {
			const tasksPath = options.file;

			if (!fs.existsSync(tasksPath)) {
				console.error(
					chalk.red(`Error: Tasks file not found at path: ${tasksPath}`)
				);
				if (tasksPath === 'tasks/tasks.json') {
					console.log(
						chalk.yellow(
							'Please ensure you have run `task-master parse-prd` to generate your tasks file.'
						)
					);
				}
				process.exit(1);
			}

			try {
				const result = fixDependenciesCommand(tasksPath);
				if (result.fixedCount > 0) {
					console.log(chalk.green(`Fixed ${result.fixedCount} invalid dependencies.`));
					result.details.forEach(detail => console.log(chalk.yellow(`- ${detail}`)));
				} else {
					console.log(chalk.blue('No invalid dependencies found to fix.'));
				}
			} catch (error) {
				console.error(
					chalk.red(`Error fixing dependencies: ${error.message}`)
				);
				process.exit(1);
			}
		});

	// add-task command
	programInstance
		.command('add-task')
		.description('Add a new task using AI or manually')
		.option('-p, --prompt <text>', 'Description of the task to add (required if not using manual fields)')
		.option('--title <text>', 'Task title (for manual task creation)')
		.option('--description <text>', 'Task description (for manual task creation)')
		.option('--details <text>', 'Implementation details (for manual task creation)')
		.option('--test-strategy <text>', 'Test strategy (for manual task creation)')
		.option('--dependencies <ids>', 'Comma-separated list of task IDs this task depends on')
		.option('--priority <level>', 'Task priority (high, medium, low)')
		.option('-r, --research', 'Enable in-depth analysis capabilities for task creation')
		.option('-f, --file <file>', 'Path to the tasks file', 'tasks/tasks.json')
		.action(async (options) => {
			const tasksPath = options.file;
			const prompt = options.prompt;
			const useResearch = options.research || false;

			const manualTaskData = {
				title: options.title,
				description: options.description,
				details: options.details,
				testStrategy: options.testStrategy,
				dependencies: options.dependencies ? options.dependencies.split(',').map(Number) : undefined,
				priority: options.priority
			};

			const isManualCreation = Object.values(manualTaskData).some(val => val !== undefined);

			if (!prompt && !isManualCreation) {
				console.error(chalk.red('Error: Either --prompt or manual task fields (--title, --description, etc.) are required.'));
				console.log(
					boxen(
						chalk.white.bold('Add Task Help') +
							'\n\n' +
							chalk.cyan('Usage (AI-driven):') +
							'\n' +
							'  task-master add-task --prompt="Implement user authentication"\n' +
							'  task-master add-task --prompt="Research best practices for X" --research\n\n' +
							chalk.cyan('Usage (Manual):') +
							'\n' +
							'  task-master add-task --title="New Feature" --description="Details..." --priority=high\n\n' +
							chalk.cyan('Options:') +
							'\n' +
							'  -p, --prompt <text>          Description for AI task generation\n' +
							'  --title <text>               Manual task title\n' +
							'  --description <text>         Manual task description\n' +
							'  --details <text>             Manual task implementation details\n' +
							'  --test-strategy <text>       Manual task test strategy\n' +
							'  --dependencies <ids>         Comma-separated task IDs this task depends on\n' +
							'  --priority <level>           Task priority (high, medium, low)\n' +
							'  -r, --research               Enable research for AI task generation\n' +
							'  -f, --file <file>            Path to the tasks file (default: tasks/tasks.json)',
						{ padding: 1, borderColor: 'blue', borderStyle: 'round' }
					)
				);
				process.exit(1);
			}

			if (!fs.existsSync(tasksPath)) {
				console.error(
					chalk.red(`Error: Tasks file not found at path: ${tasksPath}`)
				);
				if (tasksPath === 'tasks/tasks.json') {
					console.log(
						chalk.yellow(
							'Please ensure you have run `task-master parse-prd` to generate your tasks file.'
						)
					);
				}
				process.exit(1);
			}

			let spinner;
			try {
				spinner = ora('Adding task...\n').start();
				const newTask = await addTask(
					prompt,
					tasksPath,
					useResearch,
					manualTaskData
				);
				spinner.succeed(`Task ${newTask.id} added successfully!`);
				console.log(chalk.green(`Title: ${newTask.title}`));
				if (newTask.description) {
					console.log(chalk.green(`Description: ${newTask.description}`));
				}
			} catch (error) {
				if (spinner) {
					spinner.fail(`Error adding task: ${error.message}`);
				} else {
					console.error(chalk.red(`Error adding task: ${error.message}`));
				}
				process.exit(1);
			}
		});

	// add-subtask command
	programInstance
		.command('add-subtask')
		.description('Add a subtask to an existing task')
		.option('-i, --id <id>', 'Parent task ID (required)')
		.option('--task-id <id>', 'Existing task ID to convert to subtask')
		.option('--title <text>', 'Title for the new subtask')
		.option('--description <text>', 'Description for the new subtask')
		.option('--details <text>', 'Implementation details for the new subtask')
		.option('--status <status>', `Status for the new subtask (${TASK_STATUS_OPTIONS.join(', ')})`, 'pending')
		.option('--dependencies <ids>', 'Comma-separated list of dependency IDs for the new subtask')
		.option('--file <file>', 'Path to the tasks file', 'tasks/tasks.json')
		.option('--skip-generate', 'Skip regenerating task files after adding subtask', false)
		.action(async (options) => {
			const tasksPath = options.file;
			const parentId = parseInt(options.id, 10);
			const existingTaskIdToConvert = options.taskId ? parseInt(options.taskId, 10) : undefined;
			const skipGenerate = options.skipGenerate;

			if (isNaN(parentId) || parentId <= 0) {
				console.error(chalk.red('Error: Invalid parent task ID. Must be a positive integer.'));
				process.exit(1);
			}

			const isNewSubtask = !existingTaskIdToConvert;
			const hasManualFields = options.title || options.description || options.details || options.status || options.dependencies;

			if (isNewSubtask && !options.title) {
				console.error(chalk.red('Error: --title is required for new subtasks.'));
				console.log(
					boxen(
						chalk.white.bold('Add Subtask Help') +
							'\n\n' +
							chalk.cyan('Usage (New Subtask):') +
							'\n' +
							'  task-master add-subtask --id=<parentId> --title="New Subtask Title" --description="Details..."\n\n' +
							chalk.cyan('Usage (Convert Existing Task):') +
							'\n' +
							'  task-master add-subtask --id=<parentId> --task-id=<existingTaskId>\n\n' +
							chalk.cyan('Options:') +
							'\n' +
							'  -i, --id <id>                Parent task ID (required)\n' +
							'  --task-id <id>               Existing task ID to convert to subtask\n' +
							'  --title <text>               Title for the new subtask\n' +
							'  --description <text>         Description for the new subtask\n' +
							'  --details <text>             Implementation details for the new subtask\n' +
							'  --status <status>            Status for the new subtask (default: pending)\n' +
							'  --dependencies <ids>         Comma-separated dependency IDs for the new subtask\n' +
							'  --file <file>                Path to the tasks file (default: tasks/tasks.json)\n' +
							'  --skip-generate              Skip regenerating task files after adding subtask',
							{ padding: 1, borderColor: 'blue', borderStyle: 'round' }
						)
				);
				process.exit(1);
			}

			if (existingTaskIdToConvert && hasManualFields) {
				console.error(chalk.red('Error: Cannot use --task-id with manual subtask fields (--title, --description, etc.).'));
				process.exit(1);
			}

			if (!fs.existsSync(tasksPath)) {
				console.error(
					chalk.red(`Error: Tasks file not found at path: ${tasksPath}`)
				);
				if (tasksPath === 'tasks/tasks.json') {
					console.log(
						chalk.yellow(
							'Please ensure you have run `task-master parse-prd` to generate your tasks file.'
						)
					);
				}
				process.exit(1);
			}

			let spinner;
			try {
				spinner = ora('Adding subtask...\n').start();
				await addSubtask(
					parentId,
					existingTaskIdToConvert,
					{
						title: options.title,
						description: options.description,
						details: options.details,
						status: options.status,
						dependencies: options.dependencies ? options.dependencies.split(',').map(Number) : undefined
					},
					tasksPath,
					skipGenerate
				);
				spinner.succeed(`Subtask added successfully to task ${parentId}!`);
			} catch (error) {
				if (spinner) {
					spinner.fail(`Error adding subtask: ${error.message}`);
				} else {
					console.error(chalk.red(`Error adding subtask: ${error.message}`));
				}
				process.exit(1);
			}
		});

	// remove-task command
	programInstance
		.command('remove-task')
		.description('Remove a task permanently from the tasks list')
		.option('-i, --id <id>', 'Comma-separated list of task/subtask IDs to remove (e.g., "5" or "5.2") (required)')
		.option('-f, --file <file>', 'Path to the tasks file', 'tasks/tasks.json')
		.option('-y, --confirm', 'Skip confirmation prompt', false)
		.action(async (options) => {
			const tasksPath = options.file;
			const ids = options.id;
			const confirmRemoval = options.confirm;

			if (!ids) {
				console.error(chalk.red('Error: --id parameter is required.'));
				console.log(
					boxen(
						chalk.white.bold('Remove Task Help') +
							'\n\n' +
							chalk.cyan('Usage:') +
							'\n' +
							'  task-master remove-task --id=<id>\n' +
							'  task-master remove-task --id=5,6,7\n' +
							'  task-master remove-task --id=5.2\n\n' +
							chalk.cyan('Options:') +
							'\n' +
							'  -i, --id <id>                Comma-separated list of task/subtask IDs (required)\n' +
							'  -f, --file <file>            Path to the tasks file (default: tasks/tasks.json)\n' +
							'  -y, --confirm                Skip confirmation prompt\n\n' +
							chalk.yellow('Note: This command will permanently remove the task(s) and their subtasks.'),
							{ padding: 1, borderColor: 'blue', borderStyle: 'round' }
						)
				);
				process.exit(1);
			}

			if (!fs.existsSync(tasksPath)) {
				console.error(
					chalk.red(`Error: Tasks file not found at path: ${tasksPath}`)
				);
				if (tasksPath === 'tasks/tasks.json') {
					console.log(
						chalk.yellow(
							'Please ensure you have run `task-master parse-prd` to generate your tasks file.'
						)
					);
				}
				process.exit(1);
			}

			const idList = ids.split(',').map(id => id.trim());

			if (!confirmRemoval) {
				const { proceed } = await inquirer.prompt([
					{
						type: 'confirm',
						name: 'proceed',
						message: chalk.yellow(`Are you sure you want to permanently remove task(s)/subtask(s) with ID(s): ${ids}? This action cannot be undone.`),
						default: false
					}
				]);
				if (!proceed) {
					console.log(chalk.yellow('Operation cancelled.'));
					process.exit(0);
				}
			}

			let spinner;
			try {
				spinner = ora('Removing task(s)...\n').start();
				await removeTask(idList, tasksPath);
				spinner.succeed(`Task(s) with ID(s) ${ids} removed successfully!`);
			} catch (error) {
				if (spinner) {
					spinner.fail(`Error removing task(s): ${error.message}`);
				} else {
					console.error(chalk.red(`Error removing task(s): ${error.message}`));
				}
				process.exit(1);
			}
		});

	// remove-subtask command
	programInstance
		.command('remove-subtask')
		.description('Remove a subtask from its parent task')
		.option('-i, --id <id>', 'Subtask ID to remove in format "parentId.subtaskId" (required)')
		.option('-c, --convert', 'Convert the subtask to a standalone task instead of deleting it', false)
		.option('-f, --file <file>', 'Path to the tasks file', 'tasks/tasks.json')
		.option('--skip-generate', 'Skip regenerating task files after removing subtask', false)
		.action(async (options) => {
			const tasksPath = options.file;
			const subtaskId = options.id;
			const convert = options.convert;
			const skipGenerate = options.skipGenerate;

			if (!subtaskId) {
				console.error(chalk.red('Error: --id parameter (subtask ID) is required.'));
				console.log(
					boxen(
						chalk.white.bold('Remove Subtask Help') +
							'\n\n' +
							chalk.cyan('Usage:') +
							'\n' +
							'  task-master remove-subtask --id=5.2\n' +
							'  task-master remove-subtask --id=5.2 --convert\n\n' +
							chalk.cyan('Options:') +
							'\n' +
							'  -i, --id <id>                Subtask ID in "parentId.subtaskId" format (required)\n' +
							'  -c, --convert                Convert to standalone task instead of deleting\n' +
							'  -f, --file <file>            Path to the tasks file (default: tasks/tasks.json)\n' +
							'  --skip-generate              Skip regenerating task files after removal',
							{ padding: 1, borderColor: 'blue', borderStyle: 'round' }
						)
				);
				process.exit(1);
			}

			const idParts = subtaskId.split('.');
			if (idParts.length !== 2 || isNaN(parseInt(idParts[0], 10)) || isNaN(parseInt(idParts[1], 10))) {
				console.error(chalk.red(`Error: Invalid subtask ID format: ${subtaskId}. Expected "parentId.subtaskId".`));
				process.exit(1);
			}

			if (!fs.existsSync(tasksPath)) {
				console.error(
					chalk.red(`Error: Tasks file not found at path: ${tasksPath}`)
				);
				if (tasksPath === 'tasks/tasks.json') {
					console.log(
						chalk.yellow(
							'Please ensure you have run `task-master parse-prd` to generate your tasks file.'
						)
					);
				}
				process.exit(1);
			}

			let spinner;
			try {
				spinner = ora('Removing subtask...\n').start();
				await removeSubtask(subtaskId, convert, tasksPath, skipGenerate);
				spinner.succeed(`Subtask ${subtaskId} removed successfully!`);
				if (convert) {
					console.log(chalk.blue(`Subtask ${subtaskId} converted to a standalone task.`));
				}
			} catch (error) {
				if (spinner) {
					spinner.fail(`Error removing subtask: ${error.message}`);
				} else {
					console.error(chalk.red(`Error removing subtask: ${error.message}`));
				}
				process.exit(1);
			}
		});

	// analyze-complexity command
	programInstance
		.command('analyze-complexity')
		.description('Analyze task complexity and generate expansion recommendations')
		.option('-t, --threshold <number>', 'Complexity score threshold (1-10) to recommend expansion', '5')
		.option('-r, --research', 'Enable in-depth analysis for complexity analysis')
		.option('-o, --output <file>', 'Output file path for the report', 'scripts/task-complexity-report.json')
		.option('-f, --file <file>', 'Path to the tasks file', 'tasks/tasks.json')
		.action(async (options) => {
			const tasksPath = options.file;
			const threshold = parseInt(options.threshold, 10);
			const useResearch = options.research || false;
			const outputPath = options.output;

			if (isNaN(threshold) || threshold < 1 || threshold > 10) {
				console.error(chalk.red('Error: --threshold must be an integer between 1 and 10.'));
				process.exit(1);
			}

			if (!fs.existsSync(tasksPath)) {
				console.error(
					chalk.red(`Error: Tasks file not found at path: ${tasksPath}`)
				);
				if (tasksPath === 'tasks/tasks.json') {
					console.log(
						chalk.yellow(
							'Please ensure you have run `task-master parse-prd` to generate your tasks file.'
						)
					);
				}
				process.exit(1);
			}

			let spinner = ora('Analyzing task complexity...\n').start();
			try {
				await analyzeTaskComplexity(tasksPath, threshold, useResearch, outputPath);
				spinner.succeed('Task complexity analysis complete!');
				console.log(chalk.blue(`Report saved to: ${outputPath}`));
			} catch (error) {
				spinner.fail(`Error analyzing complexity: ${error.message}`);
				process.exit(1);
			}
		});

	// complexity-report command
	programInstance
		.command('complexity-report')
		.description('Display the complexity analysis report in a readable format')
		.option('-f, --file <file>', 'Path to the report file', 'scripts/task-complexity-report.json')
		.action(async (options) => {
			const reportPath = options.file;

			if (!fs.existsSync(reportPath)) {
				console.error(
					chalk.red(`Error: Complexity report file not found at path: ${reportPath}`)
				);
				console.log(
					chalk.yellow(
						'Please run `task-master analyze-complexity` first to generate the report.'
					)
				);
				process.exit(1);
			}

			try {
				displayComplexityReport(reportPath);
			} catch (error) {
				console.error(
					chalk.red(`Error displaying complexity report: ${error.message}`)
				);
				process.exit(1);
			}
		});

	// init command
	programInstance
		.command('init')
		.description('Initialize a new Task Master project structure')
		.option('--skip-install', 'Skip installing dependencies automatically', false)
		.option('--add-aliases', 'Add shell aliases (tm, taskmaster) to shell config file', false)
		.option('-y, --yes', 'Skip prompts and use default values', false)
		.action(async (options) => {
			try {
				await initializeProject(options);
				console.log(chalk.green.bold('\nTask Master project initialized successfully!'));
				console.log(chalk.blue('You can now run `task-master parse-prd <your-prd-file.txt>` to generate tasks.'));
			} catch (error) {
				console.error(chalk.red(`Error initializing project: ${error.message}`));
				process.exit(1);
			}
		});

	// models command
	programInstance
		.command('models')
		.description('Get information about available AI models or set model configurations')
		.option('--set-main <modelId>', 'Set the primary model for task generation/updates')
		.option('--set-research <modelId>', 'Set the model for in-depth analysis operations')
		.option('--set-search <modelId>', 'Set the model for research-backed subtask generation/task updates operations')
		.option('--list-available-models', 'List all available models not currently in use')
		.option('--setup', 'Run interactive setup for model configuration')
		.option('--ollama', 'Indicates the set model ID is a custom Ollama model')
		.action(async (options) => {
			const projectRoot = findProjectRoot();
			if (!projectRoot) {
				console.error(chalk.red('Error: Could not determine project root.'));
				process.exit(1);
			}

			if (options.setup) {
				const setupCompleted = await runInteractiveSetup(projectRoot);
				if (!setupCompleted) {
					process.exit(1); // Exit if setup was cancelled or failed
				}
				// After setup, display the current configuration
				const configResult = await getModelConfiguration({ projectRoot });
				if (configResult.success) {
					displayModelConfiguration(configResult.data);
					displayApiKeyStatus(await getApiKeyStatusReport(projectRoot));
				} else {
					console.error(chalk.red(`Error loading config after setup: ${configResult.error?.message || 'Unknown'}`));
				}
				return; // Exit after setup
			}

			if (options.setMain) {
				const result = await setModel('main', options.setMain, { projectRoot, ollama: options.ollama });
				if (result.success) {
					console.log(chalk.green(`Main model set to: ${result.data.provider} / ${result.data.modelId}`));
					if (result.data.warning) {
						console.log(chalk.yellow(result.data.warning));
					}
				} else {
					console.error(chalk.red(`Error setting main model: ${result.error?.message || 'Unknown'}`));
					process.exit(1);
				}
			} else if (options.setResearch) {
				const result = await setModel('research', options.setResearch, { projectRoot, ollama: options.ollama });
				if (result.success) {
					console.log(chalk.green(`In-depth analysis model set to: ${result.data.provider} / ${result.data.modelId}`));
					if (result.data.warning) {
						console.log(chalk.yellow(result.data.warning));
					}
				} else {
					console.error(chalk.red(`Error setting research model: ${result.error?.message || 'Unknown'}`));
					process.exit(1);
				}
			} else if (options.setSearch) {
				const result = await setModel('search', options.setSearch, { projectRoot, ollama: options.ollama });
				if (result.success) {
					console.log(chalk.green(`Research-backed subtask generation/task updates model set to: ${result.data.provider} / ${result.data.modelId}`));
					if (result.data.warning) {
						console.log(chalk.yellow(result.data.warning));
					}
				} else {
					console.error(chalk.red(`Error setting search model: ${result.error?.message || 'Unknown'}`));
					process.exit(1);
				}
			} else if (options.listAvailableModels) {
				const availableModels = getAvailableModelsList();
				displayAvailableModels(availableModels);
			} else {
				// Default action: display current configuration and API key status
				const configResult = await getModelConfiguration({ projectRoot });
				if (configResult.success) {
					displayModelConfiguration(configResult.data);
					displayApiKeyStatus(await getApiKeyStatusReport(projectRoot));
				} else {
					console.error(chalk.red(`Error loading model configuration: ${configResult.error?.message || 'Unknown'}`));
					if (configResult.error?.code === 'CONFIG_MISSING') {
						console.log(chalk.yellow('Run `task-master models --setup` to configure your models.'));
					}
					process.exit(1);
				}
			}
		});

	// telemetry command (hidden, for internal use/debugging)
	programInstance
		.command('telemetry')
		.description('Display AI usage telemetry summary (for debugging/internal use)')
		.option('-f, --file <file>', 'Path to the telemetry log file', '.taskmaster_telemetry.jsonl')
		.action(async (options) => {
			const telemetryLogPath = options.file;
			try {
				displayAiUsageSummary(telemetryLogPath);
			} catch (error) {
				console.error(chalk.red(`Error displaying telemetry: ${error.message}`));
				process.exit(1);
			}
		});

	// help command (override default help to use custom displayHelp)
	programInstance
		.command('help')
		.description('Display help for commands')
		.argument('[command]', 'Command to display help for')
		.action((command) => {
			displayHelp(programInstance, command);
		});

	// version command
	programInstance
		.version(getTaskMasterVersion(), '-v, --version', 'Output the current version')
		.description('Task Master CLI - AI-driven task management tool');

	// Catch all for unknown commands
	programInstance.on('command:*', (operands) => {
		console.error(
			chalk.red(`Error: Unknown command '${operands[0]}'`)
		);
		console.log(chalk.yellow('See `task-master --help` for a list of available commands.'));
		process.exit(1);
	});
}

/**
 * Checks for a new version of the CLI on npm.
 * @returns {Promise<void>}
 */
async function checkForUpdate() {
	const currentVersion = getTaskMasterVersion();
	const packageName = 'task-master-ai'; // The name of your package on npm

	try {
		const latestVersion = await new Promise((resolve, reject) => {
			const options = {
				hostname: 'registry.npmjs.org',
				path: `/${packageName}`,
				method: 'GET'
			};

			const req = https.request(options, (res) => {
				let data = '';
				res.on('data', (chunk) => (data += chunk));
				res.on('end', () => {
					if (res.statusCode === 200) {
						try {
							const packageInfo = JSON.parse(data);
							resolve(packageInfo['dist-tags'].latest);
						} catch (e) {
							reject(new Error('Failed to parse npm registry response.'));
						}
					} else {
						reject(
							new Error(
								`Failed to fetch npm package info. Status: ${res.statusCode}`
							)
						);
					}
				});
			});

			req.on('error', (e) => reject(e));
			req.end();
		});

		if (compareVersions(currentVersion, latestVersion) < 0) {
			displayUpgradeNotification(currentVersion, latestVersion);
		}
	} catch (error) {
		log('debug', `Failed to check for CLI updates: ${error.message}`);
		// Do not exit or throw, update check is non-critical
	}
}

/**
 * Compares two version strings (e.g., "1.0.0", "1.0.1").
 * Returns -1 if v1 < v2, 0 if v1 == v2, 1 if v1 > v2.
 * @param {string} v1
 * @param {string} v2
 * @returns {number}
 */
function compareVersions(v1, v2) {
	const parts1 = v1.split('.').map(Number);
	const parts2 = v2.split('.').map(Number);

	for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
		const p1 = parts1[i] || 0;
		const p2 = parts2[i] || 0;
		if (p1 < p2) return -1;
		if (p1 > p2) return 1;
	}
	return 0;
}

/**
 * Displays a notification to the user about a new version being available.
 * @param {string} currentVersion
 * @param {string} latestVersion
 */
function displayUpgradeNotification(currentVersion, latestVersion) {
	const message = boxen(
		chalk.white.bold('New version available!') +
			'\n\n' +
			`Version ${chalk.green(latestVersion)} of Task Master is available.` +
			`\nYou are currently using ${chalk.yellow(currentVersion)}.` +
			'\n\n' +
			chalk.blue('To upgrade, run:') +
			'\n' +
			chalk.cyan('npm install -g task-master-ai'),
		{
			padding: 1,
			margin: 1,
			borderColor: 'green',
			borderStyle: 'round'
		}
	);
	console.log(message);
}

/**
 * Main function to run the CLI.
 * @param {string[]} argv - Command line arguments (defaults to process.argv)
 */
async function runCLI(argv = process.argv) {
	displayBanner(); // Display banner at the very start

	// Register all commands
	registerCommands(program);

	// Parse arguments
	program.parse(argv);

	// If no command was given, display help
	if (!argv.slice(2).length) {
		program.outputHelp();
	}

	// Check for updates in the background after initial command execution
	// This prevents delaying the main command but still informs the user
	// if (process.env.NODE_ENV !== 'development') { // Only check in production
	// 	checkForUpdate();
	// }
}

export { runCLI, registerCommands, runInteractiveSetup };
