// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { ChangeListView } from './view/ChangelistView';
import registerCommands from './core/commands';
import { store } from './core/store';
import { logger } from './core/logger';
import { GitManager } from './modules/GitManager';
import { WorkspaceManager } from './modules/WorkspaceManager';
import { EXTENSION_ID } from './constants/extension';

const checkPrerequisites = () => {
  if (!WorkspaceManager.isWorkspaceFound) {
    logger.appendLine('This extension will not work outside workspace');

    return;
  }

  if (!WorkspaceManager.isWorkspaceTrusted) {
    logger.appendLine(
      'This extension will not work inside untrusted workspace'
    );

    return;
  }
};

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export async function activate(context: vscode.ExtensionContext) {
  logger.appendLine(`Extension "${EXTENSION_ID}" is now active!`);

  logger.appendLine(process.env.NODE_ENV ?? '');

  /*  */

  checkPrerequisites();

  /*  */

  const workspaceRootPath = WorkspaceManager.workspaceRootPath;
  const workspaceRootUri = WorkspaceManager.workspaceRootUri;

  logger.appendLine('Workspace rootpath: ' + workspaceRootPath);

  if (!workspaceRootPath || !workspaceRootUri) {
    return;
  }

  /*  */

  let gitRootPath = GitManager.getLegacyGitRepoPath(workspaceRootPath); // TODO: fix in case of multiple git repos

  const gitEnabled = WorkspaceManager.workspaceGitEnabled;

  if (gitEnabled) {
    store.checkGitInitialized(workspaceRootPath);
    logger.appendLine('Is Git repo active: ' + store.isGitRepoFound);
  }

  /*  */

  const viewInstance = new ChangeListView(context, {
    id: `${EXTENSION_ID}.views.explorer`,
    gitRootPath,
    workspaceRootUri,
  });

  registerCommands({ viewInstance, context });

  if (store.isGitRepoFound) {
    await viewInstance.initConfigFile();
    await viewInstance.scheduleRefresh(true);
  }
}

// This method is called when your extension is deactivated
export function deactivate() {}
