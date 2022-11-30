// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { ChangeListView } from './ChangelistView';
import registerCommands from './commands';
import { store } from './store';
import { execSync } from 'child_process';
import { logger } from './logger';
import { getWorkspaceRootPath } from './constants';

export const EXTENSION_ID = 'git-changelists';

const isGitInitialized = () => {
  try {
    execSync('git rev-parse --is-inside-work-tree', {
      encoding: 'utf-8',
      cwd: getWorkspaceRootPath(),
    });
    return true;
  } catch (error) {
    return false;
  }
};

const checkPrerequisites = () => {
  if (
    !vscode.workspace.workspaceFolders ||
    vscode.workspace.workspaceFolders.length === 0
  ) {
    logger.appendLine('This extension will not work outside workspace');
    store.workspaceFound = false;

    return;
  }
  store.workspaceFound = true;

  if (!vscode.workspace.isTrusted) {
    logger.appendLine(
      'This extension will not work inside untrusted workspace'
    );
    store.workspaceIsTrusted = false;

    return;
  }
  store.workspaceIsTrusted = true;
};

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export async function activate(context: vscode.ExtensionContext) {
  logger.appendLine(`Extension "${EXTENSION_ID}" is now active!`);

  logger.appendLine(process.env.NODE_ENV ?? '');

  /*  */

  checkPrerequisites();

  /*  */

  const workspaceRootPath = getWorkspaceRootPath();

  logger.appendLine('Workspace rootpath: ' + workspaceRootPath);

  /*  */
  const gitRootPath = `${workspaceRootPath}/.git`; // TODO fix

  const config = vscode.workspace.getConfiguration();
  const gitConf: any = config.get('git');

  const gitEnabled = gitConf.enabled;

  const isGitRepoFound = isGitInitialized();

  logger.appendLine('Is Git repo active: ' + isGitRepoFound);

  if (gitEnabled && isGitRepoFound) {
    store.gitRepoFound = true;
  } else {
    store.gitRepoFound = false;
  }

  /*  */

  const viewInstance = new ChangeListView(context, {
    id: `${EXTENSION_ID}.views.explorer`,
    gitRootPath,
  });

  registerCommands({ viewInstance, context });

  if (store.gitRepoFound) {
    viewInstance.refresh(true);
  }
}

// This method is called when your extension is deactivated
export function deactivate() {}
