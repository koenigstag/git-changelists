import * as vscode from 'vscode';

export const noFilesPlaceholder = 'No files';
export const emptySymbol = '⠀';

export const getWorkspaceRootPath = () => {
  return vscode.workspace.workspaceFolders?.[0].uri.fsPath;
};
