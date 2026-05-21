# Changelog

## [0.2.1] - 2026-05-21
### Changed
- Renamed extension to **Diff Mark**
- Explorer badges now use distinct symbols (`~`, `◆`, `✕`, `»`) and custom colors (cyan, purple, salmon, teal) to avoid visual confusion with VS Code's built-in uncommitted-changes indicators (`M`, `A`, `D`)
- Contributed four overridable theme colors: `diffMark.modifiedForeground`, `diffMark.addedForeground`, `diffMark.deletedForeground`, `diffMark.renamedForeground`

## [0.2.0] - 2026-05-21
### Added
- Side panel in the Activity Bar listing all changed files grouped by Modified / Added / Deleted
- File decorations in the Explorer with badges and colors for each change status
- Toolbar buttons in the panel: Select Branch, Refresh, Stop
- `diffMark.refresh` command to re-fetch the file list
- `diffMark.openFileDiff` command used internally when clicking a file in the panel
- Shared `diffState` module keeps branch and file list in sync across all UI surfaces

## [0.1.0] - 2026-05-21
### Added
- Initial release
- Select any branch to compare against via Quick Pick
- Gutter highlights for added (green), modified (blue), and deleted (red) lines
- Priority: uncommitted HEAD changes are never overridden by branch-diff highlights
- Hover over a highlighted line to get a clickable "Show diff" link
- `diffMark.showDiff` opens a side-by-side diff of the current file vs the selected branch
- `diffMark.stop` clears all highlights
- Status bar item showing the active comparison branch
