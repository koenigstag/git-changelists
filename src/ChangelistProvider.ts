import * as vscode from 'vscode';
import { noFilesPlaceholder } from './constants';
import { documentIcon, folderIcon } from './constants/icons';

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
      tree: { [key: string]: any };
      nodes: { [key: string]: any };
    },
    private readonly id: string,
    private readonly workspacePath: string,
  ) {


    vscode.commands.registerCommand(`${id}.openFile`, (resource) => this.openResource(resource));
  }

  private openResource(resource: vscode.Uri): void {
		vscode.window.showTextDocument(resource);
	}

  refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }

  getChildren(element: Key): Key[] {
    return this._getChildren(element)
      .map((key) => this._getNode(key, vscode.Uri.file(`${this.workspacePath}/${key}`)))
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
    const treeElement = this._getTreeElement(key);
    // An example of how to use codicons in a MarkdownString in a tree item tooltip.
    const isChangelistItem = Object.keys(this.parent.tree).includes(key);

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
        : key === noFilesPlaceholder
        ? undefined
        : documentIcon,
      command: isChangelistItem || key === noFilesPlaceholder ? undefined : { command: `${this.id}.openFile`, title: "Open File", arguments: [uri], },
      collapsibleState:
        treeElement && Object.keys(treeElement).length
          ? vscode.TreeItemCollapsibleState.Collapsed
          : vscode.TreeItemCollapsibleState.None,
    };
  }

  _getTreeElement(key: string): any {
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

export class Key {
  constructor(readonly key: string, readonly uri?: vscode.Uri) {}
}
