// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { ChangeListView } from './ChangelistView';

export const EXTENSION_ID = 'git-changelists';

const checkPrerequisites = (
  context: vscode.ExtensionContext,
  logger: vscode.OutputChannel
) => {
  if (
    !vscode.workspace.workspaceFolders ||
    vscode.workspace.workspaceFolders.length === 0
  ) {
    logger.appendLine('This extension will not work outside workspace');

    return 'exit';
  }

  if (!vscode.workspace.isTrusted) {
    logger.appendLine(
      'This extension will not work inside untrusted workspace'
    );

    return 'exit';
  }

  return;
};

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  const logger = vscode.window.createOutputChannel('Git Changelists');

  logger.appendLine(`Extension "${EXTENSION_ID}" is now active!`);

  logger.appendLine(process.env.NODE_ENV ?? '');

  /*  */

  const result = checkPrerequisites(context, logger);

  if (!vscode.workspace.workspaceFolders || result === 'exit') {
    return;
  }

  /*  */

  const rootUri = vscode.workspace.workspaceFolders[0].uri;

  const workspaceRootPath = rootUri.fsPath;

  logger.appendLine('Workspace rootpath: ' + workspaceRootPath);

  const gitRootPath = `${workspaceRootPath}/.git`; // TODO fix

  logger.appendLine('Is Git repo active: ' + true); // TODO add valid check

  /*  */

  new ChangeListView(
    context,
    {
      id: `${EXTENSION_ID}.views.explorer`,
      gitRootPath,
    },
    logger
  );

  // Use the console to output diagnostic information (console.log) and errors (console.error)
  // This line of code will only be executed once when your extension is activated

  // The command has been defined in the package.json file
  // Now provide the implementation of the command with registerCommand
  // The commandId parameter must match the command field in package.json
}

// This method is called when your extension is deactivated
export function deactivate() {}
