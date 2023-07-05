import { readFile, writeFile } from 'fs/promises';
import { resolve } from 'path';
import {
  changelistNameRegex,
  changelistStartRegex,
  removeSpecialSymbs,
  workzoneEndRegex,
  workzoneStartRegex,
} from '../constants/regexp';
import { contentToLines, linesToText } from '../utils/string.utils';
import { GitCommandsManager } from './GitCommands';
import { GitCommandNamesEnum } from '../enum/git-commands.enum';

export type Changelist = { lineIndex: number; name: string; files: string[] };
export type WorkzoneIndexes = { startIndex: number; endIndex: number };

export class GitExcludeParse {
  content: string = '';

  constructor(private readonly gitRootPath: string) {}

  async getGitStatus(): Promise<string[]> {
    try {
      const status = await GitCommandsManager.execAsync(
        GitCommandNamesEnum.status,
        resolve(this.gitRootPath, '../')
      );

      return contentToLines(status);
    } catch (error) {
      return [];
    }
  }

  async getExcludeContent(): Promise<string> {
    this.content = await FSAPI.getExcludeContent(this.gitRootPath);

    return this.content;
  }

  async getExcludeContentLines(): Promise<string[]> {
    const content = await this.getExcludeContent();

    const lines = contentToLines(content);

    return lines;
  }

  static getWorkzoneIndexes(contentLines: string[]): WorkzoneIndexes {
    const startIndex = contentLines.findIndex((line) =>
      workzoneStartRegex.test(line.trim())
    );
    const endIndex = contentLines.findIndex((line) =>
      workzoneEndRegex.test(line.trim())
    );

    if (startIndex === -1 || endIndex === -1) {
      throw new RangeError('Workzone not found');
    }

    return { startIndex, endIndex };
  }

  getWorkzoneLines(contentLines: string[]): string[] {
    const { startIndex, endIndex } =
      GitExcludeParse.getWorkzoneIndexes(contentLines);

    return contentLines.slice(startIndex + 1, endIndex);
  }

  checkIfWorkzoneExists(contentLines: string[]): boolean {
    try {
      GitExcludeParse.getWorkzoneIndexes(contentLines);

      return true;
    } catch (error) {
      return false;
    }
  }

  transformChangelistArrayToTree(changelists: Changelist[]): object {
    const tree = new Map<string, { [key: string]: any }>();
    changelists.forEach((item) => {
      tree.set(item.name, {
        ...item.files
          .map((file) => ({ [file]: {} }))
          .reduce((acc, item) => {
            return Object.assign(acc, item);
          }, {}),
      });
    });

    return Object.fromEntries(tree);
  }

  getChangelistArrayFromContent(contentLines: string[]): Changelist[] {
    const workzoneLines = this.getWorkzoneLines(contentLines);

    const changeLists: Changelist[] = [];

    // TODO refactor to single loop
    workzoneLines.forEach((line, index) => {
      if (changelistStartRegex.test(line.trim())) {
        const name = changelistStartRegex.exec(line.trim()) as any;
        changeLists.push({ lineIndex: index, name: name[1], files: [] });
      }
    });

    const withFiles: Changelist[] = changeLists.map((item, index, arr) => {
      const nextIndex =
        arr[index + 1]?.lineIndex < workzoneLines.length
          ? arr[index + 1]?.lineIndex
          : workzoneLines.length;
      const files = workzoneLines
        .slice(item.lineIndex + 1, nextIndex)
        .filter((file) => file.trim() !== '');

      return { ...item, files };
    });

    return withFiles;
  }

  getOtherContent(originalContent: string): string {
    const lines = contentToLines(originalContent);

    const { startIndex, endIndex } = GitExcludeParse.getWorkzoneIndexes(lines);

    return linesToText([
      linesToText(lines.slice(0, startIndex)).trim(),
      linesToText(lines.slice(endIndex + 1, lines.length)).trim(),
    ]);
  }
}

export class GitExcludeStringify {
  constructor(private readonly gitRootPath: string) {}

  prepareExcludeContent(oldContent: string, tree: { [key: string]: any } = {}) {
    const startWZLine = removeSpecialSymbs(workzoneStartRegex.source);
    const endWZLine = removeSpecialSymbs(workzoneEndRegex.source);

    const text = this.treeToText(tree);

    return `${oldContent.trim()}

${startWZLine}
${text}

${endWZLine}
`;
  }

  treeToLines(tree: { [key: string]: any }) {
    return Object.entries(tree)
      .map(([name, items]) => {
        return [
          '\n' +
            removeSpecialSymbs(
              changelistStartRegex.source.replace(
                changelistNameRegex.source,
                name
              )
            ),
          ...Object.keys(items),
        ];
      })
      .flat(2);
  }

  treeToText(tree: { [key: string]: any }) {
    return linesToText(this.treeToLines(tree));
  }

  // unused
  replaceWorkzoneInContent(contentLines: string[], treeLines: string[]) {
    const { startIndex, endIndex } =
      GitExcludeParse.getWorkzoneIndexes(contentLines);

    contentLines.splice(
      startIndex + 1,
      endIndex - startIndex - 1,
      ...treeLines
    );

    return contentLines;
  }

  // unused
  async writeNewExcludeContent(treeLines: string[]) {
    const content = await FSAPI.getExcludeContent(this.gitRootPath);

    const lines = contentToLines(content);

    const newLines = this.replaceWorkzoneInContent(lines, treeLines);

    await FSAPI.writeExclude(this.gitRootPath, newLines.join('\n'));
  }
}

export class FSAPI {
  static filePath = '/info/exclude';

  static async getExcludeContent(gitRootPath: string) {
    return await readFile(`${gitRootPath}/${FSAPI.filePath}`, 'utf-8');
  }

  // unused
  static async writeExclude(gitRootPath: string, content: string) {
    return await writeFile(
      `${gitRootPath}/${FSAPI.filePath}`,
      content,
      'utf-8'
    );
  }
}
