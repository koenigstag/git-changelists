import * as vscode from 'vscode';
import * as path from 'path';
import {
  checkIfWorkzoneExists,
  getChangelists,
  getExcludeContent,
  getWorkzoneIndexes,
  newLineRegex,
  prepareExcludeFile,
  transformChangelistToTree,
  treeToText,
} from './GitExclude';
import * as child from 'child_process';

const folderIcon = {
  light: path.join(__filename, '..', '..', 'resources', 'light', 'folder.svg'),
  dark: path.join(__filename, '..', '..', 'resources', 'dark', 'folder.svg'),
};

const documentIcon = {
  light: path.join(
    __filename,
    '..',
    '..',
    'resources',
    'light',
    'document.svg'
  ),
  dark: path.join(__filename, '..', '..', 'resources', 'dark', 'document.svg'),
};

const noFiles = 'No files';

export class ChangeListView {
  static view: vscode.TreeView<{
    key: string;
  }>;

  static provider: ChangelistsTreeDataProvider;

  static tree: { [key: string]: any } = {};
  static nodes: { [key: string]: Key | undefined } = {};

  async refresh(fromFile?: boolean): Promise<void> {
    if (fromFile) {
      await this.loadTreeFile();
    }
    ChangeListView.provider.refresh();
  }

  constructor(
    context: vscode.ExtensionContext,
    private readonly config: { id: string; gitRootPath: string },
    private readonly logger: vscode.OutputChannel
  ) {
    const { id } = this.config;

    this.loadTreeFile().then(() => {
      ChangeListView.provider = new ChangelistsTreeDataProvider();

      ChangeListView.view = vscode.window.createTreeView(id, {
        treeDataProvider: ChangeListView.provider,
        showCollapseAll: true,
        canSelectMany: true,
      });
      context.subscriptions.push(ChangeListView.view);
    });

    vscode.workspace.onDidChangeTextDocument((e) => {
      const { document } = e;
      if (
        !document.isUntitled &&
        (document.uri.fsPath.includes('.git/info/exclude') ||
          document.uri.fsPath.includes('.git\\info\\exclude'))
      ) {
        setTimeout(() => {
          document.save();
        }, 300);
      }
    });

    let disposable = vscode.commands.registerCommand(
      'git-changelists.init',
      async () => {
        // The code you place here will be executed every time your command is executed
        // Display a message box to the user

        const content = await getExcludeContent(this.config.gitRootPath);

        if (!checkIfWorkzoneExists(content)) {
          vscode.window.showInformationMessage('Initializing git-changelists!');

          await this.prepareExcludeFile();
        }
      }
    );

    context.subscriptions.push(disposable);

    vscode.commands.registerCommand(`${id}.refresh`, async () => {
      this.logger.appendLine(`command: ${id}.refresh`);

      await this.refresh(true);
    });

    vscode.commands.registerCommand(`${id}.createNew`, async () => {
      this.logger.appendLine(`command: ${id}.createNew`);

      const value = await vscode.window.showInputBox({
        placeHolder: 'New Changelist name',
        prompt: 'Enter new Changelist unique name',
        value: '',
      });

      if (!value) {
        vscode.window.showErrorMessage(
          'A Changelist name is mandatory to execute this action'
        );

        return;
      }

      if (Object.keys(ChangeListView.tree).includes(value)) {
        vscode.window.showErrorMessage(
          'Changelist with such name already exists'
        );
        return;
      }

      this.addNewChangelist(value);

      await this.onTreeChange();
      await this.refresh();
    });

    vscode.commands.registerCommand(`${id}.rename`, async (node: Key) => {
      this.logger.appendLine(`command: ${id}.rename`);

      const value = await vscode.window.showInputBox({
        placeHolder: 'New Changelist name',
        prompt: 'Rename Changelist',
        value: '',
      });

      if (!value) {
        vscode.window.showErrorMessage(
          'A Changelist name is mandatory to execute this action'
        );

        return;
      }

      if (Object.keys(ChangeListView.tree).includes(value)) {
        vscode.window.showErrorMessage(
          'Changelist with such name already exists'
        );
        return;
      }

      this.renameChangelist(node.key, value);

      await this.onTreeChange();
      await this.refresh();
    });

    vscode.commands.registerCommand(
      `${id}.removeChangeList`,
      async (node: Key) => {
        this.logger.appendLine(`command: ${id}.removeChangeList`);

        const value = ChangeListView.tree[node.key];

        this.removeChangelist(node.key);

        await this.onTreeChange();
        await this.refresh();

        const wsPath = vscode.workspace.workspaceFolders?.[0].uri.fsPath;

        Object.keys(value).forEach((fileName) => {
          try {
            const stdout = child.execSync(
              'git update-index --no-assume-unchanged ' + fileName,
              {
                cwd: wsPath,
                encoding: 'utf8',
              }
            );

            console.log(stdout.toString());
          } catch (error) {}
        });
      }
    );

    vscode.commands.registerCommand(`${id}.removeFile`, async (node: Key) => {
      this.logger.appendLine(`command: ${id}.removeFile`);

      const wsPath = vscode.workspace.workspaceFolders?.[0].uri.fsPath;

      const fileName = node.key;

      if (fileName === noFiles) {
        return;
      }

      const changelistName = Object.keys(ChangeListView.tree).find((name) =>
        Object.keys(ChangeListView.tree[name]).includes(fileName)
      );

      if (!changelistName) {
        vscode.window.showErrorMessage('Changelist not found');
        return;
      }

      if (Object.keys(ChangeListView.tree[changelistName]).length === 1) {
        this.addFileToChangelist(changelistName, 'No files');
      }

      this.removeFileFromChangelist(changelistName, fileName);

      await this.onTreeChange();
      await this.refresh();

      let text =
        '{file} is restored from the state assumed to be unchanged.'.replace(
          '{file}',
          fileName
        );
      vscode.window.showInformationMessage(text);
      try {
        const stdout = child.execSync(
          'git update-index --no-assume-unchanged ' + fileName,
          {
            cwd: wsPath,
            encoding: 'utf8',
          }
        );

        console.log(stdout.toString());
      } catch (error) {}
    });

    vscode.commands.registerCommand(
      `${id}.addFileToChangelist`,
      async (node) => {
        this.logger.appendLine(`command: ${id}.addFileToChangelist`);

        const wsPath = vscode.workspace.workspaceFolders?.[0].uri.fsPath;

        const relativePath = node.resourceUri.fsPath.replace(wsPath, '');

        const changelistName = await vscode.window.showQuickPick(
          Object.keys(ChangeListView.tree),
          { title: 'Select Changelist where you want to add file' }
        );

        if (!changelistName) {
          vscode.window.showErrorMessage(
            'A Changelist name is mandatory to execute this action'
          );

          return;
        }

        const fileName =
          relativePath.startsWith('/') || relativePath.startsWith('\\')
            ? relativePath.slice(1)
            : relativePath;

        if (!changelistName) {
          vscode.window.showErrorMessage('Changelist not found');
          return;
        }

        this.addFileToChangelist(changelistName, fileName);

        await this.onTreeChange();
        await this.refresh();

        if (!this.isUntracked(node)) {
          let text = '{file} is assumed to be unchanged.'.replace(
            '{file}',
            fileName
          );
          vscode.window.showInformationMessage(text);
          try {
            const stdout = child.execSync(
              'git update-index --assume-unchanged ' + fileName,
              {
                cwd: wsPath,
                encoding: 'utf8',
              }
            );

            console.log(stdout.toString());
          } catch (error) {}
        }
      }
    );
  }

  private isUntracked(node: any) {
    return node.letter === 'U';
  }

  private async loadTreeFile() {
    const content = await getExcludeContent(this.config.gitRootPath);

    if (!checkIfWorkzoneExists(content)) {
      const choice = await vscode.window.showQuickPick(['Yes', 'No, later'], {
        title:
          'Would you like to initialize Git Changelists ? \nYou can do it later using command "Initialize Git Changelists"',
      });

      if (choice === 'Yes') {
        await this.prepareExcludeFile(content);
      }
    } else {
      const lists = getChangelists(content);
      const tree = transformChangelistToTree(lists);

      Object.assign(ChangeListView.tree, tree, debugTree);
    }
  }

  private async prepareExcludeFile(content?: string) {
    if (!content) {
      content = await getExcludeContent(this.config.gitRootPath);
    }

    const newContent = await prepareExcludeFile(content);

    await this.writeTextToExcludeFile(newContent);
  }

  private async writeTextToExcludeFile(newContent: string) {
    const oldContent = await getExcludeContent(this.config.gitRootPath);
    const oldLines = oldContent.split(newLineRegex);

    const wsEdit = new vscode.WorkspaceEdit();
    const wsPath = vscode.workspace.workspaceFolders?.[0].uri.fsPath;

    if (!wsPath) {
      vscode.window.showErrorMessage('No workspace found');
      return;
    }

    const fileUri = vscode.Uri.file(`${wsPath}/.git/info/exclude`);

    wsEdit.replace(
      fileUri,
      new vscode.Range(
        new vscode.Position(0, 0),
        new vscode.Position(oldLines.length - 1, 0)
      ),
      newContent
    );

    await vscode.workspace.applyEdit(wsEdit);

  }

  private async writeTreeToExclude() {
    const wsEdit = new vscode.WorkspaceEdit();
    const wsPath = vscode.workspace.workspaceFolders?.[0].uri.fsPath;

    if (!wsPath) {
      vscode.window.showErrorMessage('No workspace found');
      return;
    }

    const fileUri = vscode.Uri.file(`${wsPath}/.git/info/exclude`);

    const indexes = await getWorkzoneIndexes(this.config.gitRootPath);
    const treeText = treeToText(ChangeListView.tree);

    wsEdit.replace(
      fileUri,
      new vscode.Range(
        new vscode.Position(indexes.startIndex + 1, 0),
        new vscode.Position(indexes.endIndex - 1, 0)
      ),
      treeText + '\n\n'
    );

    await vscode.workspace.applyEdit(wsEdit);

    // await writeNewExcludeContent(this.config.gitRootPath, treeLines);
  }

  private async onTreeChange() {
    await this.writeTreeToExclude();
  }

  public addNewChangelist(name: string, files: string[] = [noFiles]) {
    ChangeListView.tree[name] = {
      ...files?.reduce((acc: any, item) => {
        acc[item] = {};

        return acc;
      }, {}),
    };
  }

  public removeChangelist(name: string) {
    delete ChangeListView.tree[name];
    delete ChangeListView.nodes[name];
  }

  public renameChangelist(name: string, newName: string) {
    const content = ChangeListView.tree[name];

    ChangeListView.tree[newName] = content;
    delete ChangeListView.tree[name];
    delete ChangeListView.nodes[name];
  }

  public addFileToChangelist(name: string, file: string) {
    const changelist = ChangeListView.tree[name];

    if (!changelist) {
      return;
    }

    if (Object.keys(changelist).includes(file)) {
      return;
    }

    changelist[file] = {};

    if (file !== noFiles && Object.keys(changelist).includes(noFiles)) {
      delete changelist[noFiles];
    }
  }

  public removeFileFromChangelist(name: string, file: string) {
    const changelist = ChangeListView.tree[name];

    if (!changelist) {
      return;
    }

    if (!Object.keys(changelist).includes(file)) {
      return;
    }

    delete changelist[file];
  }
}

const debugTree: any = {
  /* a: {
    aa: {},
    ab: {},
  },
  b: {
    ba: {},
    bb: {},
  }, */
};

class ChangelistsTreeDataProvider implements vscode.TreeDataProvider<Key> {
  private _onDidChangeTreeData: vscode.EventEmitter<
    any | undefined | null | void
  > = new vscode.EventEmitter<any | undefined | null | void>();
  public readonly onDidChangeTreeData: vscode.Event<
    any | undefined | null | void
  > = this._onDidChangeTreeData.event;

  refresh(): void {
    ChangeListView.provider._onDidChangeTreeData.fire(undefined);
  }

  getChildren(element: { key: string }): Key[] {
    return getChildren(element?.key)
      .map((key) => getNode(key))
      .filter((item) => item !== undefined) as Key[];
  }

  getTreeItem(element: { key: string }): vscode.TreeItem {
    const treeItem = getTreeItem(element.key);
    treeItem.id =
      element.key === noFiles
        ? Math.floor(Math.random() * 1000).toString()
        : element.key;
    return treeItem;
  }

  getParent({ key }: { key: string }): { key: string } | undefined {
    const parentKey = key.substring(0, key.length - 1);
    return parentKey ? new Key(parentKey) : undefined;
  }
}

function getChildren(key: string | undefined): string[] {
  if (!key) {
    return Object.keys(ChangeListView.tree);
  }
  const treeElement = getTreeElement(key);
  if (treeElement) {
    return Object.keys(treeElement);
  }
  return [];
}

function getTreeItem(key: string): vscode.TreeItem {
  const treeElement = getTreeElement(key);
  // An example of how to use codicons in a MarkdownString in a tree item tooltip.
  const isChangelistItem = Object.keys(ChangeListView.tree).includes(key);

  const tooltip = isChangelistItem
    ? new vscode.MarkdownString(`$(zap) Changelist: ${key}`, true)
    : `Filename: ${key}`;
  return {
    label: <vscode.TreeItemLabel>{
      label: key,
    },
    tooltip,
    contextValue: isChangelistItem ? 'changelist' : 'filePath',
    iconPath: isChangelistItem
      ? folderIcon
      : key === noFiles
      ? undefined
      : documentIcon,
    collapsibleState:
      treeElement && Object.keys(treeElement).length
        ? vscode.TreeItemCollapsibleState.Collapsed
        : vscode.TreeItemCollapsibleState.None,
  };
}

function getTreeElement(element: string): any {
  const parent = ChangeListView.tree;

  if (!parent[element]) {
    return null;
  }

  return parent[element];
}

function getNode(key: string): Key | undefined {
  if (!ChangeListView.nodes[key]) {
    ChangeListView.nodes[key] = new Key(key);
  }

  return ChangeListView.nodes[key];
}

class Key {
  constructor(readonly key: string) {}
}
