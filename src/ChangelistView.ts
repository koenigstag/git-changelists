import {
  window,
  TreeView,
  ExtensionContext,
  Range,
  Position,
  workspace,
  WorkspaceEdit,
  Uri,
} from 'vscode';
import { sep, posix } from 'path';
import { GitExcludeParse, GitExcludeStringify } from './GitExclude';
import { contentToLines, getRelativeExcludePath, transformPath } from './utils';
import { ChangelistsTreeDataProvider, Key } from './ChangelistProvider';
import { emptySymbol, noFilesPlaceholder } from './constants';
import {
  askToInitAnswers,
  askToInitExtFiles,
  cannotReadContent,
  cannotWriteContent,
} from './constants/messages';
import { store } from './store';

export class ChangeListView {
  static view: TreeView<{
    key: string;
  }>;

  static provider: ChangelistsTreeDataProvider;

  static tree: { [key: string]: any } = {};
  static nodes: { [key: string]: Key | undefined } = {};

  parser: GitExcludeParse;
  stringify: GitExcludeStringify;

  public async refresh(fromFile?: boolean) {
    if (fromFile) {
      try {
        await this.loadTreeFile();

        store.gitRepoFound = true;
      } catch (error) {
        window.showErrorMessage(cannotReadContent);
        store.gitRepoFound = false;

        return;
      }
    }
    ChangeListView.provider.refresh();
  }

  constructor(
    context: ExtensionContext,
    public readonly config: { id: string; gitRootPath: string }
  ) {
    const { id, gitRootPath } = this.config;

    this.parser = new GitExcludeParse(gitRootPath);
    this.stringify = new GitExcludeStringify(gitRootPath);
    ChangeListView.provider = new ChangelistsTreeDataProvider(
      ChangeListView,
      id,
      gitRootPath.replace('.git', '')
    );

    ChangeListView.view = window.createTreeView(id, {
      treeDataProvider: ChangeListView.provider,
      showCollapseAll: true,
      canSelectMany: true,
    });
    context.subscriptions.push(ChangeListView.view);

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

          await this.refresh(true);
        }, 300);
      }
    });
  }

  public async isUntracked(filePath: string, lines?: string[]) {
    const gitStatusLines = lines ?? await this.parser.getGitStatus();
    
    return gitStatusLines.some((line) => {
      const status = line.trimStart().split(' ').at(0);

      return status === '??' && line.includes(filePath);
    });
  }

  public async loadTreeFile() {
    const lines = await this.parser.getExcludeContentLines();

    if (!this.parser.checkIfWorkzoneExists(lines)) {
      return;
    } else {
      const lists = this.parser.getChangelistArrayFromContent(lines);
      const tree = this.parser.transformChangelistArrayToTree(lists);

      ChangeListView.tree = Object.assign({}, tree, debugTree);
    }
  }

  public async onTreeChange() {
    try {
      await this.writeTreeToExclude();
    } catch (error) {
      window.showErrorMessage(cannotWriteContent);
    }
  }

  public transformChangelistName(name: string) {
    if (name.includes(emptySymbol)) {
      return name.split(RegExp(emptySymbol)).at(0) ?? name;
    }

    return name;
  }

  public addNewChangelist(
    name: string,
    files: string[] = [/* noFilesPlaceholder */]
  ) {
    const transName = this.transformChangelistName(name);

    ChangeListView.tree[transName] = {
      ...files?.reduce((acc: any, item) => {
        acc[item] = {};

        return acc;
      }, {}),
    };
  }

  public removeChangelist(name: string) {
    const transName = this.transformChangelistName(name);

    delete ChangeListView.tree[transName];
    delete ChangeListView.nodes[transName];
  }

  public renameChangelist(name: string, newName: string) {
    const transName = this.transformChangelistName(name);

    const content = ChangeListView.tree[transName];

    ChangeListView.tree[newName] = content;
    delete ChangeListView.tree[transName];
    delete ChangeListView.nodes[transName];
  }

  public addFileToChangelist(name: string, file: string) {
    const transName = this.transformChangelistName(name);

    const changelist = ChangeListView.tree[transName];

    const filePath = transformPath(file);

    if (!changelist) {
      return;
    }

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
  }

  public removeFileFromChangelist(name: string, file: string) {
    const transName = this.transformChangelistName(name);

    const changelist = ChangeListView.tree[transName];

    if (!changelist) {
      return;
    }

    if (!Object.keys(changelist).includes(file)) {
      return;
    }

    delete changelist[file];
  }

  public async isExcludeInitialized() {
    let lines;

    try {
      lines = await this.parser.getExcludeContentLines();
      store.gitRepoFound = true;
    } catch (error) {
      window.showErrorMessage(cannotReadContent);
      store.gitRepoFound = false;

      throw error;
    }

    return this.parser.checkIfWorkzoneExists(lines);
  }

  public async askToInitExcludeFile() {
    const answers = Object.keys(askToInitAnswers).filter((item) =>
      isNaN(Number(item))
    );

    const choice = await window.showQuickPick(answers, {
      title: askToInitExtFiles,
    });

    if (choice === askToInitAnswers.yes) {
      try {
        await this.initExcludeFile();

        return true;
      } catch (error) {
        window.showErrorMessage(cannotWriteContent);
      }
    }

    return false;
  }

  /* IO methods */

  public async initExcludeFile() {
    const oldContent = await this.parser.getExcludeContent();

    const newContent = this.stringify.prepareExcludeContent(oldContent, {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      Changes: { /* [noFilesPlaceholder]: {} */ },
    });

    await this.writeTextToExcludeFile(oldContent, newContent);
  }

  public async writeTextToExcludeFile(oldContent: string, newContent: string) {
    if (newContent === oldContent) {
      return;
    }

    const oldLines = contentToLines(oldContent);

    const wsEdit = new WorkspaceEdit();

    const fileUri = Uri.file(getRelativeExcludePath(this.config.gitRootPath));

    wsEdit.replace(
      fileUri,
      new Range(new Position(0, 0), new Position(oldLines.length - 1, 0)),
      newContent
    );

    await workspace.applyEdit(wsEdit);
  }

  public async writeTreeToExclude() {
    const oldContent = await this.parser.getExcludeContent();

    const otherContent = this.parser.getOtherContent(oldContent);

    const newContent = this.stringify.prepareExcludeContent(
      otherContent,
      ChangeListView.tree
    );

    await this.writeTextToExcludeFile(oldContent, newContent);
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
