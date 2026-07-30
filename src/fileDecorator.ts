import * as vscode from 'vscode';
import * as path from 'path';
import { diffState, ChangedFile } from './state';

export class BranchDiffFileDecorator implements vscode.FileDecorationProvider, vscode.Disposable {
    private readonly _onDidChangeFileDecorations = new vscode.EventEmitter<vscode.Uri | vscode.Uri[] | undefined>();
    readonly onDidChangeFileDecorations = this._onDidChangeFileDecorations.event;

    private _fileMap = new Map<string, ChangedFile>();
    private readonly _stateListener: vscode.Disposable;

    constructor() {
        this._stateListener = diffState.onDidChange(() => {
            this._fileMap.clear();
            for (const f of diffState.files) {
                const fileKey = this.normalizePath(f.absolutePath);
                this._fileMap.set(fileKey, f);
            }
            this._onDidChangeFileDecorations.fire(undefined);
        });
    }

    provideFileDecoration(uri: vscode.Uri): vscode.FileDecoration | undefined {
        if (uri.scheme !== 'file') {
            return undefined;
        }

        const fileKey = this.normalizePath(uri.fsPath);
        const file = this._fileMap.get(fileKey);

        if (!file) {
            return undefined;
        }

        const b = diffState.branch;
        switch (file.status) {
            case 'added':
                return {
                    badge: '◆',
                    color: new vscode.ThemeColor('diffMark.addedForeground'),
                    tooltip: `Diff Mark: new file vs ${b}`
                };
            case 'deleted':
                return {
                    badge: '✕',
                    color: new vscode.ThemeColor('diffMark.deletedForeground'),
                    tooltip: `Diff Mark: deleted vs ${b}`
                };
            case 'renamed':
                return {
                    badge: '»',
                    color: new vscode.ThemeColor('diffMark.renamedForeground'),
                    tooltip: `Diff Mark: renamed vs ${b}`
                };
            case 'modified':
                return {
                    badge: '~',
                    color: new vscode.ThemeColor('diffMark.modifiedForeground'),
                    tooltip: `Diff Mark: modified vs ${b}`
                };
        }
    }

    private normalizePath(filePath: string): string {
        const normalized = path.normalize(path.resolve(filePath));
        return process.platform === 'win32' ? normalized.toLowerCase() : normalized;
    }

    dispose(): void {
        this._stateListener.dispose();
        this._onDidChangeFileDecorations.dispose();
    }
}
