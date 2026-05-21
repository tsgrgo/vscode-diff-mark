import * as vscode from 'vscode';
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
                this._fileMap.set(f.absolutePath, f);
            }
            this._onDidChangeFileDecorations.fire(undefined);
        });
    }

    provideFileDecoration(uri: vscode.Uri): vscode.FileDecoration | undefined {
        const file = this._fileMap.get(uri.fsPath);
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

    dispose(): void {
        this._stateListener.dispose();
        this._onDidChangeFileDecorations.dispose();
    }
}
