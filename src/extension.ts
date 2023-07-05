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
import { addGitToPath } from './utils/string.utils';

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

  /* check and inform problems  */

  checkPrerequisites();

  /* get workspaces */

  const workspaces = WorkspaceManager.workspaceFolders ?? [];

  logger.appendLine('Workspace folders: ' + workspaces?.map((w) => w.name));

  /* check git metadata in workspace */

  const gitEnabled = WorkspaceManager.workspaceGitEnabled;

  if (gitEnabled) {
    await store.initGitProjectFolders(workspaces);
    logger.appendLine(
      'Git project folders: ' +
        Array.from(store.gitProjectFolders.values()).flat(2)
    );
  }

  /* init extension */

  // legacy support
  const gitRootPath = GitManager.getLegacyGitRepoPath();

  const viewInstance = new ChangeListView(context, {
    id: `${EXTENSION_ID}.views.explorer`,
    gitRootPath,
  });

  registerCommands({ viewInstance, context });

  if (store.isGitRepoFound) {
    await viewInstance.initExcludeFile();
    await viewInstance.refresh(true);
  }
}

// This method is called when your extension is deactivated
export function deactivate() {}
