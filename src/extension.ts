import * as vscode from 'vscode';
import * as path from 'path';
import { getBranches, getCurrentBranch, getChangedFiles, getFileContentAtBranch } from './git';
import { applyDecorations, clearDecorations, createDecorationTypes, disposeDecorationTypes } from './decorations';
import { diffState } from './state';
import { DiffPanelProvider, openFileDiff } from './diffPanel';
import { BranchDiffFileDecorator } from './fileDecorator';

let statusBarItem: vscode.StatusBarItem;
let refreshTimeout: NodeJS.Timeout | undefined;

export function activate(context: vscode.ExtensionContext) {
    createDecorationTypes();

    const panelProvider = new DiffPanelProvider();
    const fileDecorator = new BranchDiffFileDecorator();

    context.subscriptions.push(
        panelProvider,
        fileDecorator,
        vscode.window.registerFileDecorationProvider(fileDecorator),
        vscode.window.registerTreeDataProvider('diffLensPanel', panelProvider)
    );

    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    statusBarItem.command = 'diffLens.selectBranch';
    context.subscriptions.push(statusBarItem);

    context.subscriptions.push(
        vscode.commands.registerCommand('diffLens.selectBranch', selectBranch),
        vscode.commands.registerCommand('diffLens.stop', stopHighlighting),
        vscode.commands.registerCommand('diffLens.showDiff', showDiffForCurrentFile),
        vscode.commands.registerCommand('diffLens.openFileDiff', openFileDiff),
        vscode.commands.registerCommand('diffLens.refresh', refreshAll)
    );

    context.subscriptions.push(
        vscode.window.onDidChangeActiveTextEditor(editor => {
            if (editor && diffState.branch) {
                scheduleRefresh(editor);
            }
        })
    );

    context.subscriptions.push(
        vscode.workspace.onDidChangeTextDocument(event => {
            const editor = vscode.window.activeTextEditor;
            if (editor && editor.document === event.document && diffState.branch) {
                scheduleRefresh(editor);
            }
        })
    );

    context.subscriptions.push(
        vscode.workspace.onDidSaveTextDocument(document => {
            const editor = vscode.window.activeTextEditor;
            if (editor && editor.document === document && diffState.branch) {
                scheduleRefresh(editor);
            }
        })
    );

    context.subscriptions.push({
        dispose: () => {
            disposeDecorationTypes();
            diffState.dispose();
            if (refreshTimeout) {
                clearTimeout(refreshTimeout);
            }
        }
    });
}

function scheduleRefresh(editor: vscode.TextEditor): void {
    if (refreshTimeout) {
        clearTimeout(refreshTimeout);
    }
    refreshTimeout = setTimeout(() => {
        const branch = diffState.branch;
        if (branch) {
            applyDecorations(editor, branch);
        }
    }, 300);
}

async function selectBranch(): Promise<void> {
    const [branches, currentBranch] = await Promise.all([getBranches(), getCurrentBranch()]);

    const items = branches
        .filter(b => b !== currentBranch)
        .map(b => ({ label: b }));

    if (items.length === 0) {
        vscode.window.showInformationMessage('No other branches found.');
        return;
    }

    const picked = await vscode.window.showQuickPick(items, {
        placeHolder: 'Select a branch to compare against'
    });

    if (!picked) {
        return;
    }

    await activateBranch(picked.label);
}

async function activateBranch(branch: string): Promise<void> {
    const files = await getChangedFiles(branch);
    diffState.setBranch(branch, files);

    statusBarItem.text = `$(git-compare) Diff Lens: ${branch}`;
    statusBarItem.tooltip = `Diff Lens: comparing against ${branch}. Click to change branch.`;
    statusBarItem.show();

    const editor = vscode.window.activeTextEditor;
    if (editor) {
        await applyDecorations(editor, branch);
    }

    await vscode.commands.executeCommand('diffLensPanel.focus');
}

async function refreshAll(): Promise<void> {
    const branch = diffState.branch;
    if (!branch) {
        return;
    }
    await activateBranch(branch);
}

function stopHighlighting(): void {
    diffState.clear();
    statusBarItem.hide();

    for (const editor of vscode.window.visibleTextEditors) {
        clearDecorations(editor);
    }
}

async function showDiffForCurrentFile(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showInformationMessage('No active editor.');
        return;
    }

    const branch = diffState.branch;
    if (!branch) {
        vscode.window.showInformationMessage('No branch selected. Use "Diff Lens: Select Branch to Compare" first.');
        return;
    }

    const filePath = editor.document.uri.fsPath;
    const content = await getFileContentAtBranch(filePath, branch);

    if (content === undefined) {
        vscode.window.showInformationMessage('File does not exist on the selected branch (new file).');
        return;
    }

    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceRoot) {
        return;
    }

    const relativePath = path.relative(workspaceRoot, filePath);
    const branchUri = vscode.Uri.parse(
        `diff-lens:${relativePath}?branch=${encodeURIComponent(branch)}&ts=${Date.now()}`
    );

    const registration = vscode.workspace.registerTextDocumentContentProvider('diff-lens', {
        provideTextDocumentContent: () => content
    });

    await vscode.commands.executeCommand(
        'vscode.diff',
        branchUri,
        editor.document.uri,
        `${relativePath} (${branch} ↔ Working Tree)`
    );

    setTimeout(() => registration.dispose(), 5000);
}

export function deactivate() {}
