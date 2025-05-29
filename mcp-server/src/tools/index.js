/**
 * tools/index.js
 * Export all Task Master CLI tools for MCP server
 */

import { registerListTasksTool } from './get-tasks.js';
import logger from '../logger.js';
import { registerSetTaskStatusTool } from './set-task-status.js';
import { registerParsePRDTool } from './parse-prd.js';
import { registerUpdateTool } from './update.js';
import { registerUpdateTaskTool } from './update-task.js';
import { registerUpdateSubtaskTool } from './update-subtask.js';
import { registerGenerateTool } from './generate.js';
import { registerShowTaskTool } from './get-task.js';
import { registerNextTaskTool } from './next-task.js';
import { registerExpandTaskTool } from './expand-task.js';
import { registerAddTaskTool } from './add-task.js';
import { registerAddSubtaskTool } from './add-subtask.js';
import { registerRemoveSubtaskTool } from './remove-subtask.js';
import { registerAnalyzeProjectComplexityTool } from './analyze.js';
import { registerClearSubtasksTool } from './clear-subtasks.js';
import { registerExpandAllTool } from './expand-all.js';
import { registerRemoveDependencyTool } from './remove-dependency.js';
import { registerValidateDependenciesTool } from './validate-dependencies.js';
import { registerFixDependenciesTool } from './fix-dependencies.js';
import { registerComplexityReportTool } from './complexity-report.js';
import { registerAddDependencyTool } from './add-dependency.js';
import { registerRemoveTaskTool } from './remove-task.js';
import { registerModelsTool } from './models.js';

/**
 * Register all Task Master tools with the MCP server
 * @param {Object} server - FastMCP server instance
 */
export function registerTaskMasterTools(server) {
	try {
		logger.info('Attempting to register Task Master tools...');

		// Group 1: Initialization & Setup
		logger.debug('Registering Models Tool...');
		registerModelsTool(server);
		logger.debug('Models Tool registered.');

		logger.debug('Registering Parse PRD Tool...');
		registerParsePRDTool(server);
		logger.debug('Parse PRD Tool registered.');

		// Group 2: Task Listing & Viewing
		logger.debug('Registering List Tasks Tool...');
		registerListTasksTool(server);
		logger.debug('List Tasks Tool registered.');

		logger.debug('Registering Show Task Tool...');
		registerShowTaskTool(server);
		logger.debug('Show Task Tool registered.');

		logger.debug('Registering Next Task Tool...');
		registerNextTaskTool(server);
		logger.debug('Next Task Tool registered.');

		logger.debug('Registering Complexity Report Tool...');
		registerComplexityReportTool(server);
		logger.debug('Complexity Report Tool registered.');

		// Group 3: Task Status & Management
		logger.debug('Registering Set Task Status Tool...');
		registerSetTaskStatusTool(server);
		logger.debug('Set Task Status Tool registered.');

		logger.debug('Registering Generate Tool...');
		registerGenerateTool(server);
		logger.debug('Generate Tool registered.');

		// Group 4: Task Creation & Modification
		logger.debug('Registering Add Task Tool...');
		registerAddTaskTool(server);
		logger.debug('Add Task Tool registered.');

		logger.debug('Registering Add Subtask Tool...');
		registerAddSubtaskTool(server);
		logger.debug('Add Subtask Tool registered.');

		logger.debug('Registering Update Tool...');
		registerUpdateTool(server);
		logger.debug('Update Tool registered.');

		logger.debug('Registering Update Task Tool...');
		registerUpdateTaskTool(server);
		logger.debug('Update Task Tool registered.');

		logger.debug('Registering Update Subtask Tool...');
		registerUpdateSubtaskTool(server);
		logger.debug('Update Subtask Tool registered.');

		logger.debug('Registering Remove Task Tool...');
		registerRemoveTaskTool(server);
		logger.debug('Remove Task Tool registered.');

		logger.debug('Registering Remove Subtask Tool...');
		registerRemoveSubtaskTool(server);
		logger.debug('Remove Subtask Tool registered.');

		logger.debug('Registering Clear Subtasks Tool...');
		registerClearSubtasksTool(server);
		logger.debug('Clear Subtasks Tool registered.');

		// Group 5: Task Analysis & Expansion
		logger.debug('Registering Analyze Project Complexity Tool...');
		registerAnalyzeProjectComplexityTool(server);
		logger.debug('Analyze Project Complexity Tool registered.');

		logger.debug('Registering Expand Task Tool...');
		registerExpandTaskTool(server);
		logger.debug('Expand Task Tool registered.');

		logger.debug('Registering Expand All Tool...');
		registerExpandAllTool(server);
		logger.debug('Expand All Tool registered.');

		// Group 6: Dependency Management
		logger.debug('Registering Add Dependency Tool...');
		registerAddDependencyTool(server);
		logger.debug('Add Dependency Tool registered.');

		logger.debug('Registering Remove Dependency Tool...');
		registerRemoveDependencyTool(server);
		logger.debug('Remove Dependency Tool registered.');

		logger.debug('Registering Validate Dependencies Tool...');
		registerValidateDependenciesTool(server);
		logger.debug('Validate Dependencies Tool registered.');

		logger.debug('Registering Fix Dependencies Tool...');
		registerFixDependenciesTool(server);
		logger.debug('Fix Dependencies Tool registered.');

		logger.info('All Task Master tools registered successfully.');
	} catch (error) {
		logger.error(`Error registering Task Master tools: ${error.message}`);
		throw error;
	}
}

export default {
	registerTaskMasterTools
};
