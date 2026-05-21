import * as vscode from 'vscode';

export interface ChangedFile {
    relativePath: string;
    absolutePath: string;
    status: 'added' | 'modified' | 'deleted' | 'renamed';
}

class DiffState {
    private _branch: string | undefined;
    private _files: ChangedFile[] = [];
    private readonly _onDidChange = new vscode.EventEmitter<void>();

    readonly onDidChange = this._onDidChange.event;

    get branch(): string | undefined {
        return this._branch;
    }

    get files(): ChangedFile[] {
        return this._files;
    }

    setBranch(branch: string | undefined, files: ChangedFile[]): void {
        this._branch = branch;
        this._files = files;
        this._onDidChange.fire();
    }

    clear(): void {
        this._branch = undefined;
        this._files = [];
        this._onDidChange.fire();
    }

    dispose(): void {
        this._onDidChange.dispose();
    }
}

export const diffState = new DiffState();
