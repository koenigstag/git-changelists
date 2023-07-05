import * as vscode from 'vscode';

export class WorkspaceManager {
  static get workspace() {
    return vscode.workspace;
  }

  static get workspaceFolders() {
    return this.workspace.workspaceFolders;
  }

  static get isWorkspaceFound() {
    return this.workspaceFolders && this.workspaceFolders.length > 0;
  }

  static get isWorkspaceTrusted() {
    return this.workspace.isTrusted;
  }

  static get workspaceRootPath(): string | undefined {
    return this.workspaceFolders?.[0].uri.fsPath;
  }

  static get workspaceConfig(): vscode.WorkspaceConfiguration {
    return this.workspace.getConfiguration();
  }

  static get workspaceGitEnabled(): boolean {
    const config = this.workspaceConfig;
    const gitConf: any = config.get('git');

    return gitConf.enabled;
  }
}
