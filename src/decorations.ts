import * as vscode from 'vscode';
import { DiffHunk, getFileDiff, getUncommittedChanges } from './git';

let addedDecorationType: vscode.TextEditorDecorationType;
let modifiedDecorationType: vscode.TextEditorDecorationType;
let deletedDecorationType: vscode.TextEditorDecorationType;

export function createDecorationTypes(): void {
    const config = vscode.workspace.getConfiguration('diffLens');

    addedDecorationType = vscode.window.createTextEditorDecorationType({
        gutterIconSize: '100%',
        isWholeLine: true,
        overviewRulerLane: vscode.OverviewRulerLane.Left,
        overviewRulerColor: config.get('addedColor', 'rgba(40, 160, 40, 0.6)'),
        gutterIconPath: undefined,
        borderWidth: '0 0 0 3px',
        borderStyle: 'solid',
        borderColor: config.get('addedColor', 'rgba(40, 160, 40, 0.6)')
    });

    modifiedDecorationType = vscode.window.createTextEditorDecorationType({
        gutterIconSize: '100%',
        isWholeLine: true,
        overviewRulerLane: vscode.OverviewRulerLane.Left,
        overviewRulerColor: config.get('modifiedColor', 'rgba(30, 140, 200, 0.6)'),
        gutterIconPath: undefined,
        borderWidth: '0 0 0 3px',
        borderStyle: 'solid',
        borderColor: config.get('modifiedColor', 'rgba(30, 140, 200, 0.6)')
    });

    deletedDecorationType = vscode.window.createTextEditorDecorationType({
        gutterIconSize: '100%',
        isWholeLine: false,
        overviewRulerLane: vscode.OverviewRulerLane.Left,
        overviewRulerColor: config.get('deletedColor', 'rgba(200, 50, 50, 0.6)'),
        gutterIconPath: undefined,
        borderWidth: '0 0 2px 0',
        borderStyle: 'solid',
        borderColor: config.get('deletedColor', 'rgba(200, 50, 50, 0.6)')
    });
}

export function disposeDecorationTypes(): void {
    addedDecorationType?.dispose();
    modifiedDecorationType?.dispose();
    deletedDecorationType?.dispose();
}

export async function applyDecorations(editor: vscode.TextEditor, branch: string): Promise<void> {
    const filePath = editor.document.uri.fsPath;
    const hunks = await getFileDiff(filePath, branch);
    const uncommittedLines = await getUncommittedChanges(filePath);

    const addedRanges: vscode.DecorationOptions[] = [];
    const modifiedRanges: vscode.DecorationOptions[] = [];
    const deletedRanges: vscode.DecorationOptions[] = [];

    const hoverMessage = new vscode.MarkdownString(
        `[Show diff against ${branch}](command:diffLens.showDiff)`
    );
    hoverMessage.isTrusted = true;

    for (const hunk of hunks) {
        if (hunk.type === 'deleted') {
            const line = Math.max(0, hunk.startLine - 1);
            if (line < editor.document.lineCount && !uncommittedLines.has(hunk.startLine)) {
                deletedRanges.push({
                    range: new vscode.Range(line, 0, line, 0),
                    hoverMessage
                });
            }
            continue;
        }

        for (let i = 0; i < hunk.lineCount; i++) {
            const lineNumber = hunk.startLine + i;
            if (uncommittedLines.has(lineNumber)) {
                continue;
            }
            const line = lineNumber - 1;
            if (line < 0 || line >= editor.document.lineCount) {
                continue;
            }
            const range = new vscode.Range(line, 0, line, editor.document.lineAt(line).text.length);
            const decoration: vscode.DecorationOptions = { range, hoverMessage };

            if (hunk.type === 'added') {
                addedRanges.push(decoration);
            } else {
                modifiedRanges.push(decoration);
            }
        }
    }

    editor.setDecorations(addedDecorationType, addedRanges);
    editor.setDecorations(modifiedDecorationType, modifiedRanges);
    editor.setDecorations(deletedDecorationType, deletedRanges);
}

export function clearDecorations(editor: vscode.TextEditor): void {
    editor.setDecorations(addedDecorationType, []);
    editor.setDecorations(modifiedDecorationType, []);
    editor.setDecorations(deletedDecorationType, []);
}
