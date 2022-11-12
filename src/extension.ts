// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { ChangeListView } from './ChangelistView';
import registerCommands from './commands';

export const EXTENSION_ID = 'git-changelists';

const checkPrerequisites = (logger: vscode.OutputChannel) => {
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
export async function activate(context: vscode.ExtensionContext) {
  const logger = vscode.window.createOutputChannel('Git Changelists');

  logger.appendLine(`Extension "${EXTENSION_ID}" is now active!`);

  logger.appendLine(process.env.NODE_ENV ?? '');

  /*  */

  const result = checkPrerequisites(logger);

  if (!vscode.workspace.workspaceFolders || result === 'exit') {
    return;
  }

  /*  */

  const rootUri = vscode.workspace.workspaceFolders[0].uri;

  const workspaceRootPath = rootUri.fsPath;

  logger.appendLine('Workspace rootpath: ' + workspaceRootPath);

  const gitRootPath = `${workspaceRootPath}/.git`; // TODO fix

  const config = vscode.workspace.getConfiguration();
  const gitConf: any = config.get('git');

  const gitEnabled = gitConf.enabled;

  logger.appendLine('Is Git repo active: ' + gitEnabled); // TODO add valid check

  /*  */

  const viewInstance = new ChangeListView(
    context,
    {
      id: `${EXTENSION_ID}.views.explorer`,
      gitRootPath,
    },
    logger
  );

  registerCommands({ viewInstance, context, logger });

  viewInstance.refresh();
}

// This method is called when your extension is deactivated
export function deactivate() {}
