import * as vscode from 'vscode';
import { ChangedFile, diffState } from './state';
import { getFileContentAtBranch } from './git';
import * as path from 'path';

export class DiffFileItem extends vscode.TreeItem {
    constructor(
        readonly file: ChangedFile,
        private readonly branch: string,
        readonly workspaceRoot: string
    ) {
        super(path.basename(file.relativePath), vscode.TreeItemCollapsibleState.None);

        this.description = path.dirname(file.relativePath) === '.' ? '' : path.dirname(file.relativePath);
        this.tooltip = file.relativePath;
        this.contextValue = 'diffFile';

        if (file.status === 'added') {
            this.iconPath = new vscode.ThemeIcon('diff-added', new vscode.ThemeColor('diffLens.addedForeground'));
        } else if (file.status === 'deleted') {
            this.iconPath = new vscode.ThemeIcon('diff-removed', new vscode.ThemeColor('diffLens.deletedForeground'));
        } else if (file.status === 'renamed') {
            this.iconPath = new vscode.ThemeIcon('diff-renamed', new vscode.ThemeColor('diffLens.renamedForeground'));
        } else {
            this.iconPath = new vscode.ThemeIcon('diff-modified', new vscode.ThemeColor('diffLens.modifiedForeground'));
        }

        if (file.status !== 'deleted') {
            this.command = {
                command: 'diffLens.openFileDiff',
                title: 'Show Diff',
                arguments: [file, branch]
            };
            this.resourceUri = vscode.Uri.file(file.absolutePath);
        }
    }
}

class SectionItem extends vscode.TreeItem {
    constructor(label: string, public readonly children: DiffFileItem[]) {
        super(label, vscode.TreeItemCollapsibleState.Expanded);
        this.contextValue = 'section';
        const count = children.length;
        this.description = `${count} file${count !== 1 ? 's' : ''}`;
    }
}

type TreeNode = SectionItem | DiffFileItem;

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
        if (element instanceof SectionItem) {
            return element.children;
        }

        const branch = diffState.branch;
        if (!branch) {
            return [];
        }

        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? '';
        const files = diffState.files;

        const added = files.filter(f => f.status === 'added')
            .map(f => new DiffFileItem(f, branch, workspaceRoot));
        const modified = files.filter(f => f.status === 'modified' || f.status === 'renamed')
            .map(f => new DiffFileItem(f, branch, workspaceRoot));
        const deleted = files.filter(f => f.status === 'deleted')
            .map(f => new DiffFileItem(f, branch, workspaceRoot));

        const sections: SectionItem[] = [];
        if (modified.length > 0) {
            sections.push(new SectionItem('Modified', modified));
        }
        if (added.length > 0) {
            sections.push(new SectionItem('Added', added));
        }
        if (deleted.length > 0) {
            sections.push(new SectionItem('Deleted', deleted));
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
        `diff-lens:${file.relativePath}?branch=${encodeURIComponent(branch)}&ts=${Date.now()}`
    );

    const registration = vscode.workspace.registerTextDocumentContentProvider('diff-lens', {
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
