import * as vscode from 'vscode';
import { ChangedFile, diffState } from './state';
import { getFileContentAtBranch } from './git';
import * as path from 'path';

export class DiffFileItem extends vscode.TreeItem {
    constructor(
        readonly file: ChangedFile,
        branch: string
    ) {
        super(path.basename(file.relativePath), vscode.TreeItemCollapsibleState.None);

        this.tooltip = file.relativePath;
        this.contextValue = 'diffFile';

        if (file.status === 'added') {
            this.iconPath = new vscode.ThemeIcon('diff-added', new vscode.ThemeColor('diffMark.addedForeground'));
        } else if (file.status === 'deleted') {
            this.iconPath = new vscode.ThemeIcon('diff-removed', new vscode.ThemeColor('diffMark.deletedForeground'));
        } else if (file.status === 'renamed') {
            this.iconPath = new vscode.ThemeIcon('diff-renamed', new vscode.ThemeColor('diffMark.renamedForeground'));
        } else {
            this.iconPath = new vscode.ThemeIcon('diff-modified', new vscode.ThemeColor('diffMark.modifiedForeground'));
        }

        if (file.status !== 'deleted') {
            this.command = {
                command: 'diffMark.openChangedFile',
                title: 'Open Changed File',
                arguments: [file, branch]
            };
            this.resourceUri = vscode.Uri.file(file.absolutePath);
        }
    }
}

class FolderItem extends vscode.TreeItem {
    constructor(
        label: string,
        public readonly children: (FolderItem | DiffFileItem)[]
    ) {
        super(label, vscode.TreeItemCollapsibleState.Expanded);
        this.contextValue = 'folder';
    }
}

class SectionItem extends vscode.TreeItem {
    constructor(
        label: string,
        public readonly children: (FolderItem | DiffFileItem)[],
        count: number
    ) {
        super(label, vscode.TreeItemCollapsibleState.Expanded);
        this.contextValue = 'section';
        this.description = `${count} file${count !== 1 ? 's' : ''}`;
    }
}

type TreeNode = SectionItem | FolderItem | DiffFileItem;

interface FolderTree {
    folders: Map<string, FolderTree>;
    files: ChangedFile[];
}

function buildFileTree(files: ChangedFile[], branch: string, workspaceRoot: string): (FolderItem | DiffFileItem)[] {
    const root: FolderTree = { folders: new Map(), files: [] };

    for (const file of files) {
        const folders = path.dirname(path.relative(workspaceRoot, file.absolutePath)).split(path.sep);
        let current = root;

        for (const folder of folders) {
            if (folder === '.') {
                continue;
            }
            let child = current.folders.get(folder);
            if (!child) {
                child = { folders: new Map(), files: [] };
                current.folders.set(folder, child);
            }
            current = child;
        }

        current.files.push(file);
    }

    const createItems = (tree: FolderTree): (FolderItem | DiffFileItem)[] => [
        ...[...tree.folders.entries()]
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([name, child]) => new FolderItem(name, createItems(child))),
        ...tree.files
            .sort((a, b) => path.basename(a.relativePath).localeCompare(path.basename(b.relativePath)))
            .map(file => new DiffFileItem(file, branch))
    ];

    return createItems(root);
}

export class DiffPanelProvider implements vscode.TreeDataProvider<TreeNode>, vscode.Disposable {
    private readonly _onDidChangeTreeData = new vscode.EventEmitter<TreeNode | undefined | void>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    private readonly _stateListener: vscode.Disposable;

    constructor() {
        this._stateListener = diffState.onDidChange(() => {
            this._onDidChangeTreeData.fire();
        });
    }

    getTreeItem(element: TreeNode): vscode.TreeItem {
        return element;
    }

    getChildren(element?: TreeNode): TreeNode[] {
        if (element instanceof SectionItem || element instanceof FolderItem) {
            return element.children;
        }

        const branch = diffState.branch;
        if (!branch) {
            return [];
        }

        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? '';
        const files = diffState.files;

        const added = files.filter(f => f.status === 'added');
        const modified = files.filter(f => f.status === 'modified' || f.status === 'renamed');
        const deleted = files.filter(f => f.status === 'deleted');

        const sections: SectionItem[] = [];
        if (modified.length > 0) {
            sections.push(new SectionItem('Modified', buildFileTree(modified, branch, workspaceRoot), modified.length));
        }
        if (added.length > 0) {
            sections.push(new SectionItem('Added', buildFileTree(added, branch, workspaceRoot), added.length));
        }
        if (deleted.length > 0) {
            sections.push(new SectionItem('Deleted', buildFileTree(deleted, branch, workspaceRoot), deleted.length));
        }

        return sections;
    }

    dispose(): void {
        this._stateListener.dispose();
        this._onDidChangeTreeData.dispose();
    }
}

export async function openFileDiff(file: ChangedFile, branch: string): Promise<void> {
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceRoot) {
        return;
    }

    if (file.status === 'added') {
        await vscode.commands.executeCommand('vscode.open', vscode.Uri.file(file.absolutePath));
        return;
    }

    const content = await getFileContentAtBranch(file.absolutePath, branch);
    if (content === undefined) {
        vscode.window.showInformationMessage('Could not read file from branch.');
        return;
    }

    const branchUri = vscode.Uri.parse(
        `diff-mark:${file.relativePath}?branch=${encodeURIComponent(branch)}&ts=${Date.now()}`
    );

    const registration = vscode.workspace.registerTextDocumentContentProvider('diff-mark', {
        provideTextDocumentContent: () => content
    });

    await vscode.commands.executeCommand(
        'vscode.diff',
        branchUri,
        vscode.Uri.file(file.absolutePath),
        `${path.basename(file.relativePath)} (${branch} ↔ Working Tree)`
    );

    setTimeout(() => registration.dispose(), 5000);
}

export async function openChangedFile(file: ChangedFile, branch: string): Promise<void> {
    const behavior = vscode.workspace.getConfiguration('diffMark').get<'diff' | 'file'>('fileClickBehavior', 'diff');
    if (behavior === 'file') {
        await vscode.commands.executeCommand('vscode.open', vscode.Uri.file(file.absolutePath));
        return;
    }

    await openFileDiff(file, branch);
}
