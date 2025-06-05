import { window, TreeView, ExtensionContext, workspace, Uri } from 'vscode';
import { sep, posix } from 'path';
import { GitExcludeParse } from '../modules/GitExclude';
import { getRelativeExcludePath, transformPath } from '../utils/string.utils';
import { ChangelistsTreeDataProvider, Key } from './ChangelistProvider';
import {
  defaultChangelistName,
  emptySymbol,
  noFilesPlaceholder,
} from '../constants';
import {
  AskToInitAnswers,
  askToInitExtFiles,
  cannotReadContent,
  cannotWriteContent,
} from '../constants/messages';
import { store } from '../core/store';
import { logger } from '../core/logger';
import { JSONConfig, JSONConfigModule } from '../modules/JSONConfig';
import { GitManager } from '../modules/GitManager';

export type TreeType = { [key: string]: any };

export class ChangeListView {
  static view: TreeView<{
    key: string;
  }>;

  static provider: ChangelistsTreeDataProvider;

  static tree: TreeType = {};
  static nodes: { [key: string]: Key | undefined } = {};

  jsonConfigModule: JSONConfigModule;

  parser: GitExcludeParse;

  private refreshTimerId: NodeJS.Timeout | null = null;

  private async refresh(fromFile?: boolean) {
    if (fromFile) {
      try {
        await this.loadTreeFile();

        store.isGitRepoFound = true;
      } catch (error) {
        window.showErrorMessage(cannotReadContent);
        store.isGitRepoFound = false;
        logger.appendLine(
          `[Error] Error while refreshing changelist view: ${(error as Error).message}`
        );

        return;
      }
    }
    ChangeListView.provider.refresh();
  }

  public async scheduleRefresh(fromFile?: boolean) {
    if (this.refreshTimerId) {
      clearTimeout(this.refreshTimerId);
    }

    this.refreshTimerId = setTimeout(async () => {
      await this.refresh(fromFile);
    }, 200);
  }

  constructor(
    context: ExtensionContext,
    public readonly config: {
      id: string;
      gitRootPath: string;
      workspaceRootUri: Uri;
    }
  ) {
    const { id, gitRootPath, workspaceRootUri } = this.config;

    this.jsonConfigModule = new JSONConfigModule(workspaceRootUri);
    this.parser = new GitExcludeParse(gitRootPath);
    ChangeListView.provider = new ChangelistsTreeDataProvider(
      ChangeListView,
      id,
      workspaceRootUri
    );

    ChangeListView.view = window.createTreeView(id, {
      treeDataProvider: ChangeListView.provider,
      showCollapseAll: true,
      canSelectMany: true,
    });
    context.subscriptions.push(ChangeListView.view);
    ChangeListView.view.dispose = () => {
      this.dispose();
      ChangeListView.view.dispose.call(ChangeListView.view);
      ChangeListView.view = null as any;
    };

    workspace.onDidChangeTextDocument((e) => {
      const { document } = e;

      const definitelyPosix = document.uri.fsPath.split(sep).join(posix.sep);

      if (
        !document.isUntitled &&
        definitelyPosix.includes(getRelativeExcludePath('.git'))
      ) {
        setTimeout(async () => {
          try {
            if (!document.isClosed) {
              document.save();
            }
          } catch (error) {
            // window.showErrorMessage(cannotWriteContent);
          }

          await this.scheduleRefresh(true);
        }, 300);
      }
    });
  }

  public async getGitStatus(): Promise<string[]> {
    return await GitManager.getGitStatus(this.config.workspaceRootUri);
  }

  public async isUntracked(filePath: string, lines?: string[]) {
    const gitStatusLines = lines ?? (await this.getGitStatus());

    return gitStatusLines.some((line) => {
      const status = line.trimStart().split(' ').at(0);

      return status === '??' && line.includes(filePath);
    });
  }

  public async loadTreeFile() {
    const success = await this.loadTreeFromJSONConfig();

    if (!success) {
      logger.appendLine('[WARN] Failed to load tree from JSON config. Falling back to exclude file system.');

      await this.loadTreeFromExcludeFile();
    }
  }

  public async loadTreeFromExcludeFile(): Promise<boolean> {
    const lines = await this.parser.getExcludeContentLines();

    if (this.parser.checkIfWorkzoneExists(lines)) {
      const lists = this.parser.getChangelistArrayFromContent(lines);
      const tree = this.parser.transformChangelistArrayToTree(lists);

      ChangeListView.tree = Object.assign({}, tree);

      return true;
    }

    return false;
  }

  public async loadTreeFromJSONConfig(): Promise<boolean> {
    if (await this.jsonConfigModule.checkIfConfigExists()) {
      const jsonConfig = await this.jsonConfigModule.loadConfig();

      if (!jsonConfig) {
        return false;
      }

      const tree = this.jsonConfigModule.jsonConfigToTree(jsonConfig);

      ChangeListView.tree = Object.assign({}, tree);

      return true;
    }

    return false;
  }

  public async onTreeChange() {
    try {
      await this.syncTreeToConfig();
    } catch (error) {
      window.showErrorMessage(cannotWriteContent);
      logger.appendLine(
        `[Error] Error while syncing config file: ${(error as Error).message}`
      );
    }
  }

  public transformChangelistName(name: string) {
    if (name.includes(emptySymbol)) {
      return name.split(RegExp(emptySymbol)).at(0) ?? name;
    }

    return name;
  }

  public async addNewChangelist(
    name: string,
    files: string[] = [
      /* noFilesPlaceholder */
    ]
  ) {
    const transName = this.transformChangelistName(name);

    ChangeListView.tree[transName] = {
      ...files?.reduce((acc: any, filePath) => {
        acc[filePath] = {};

        return acc;
      }, {}),
    };

    await this.scheduleRefresh();
  }

  public async removeChangelist(name: string) {
    const transName = this.transformChangelistName(name);

    delete ChangeListView.tree[transName];
    delete ChangeListView.nodes[transName];

    await this.scheduleRefresh();
  }

  public async renameChangelist(name: string, newName: string) {
    const transName = this.transformChangelistName(name);

    const content = ChangeListView.tree[transName];

    ChangeListView.tree[newName] = content;
    delete ChangeListView.tree[transName];
    delete ChangeListView.nodes[transName];

    await this.scheduleRefresh();
  }

  public async addFileToChangelist(name: string, file: string) {
    const transName = this.transformChangelistName(name);

    const changelist = ChangeListView.tree[transName];

    if (!changelist) {
      return;
    }

    const filePath = transformPath(file);

    if (Object.keys(changelist).includes(filePath)) {
      return;
    }

    changelist[filePath] = {};

    if (
      filePath !== noFilesPlaceholder &&
      Object.keys(changelist).includes(noFilesPlaceholder)
    ) {
      delete changelist[noFilesPlaceholder];
    }

    await this.scheduleRefresh();
  }

  public async removeFileFromChangelist(name: string, file: string) {
    const transName = this.transformChangelistName(name);

    const changelist = ChangeListView.tree[transName];

    if (!changelist) {
      return;
    }

    if (!Object.keys(changelist).includes(file)) {
      return;
    }

    delete changelist[file];

    await this.scheduleRefresh();
  }

  public async isConfigInitialized() {
    try {
      await this.jsonConfigModule.checkIfConfigExists();
      store.isGitRepoFound = true;

      return true;
    } catch (error) {
      window.showErrorMessage(cannotReadContent);
      store.isGitRepoFound = false;

      throw error;
    }
  }

  public async askToInitConfigFile() {
    const answers = Object.values(AskToInitAnswers);

    const choice = await window.showQuickPick(answers, {
      title: askToInitExtFiles,
    });

    if (choice === AskToInitAnswers.yes) {
      try {
        await this.initConfigFile();

        return true;
      } catch (error) {
        window.showErrorMessage(cannotWriteContent);
        logger.appendLine(
          `[Error] Error while initializing config file: ${
            (error as Error).message
          }`
        );
      }
    }

    return false;
  }

  /* IO methods */

  public async initConfigFile() {
    if (await this.isConfigInitialized()) {
      return;
    }

    logger.appendLine('Initializing config file...');

    const newJsonConfig = await this.jsonConfigModule.initConfig();

    await this.writeContentToConfigFile(newJsonConfig);

    await this.scheduleRefresh(true);
  }

  public async writeContentToConfigFile(newJsonConfig: JSONConfig) {
    const oldJsonConfig = (await this.jsonConfigModule.checkIfConfigExists())
      ? await this.jsonConfigModule.loadConfig()
      : null;

    if (newJsonConfig?.compare(oldJsonConfig)) {
      return;
    }

    await this.jsonConfigModule.writeConfig(newJsonConfig);
  }

  public async syncTreeToConfig() {
    const newJsonConfig = this.jsonConfigModule.treeToJSONConfig(
      ChangeListView.tree,
      await this.jsonConfigModule.getConfig()
    );

    await this.writeContentToConfigFile(newJsonConfig);
  }

  public dispose() {
    if (this.refreshTimerId) {
      clearTimeout(this.refreshTimerId);
      this.refreshTimerId = null;
    }
  }
}
