import * as fs from 'fs/promises';

export const getExcludeContent = async (gitRootPath: string) => {
  return await fs.readFile(`${gitRootPath}/info/exclude`, 'utf-8');
};

export const checkIfWorkzoneExists = (content: string) => {
  try {
    const lines = content.split(newLineRegex);

    const workzone = getExtensionWorkzone(lines);
    return true;
  } catch (error) {
    return false;
  }
};

export const prepareExcludeFile = async (content: string) => {
  return `${content.trim()}\n\n# ==== GIT CHANGELISTS ====\n\n# ==== END: GIT CHANGELISTS ====\n`;
};

export const newLineRegex = /\r?\n/;
const changelistStartRegex = /^# ==== ([\w ]+) ====$/;
export const getChangelists = (
  content: string
): {
  lineIndex: number;
  name: string;
  files: string[];
}[] => {
  const lines = content.split(newLineRegex);

  const workzoneLines = getExtensionWorkzone(lines);

  const changeLists: { lineIndex: number; name: string; files?: string[] }[] =
    [];
  workzoneLines.forEach((line, index) => {
    if (changelistStartRegex.test(line.trim())) {
      const name = changelistStartRegex.exec(line.trim()) as any;
      changeLists.push({ lineIndex: index, name: name[1] });
    }
  });

  const withFiles: { lineIndex: number; name: string; files: string[] }[] =
    changeLists.map((item, index, arr) => {
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
};

export const transformChangelistToTree = (
  list: { name: string; files: string[] }[]
) => {
  const tree = new Map<string, { [key: string]: any }>();
  list.forEach((item) => {
    tree.set(item.name, {
      ...item.files
        .map((file) => ({ [file]: {} }))
        .reduce((acc, item) => {
          return Object.assign(acc, item);
        }, {}),
    });
  });

  return Object.fromEntries(tree);
};

const workzoneStartRegex = /^# ==== GIT CHANGELISTS ====$/;
export const getWorkzoneStartIndex = (lines: string[]) => {
  return lines.findIndex((line) => workzoneStartRegex.test(line.trim()));
};

const workzoneEndRegex = /^# ==== END: GIT CHANGELISTS ====$/;
export const getWorkzoneEndIndex = (lines: string[]) => {
  return lines.findIndex((line) => workzoneEndRegex.test(line.trim()));
};

export const getExtensionWorkzone = (lines: string[]) => {
  const startIndex = getWorkzoneStartIndex(lines);
  const endIndex = getWorkzoneEndIndex(lines);

  if (startIndex === -1 || endIndex === -1) {
    throw new RangeError('Workzone not found');
  }

  return lines.slice(startIndex + 1, endIndex);
};

export const treeToLines = (tree: { [key: string]: any }) => {
  return Object.entries(tree)
    .map(([name, items]) => {
      return [`# ==== ${name} ====`, Object.keys(items)];
    })
    .flat(2);
};

export const treeToText = (tree: { [key: string]: any }) => {
  return treeToLines(tree).join('\n');
};

export const getWorkzoneIndexes = async (gitRootPath: string) => {
  const content = await getExcludeContent(gitRootPath);

  const contentLines = content.split(newLineRegex);

  const startIndex = getWorkzoneStartIndex(contentLines);
  const endIndex = getWorkzoneEndIndex(contentLines);

  return { startIndex, endIndex };
};

export const replaceWorkzoneInContent = (
  contentLines: string[],
  treeLines: string[]
) => {
  const startIndex = getWorkzoneStartIndex(contentLines);
  const endIndex = getWorkzoneEndIndex(contentLines);

  contentLines.splice(startIndex + 1, endIndex - startIndex - 1, ...treeLines);

  return contentLines;
};

export const writeNewExcludeContent = async (
  gitRootPath: string,
  treeLines: string[]
) => {
  const content = await getExcludeContent(gitRootPath);

  const lines = content.split(newLineRegex);

  const newLines = replaceWorkzoneInContent(lines, treeLines);

  await writeExclude(gitRootPath, newLines.join('\n'));
};

export const writeExclude = async (gitRootPath: string, content: string) => {
  await fs.writeFile(gitRootPath, content, 'utf-8');
};
