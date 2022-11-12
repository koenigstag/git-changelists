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
    }
  ) {}

  refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }

  getChildren(element: { key: string }): Key[] {
    return this._getChildren(element?.key)
      .map((key) => this._getNode(key))
      .filter((item) => item !== undefined) as Key[];
  }

  _getChildren(key: string | undefined): string[] {
    if (!key) {
      return Object.keys(this.parent.tree);
    }
    const treeElement = this._getTreeElement(key);
    if (treeElement) {
      return Object.keys(treeElement);
    }
    return [];
  }

  getTreeItem(element: { key: string }): vscode.TreeItem {
    const treeItem = this._getTreeItem(element.key);
    treeItem.id =
      element.key === noFilesPlaceholder
        ? Math.floor(Math.random() * 1000).toString()
        : element.key;
    return treeItem;
  }

  _getTreeItem(key: string): vscode.TreeItem {
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
      collapsibleState:
        treeElement && Object.keys(treeElement).length
          ? vscode.TreeItemCollapsibleState.Collapsed
          : vscode.TreeItemCollapsibleState.None,
    };
  }

  _getTreeElement(element: string): any {
    const parent = this.parent.tree;

    if (!parent[element]) {
      return null;
    }

    return parent[element];
  }

  getParent({ key }: { key: string }): { key: string } | undefined {
    const parentKey = key.substring(0, key.length - 1);
    return parentKey ? new Key(parentKey) : undefined;
  }

  _getNode(key: string): Key | undefined {
    if (!this.parent.nodes[key]) {
      this.parent.nodes[key] = new Key(key);
    }

    return this.parent.nodes[key];
  }
}

export class Key {
  constructor(readonly key: string) {}
}
