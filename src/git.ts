import * as vscode from 'vscode';
import * as path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { ChangedFile } from './state';

const execFileAsync = promisify(execFile);

function getWorkspaceRoot(): string | undefined {
    return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
}

async function getRepositoryRoot(): Promise<string | undefined> {
    const workspaceRoot = getWorkspaceRoot();
    if (!workspaceRoot) {
        return undefined;
    }

    try {
        const { stdout } = await execFileAsync('git', ['rev-parse', '--show-toplevel'], { cwd: workspaceRoot });
        return path.resolve(stdout.trim());
    } catch {
        return undefined;
    }
}

function getRepositoryRelativePath(repositoryRoot: string, filePath: string): string | undefined {
    const relativePath = path.relative(repositoryRoot, path.resolve(filePath));
    if (relativePath === '..' || relativePath.startsWith(`..${path.sep}`) || path.isAbsolute(relativePath)) {
        return undefined;
    }

    // Git revision paths always use forward slashes, including on Windows.
    return relativePath.split(path.sep).join('/');
}

export async function getBranches(): Promise<string[]> {
    const cwd = await getRepositoryRoot();
    if (!cwd) {
        return [];
    }
    const { stdout } = await execFileAsync('git', ['branch', '-a', '--format=%(refname:short)'], { cwd });
    return stdout
        .trim()
        .split('\n')
        .filter(b => b.length > 0);
}

export async function getCurrentBranch(): Promise<string | undefined> {
    const cwd = await getRepositoryRoot();
    if (!cwd) {
        return undefined;
    }
    try {
        const { stdout } = await execFileAsync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd });
        return stdout.trim();
    } catch {
        return undefined;
    }
}

export interface DiffHunk {
    startLine: number;
    lineCount: number;
    type: 'added' | 'modified' | 'deleted';
}

export async function getFileDiff(filePath: string, branch: string): Promise<DiffHunk[]> {
    const cwd = await getRepositoryRoot();
    if (!cwd) {
        return [];
    }

    const relativePath = getRepositoryRelativePath(cwd, filePath);
    if (relativePath === undefined) {
        return [];
    }

    try {
        const { stdout } = await execFileAsync('git', ['diff', '--unified=0', branch, '--', relativePath], {
            cwd,
            maxBuffer: 10 * 1024 * 1024
        });
        return parseDiffOutput(stdout);
    } catch {
        return [];
    }
}

export async function getFileContentAtBranch(filePath: string, branch: string): Promise<string | undefined> {
    const cwd = await getRepositoryRoot();
    if (!cwd) {
        return undefined;
    }

    const relativePath = getRepositoryRelativePath(cwd, filePath);
    if (relativePath === undefined) {
        return undefined;
    }

    try {
        const { stdout } = await execFileAsync('git', ['show', `${branch}:${relativePath}`], {
            cwd,
            maxBuffer: 10 * 1024 * 1024
        });
        return stdout;
    } catch {
        return undefined;
    }
}

function parseDiffOutput(diffOutput: string): DiffHunk[] {
    const hunks: DiffHunk[] = [];
    const hunkHeaderRegex = /^@@\s+-(\d+)(?:,(\d+))?\s+\+(\d+)(?:,(\d+))?\s+@@/;

    for (const line of diffOutput.split('\n')) {
        const match = hunkHeaderRegex.exec(line);
        if (!match) {
            continue;
        }

        const oldStart = parseInt(match[1], 10);
        const oldCount = match[2] !== undefined ? parseInt(match[2], 10) : 1;
        const newStart = parseInt(match[3], 10);
        const newCount = match[4] !== undefined ? parseInt(match[4], 10) : 1;

        if (oldCount === 0 && newCount > 0) {
            hunks.push({ startLine: newStart, lineCount: newCount, type: 'added' });
        } else if (oldCount > 0 && newCount === 0) {
            hunks.push({ startLine: newStart, lineCount: 1, type: 'deleted' });
        } else {
            hunks.push({ startLine: newStart, lineCount: newCount, type: 'modified' });
        }
    }

    return hunks;
}

export async function getChangedFiles(branch: string): Promise<ChangedFile[]> {
    const cwd = await getRepositoryRoot();
    const workspaceRoot = getWorkspaceRoot();
    if (!cwd || !workspaceRoot) {
        return [];
    }

    const workspacePath = getRepositoryRelativePath(cwd, workspaceRoot);
    if (workspacePath === undefined) {
        return [];
    }

    try {
        const { stdout } = await execFileAsync('git', ['diff', '--name-status', branch, '--', workspacePath || '.'], {
            cwd,
            maxBuffer: 10 * 1024 * 1024
        });

        const files: ChangedFile[] = [];
        for (const line of stdout.trim().split('\n')) {
            if (!line) {
                continue;
            }
            const parts = line.split('\t');
            const rawStatus = parts[0].charAt(0);
            const relativePath = parts[parts.length - 1];
            const absolutePath = path.join(cwd, relativePath);

            let status: ChangedFile['status'];
            if (rawStatus === 'A') {
                status = 'added';
            } else if (rawStatus === 'D') {
                status = 'deleted';
            } else if (rawStatus === 'R') {
                status = 'renamed';
            } else {
                status = 'modified';
            }

            files.push({ relativePath, absolutePath, status });
        }
        return files;
    } catch {
        return [];
    }
}

export async function getUncommittedChanges(filePath: string): Promise<Set<number>> {
    const cwd = await getRepositoryRoot();
    if (!cwd) {
        return new Set();
    }

    const relativePath = getRepositoryRelativePath(cwd, filePath);
    if (relativePath === undefined) {
        return new Set();
    }

    try {
        const { stdout } = await execFileAsync('git', ['diff', '--unified=0', 'HEAD', '--', relativePath], {
            cwd,
            maxBuffer: 10 * 1024 * 1024
        });
        const hunks = parseDiffOutput(stdout);
        const lines = new Set<number>();
        for (const hunk of hunks) {
            for (let i = 0; i < hunk.lineCount; i++) {
                lines.add(hunk.startLine + i);
            }
        }
        return lines;
    } catch {
        return new Set();
    }
}
