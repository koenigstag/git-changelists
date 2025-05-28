import * as vscode from 'vscode';
import { emptySymbol, noFilesPlaceholder } from '../constants';
import { folderIcon } from '../constants/icons';
import { logger } from '../core/logger';
import { TreeType } from './ChangelistView';

export class Key {
  constructor(readonly key: string, readonly uri?: vscode.Uri) {}
}

export class ChangelistsTreeDataProvider
  implements vscode.TreeDataProvider<Key>
{
  private _onDidChangeTreeData: vscode.EventEmitter<
    any | undefined | null | void
  > = new vscode.EventEmitter<any | undefined | null | void>();
  public readonly onDidChangeTreeData: vscode.Event<
    any | undefined | null | void
  > = this._onDidChangeTreeData.event;

  constructor(
    private readonly parent: {
      tree: TreeType;
      nodes: TreeType;
    },
    private readonly id: string,
    private readonly workspacePath: vscode.Uri
  ) {
    vscode.commands.registerCommand(`${id}.openFile`, (resource: vscode.Uri) => {
      logger.appendLine(`openResource-openFile: ${resource.fsPath}`);

      this.openResource(resource);
    });
  }

  private openResource(resource: vscode.Uri): void {
    vscode.window.showTextDocument(resource);
  }

  refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }

  getChildren(element: Key): Key[] {
    return this._getChildren(element)
      .map((key) => {
        const path = vscode.Uri.joinPath(this.workspacePath, key).fsPath;
        return this._getNode(key, vscode.Uri.file(path));
      })
      .filter((item) => item !== undefined) as Key[];
  }

  _getChildren(element?: Key): string[] {
    if (!element?.key) {
      return Object.keys(this.parent.tree);
    }
    const treeElement = this._getTreeElement(element.key);
    if (treeElement) {
      return Object.keys(treeElement);
    }
    return [];
  }

  getTreeItem(element: Key): vscode.TreeItem {
    const treeItem = this._getTreeItem(element.key, element.uri);
    treeItem.id =
      element.key === noFilesPlaceholder
        ? Math.floor(Math.random() * 1000).toString()
        : element.key;
    return treeItem;
  }

  _getTreeItem(key: string, uri?: vscode.Uri): vscode.TreeItem {
    const isChangelistItem = Object.keys(this.parent.tree).includes(key);

    const treeElement = this._getTreeElement(key);
    const elemCopy: any = Object.assign({}, treeElement);

    delete elemCopy[noFilesPlaceholder];

    const fileCount = Object.keys(elemCopy ?? {}).length;

    const item = isChangelistItem
      ? new ChangelistFolder(key, fileCount)
      : new ChangelistFile(key, this.id, uri);

    return item;
  }

  _getTreeElement(key: string): Key | null {
    const parent = this.parent.tree;

    if (!parent[key]) {
      return null;
    }

    return parent[key];
  }

  getParent({ key, uri }: Key): Key | undefined {
    const parentKey = key.substring(0, key.length - 1);
    return parentKey ? new Key(parentKey, uri) : undefined;
  }

  _getNode(key: string, uri?: vscode.Uri): Key | undefined {
    if (!this.parent.nodes[key]) {
      this.parent.nodes[key] = new Key(key, uri);
    }

    return this.parent.nodes[key];
  }
}

export class ChangelistFolder implements vscode.TreeItem {
  contextValue = 'changelist';
  iconPath = folderIcon;
  tooltip = new vscode.MarkdownString(`$(zap) Changelist: ${this.key}`, true);
  label: string;
  collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;

  constructor(readonly key: string, fileCount: number) {
    this.label = `${key}${emptySymbol}(${fileCount} file${
      fileCount > 1 || fileCount === 0 ? 's' : ''
    })`;
  }
}

export class ChangelistFile implements vscode.TreeItem {
  contextValue = 'filePath';
  label = this.key;
  resourceUri?: vscode.Uri | undefined;
  tooltip = `Filename: ${this.key}`;
  command?: vscode.Command;

  constructor(readonly key: string, id: string, readonly uri?: vscode.Uri) {
    this.resourceUri = uri;
    this.command =
      key === noFilesPlaceholder
        ? undefined
        : {
            command: `${id}.openFile`,
            title: 'Open File',
            arguments: [uri],
          };
  }
}
