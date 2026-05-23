import { WorkspaceContentHeader, WorkspaceContentShell, WorkspaceSectionFrame, WorkspaceSummaryPanel } from '../workspaceBlocks';
import { loadLocalSheetState, saveLocalSheetState, summarizeSheetColumn, updateSheetCell } from '../workspaceEvidenceModel';
import { usePersistentWorkspaceState } from '../usePersistentWorkspaceState';

export function SpreadsheetWidget() {
  const [sheet, setSheet] = usePersistentWorkspaceState(loadLocalSheetState, saveLocalSheetState);
  const numericColumns = sheet.columns.slice(1);
  const updatedTime = new Date(sheet.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <WorkspaceContentShell className="sheet-surface">
      <WorkspaceContentHeader
        eyebrow="Spreadsheet"
        title="local table / calculations"
        metaEyebrow="saved"
        meta={`${sheet.rows.length} rows - ${updatedTime}`}
      />
      <WorkspaceSummaryPanel title="editable evidence table">
        Edit cells locally. Numeric columns automatically show sum and average so the widget can support quick decisions without a backend.
      </WorkspaceSummaryPanel>
      <WorkspaceSectionFrame className="sheet-grid-frame" eyebrow="grid" title="operating snapshot" meta={`${numericColumns.length} numeric columns`}>
        <div className="sheet-summary-strip" aria-label="Column summaries">
          {numericColumns.map((column, index) => {
            const summary = summarizeSheetColumn(sheet, index + 1);

            return (
              <div className="sheet-summary-tile" key={column}>
                <span>{column}</span>
                <strong>{summary.sum}</strong>
                <small>avg {summary.average}</small>
              </div>
            );
          })}
        </div>

        <div className="sheet-grid" role="grid" aria-label="Local spreadsheet">
          {sheet.columns.map((column) => (
            <div className="sheet-head" key={column} role="columnheader">{column}</div>
          ))}
          {sheet.rows.map((row, rowIndex) => (
            <div className="sheet-row" key={`${row[0]}-${rowIndex}`} role="row">
              {sheet.columns.map((column, columnIndex) => (
                <input
                  key={`${rowIndex}-${column}`}
                  className={columnIndex === 0 ? 'sheet-row-label' : 'sheet-cell'}
                  aria-label={`${column} row ${rowIndex + 1}`}
                  value={row[columnIndex] ?? ''}
                  onChange={(event) => setSheet((current) => updateSheetCell(current, rowIndex, columnIndex, event.target.value))}
                />
              ))}
            </div>
          ))}
        </div>
      </WorkspaceSectionFrame>
    </WorkspaceContentShell>
  );
}
