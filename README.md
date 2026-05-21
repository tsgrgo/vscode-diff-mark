# Diff Lens

Compare your working tree against any git branch with gutter highlights, Explorer badges, and a dedicated side panel — without interfering with VS Code's built-in uncommitted-changes indicators.

## Features

### Branch selection
Open the **Diff Lens** panel in the Activity Bar (or run `Diff Lens: Select Branch to Compare` from the Command Palette) to pick any local or remote branch. The comparison stays active across all open files until you stop it.

### Gutter highlights
Changed lines are marked in the editor gutter with colored left-border indicators:

| Color | Meaning |
|-------|---------|
| Green | Line added vs selected branch |
| Blue  | Line modified vs selected branch |
| Red   | Line deleted vs selected branch |

Uncommitted HEAD changes always take visual priority — branch-diff highlights are suppressed on any line already highlighted by VS Code's built-in diff.

Hover over any highlighted line for a clickable **Show diff** link, or run `Diff Lens: Show Diff for Current File` from the Command Palette.

### Side panel
The **Diff Lens** Activity Bar view lists every changed file, grouped by status:

- **Modified** — files changed between the branch and working tree
- **Added** — files new in the working tree (not present on the branch)
- **Deleted** — files present on the branch but removed in the working tree

Click any file to open a side-by-side diff. The panel toolbar has three buttons: select branch, refresh, and stop.

### Explorer decorations
Files in the Explorer are decorated with distinct badges and colors that differ from VS Code's built-in `M`/`A`/`D` markers:

| Badge | Status | Color |
|-------|--------|-------|
| `~` | Modified | Cyan-blue |
| `◆` | Added | Purple |
| `✕` | Deleted | Salmon |
| `»` | Renamed | Teal |

## Commands

| Command | Description |
|---------|-------------|
| `Diff Lens: Select Branch to Compare` | Pick a branch and activate highlighting |
| `Diff Lens: Stop Highlighting` | Clear all highlights and decorations |
| `Diff Lens: Show Diff for Current File` | Open side-by-side diff for the active editor |
| `Diff Lens: Refresh` | Re-fetch the changed file list |

## Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `diffLens.addedColor` | `rgba(40,160,40,0.6)` | Gutter color for added lines |
| `diffLens.modifiedColor` | `rgba(30,140,200,0.6)` | Gutter color for modified lines |
| `diffLens.deletedColor` | `rgba(200,50,50,0.6)` | Gutter color for deleted lines |

## Theme color overrides

All four Explorer decoration colors can be customized in your `settings.json`:

```json
"workbench.colorCustomizations": {
  "diffLens.modifiedForeground": "#4FC1FF",
  "diffLens.addedForeground": "#C586C0",
  "diffLens.deletedForeground": "#F48771",
  "diffLens.renamedForeground": "#73C991"
}
```

## Requirements

- VS Code 1.85 or later
- Git must be installed and available on `PATH`
- The workspace must be a git repository

## Known limitations

- Only the first workspace folder is used in multi-root workspaces.
- Binary files are listed in the panel but do not open a meaningful diff view.
