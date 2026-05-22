import { WorkspaceContentHeader, WorkspaceContentShell, WorkspaceSectionFrame, WorkspaceSummaryPanel } from '../workspaceBlocks';

export function SpreadsheetWidget() {
  const columns = ['Q1', 'Q2', 'Q3', 'Q4'];
  const rows = [
    ['Revenue', '18.2', '21.5', '24.0', '26.8'],
    ['Costs', '9.1', '9.6', '10.3', '11.4'],
    ['Margin', '50%', '55%', '57%', '58%'],
    ['Forecast', '14', '16', '18', '20'],
  ];

  return (
    <WorkspaceContentShell className="sheet-surface">
      <WorkspaceContentHeader
        eyebrow="Spreadsheet"
        title="formula bar / grid / cells"
        metaEyebrow="model"
        meta={`${rows.length} rows`}
      />
      <WorkspaceSummaryPanel title="quarterly operating model">
        A compact tabular workspace for reviewing revenue, cost, margin, and forecast figures without adding another bespoke header stack.
      </WorkspaceSummaryPanel>
      <WorkspaceSectionFrame className="sheet-grid-frame" eyebrow="grid" title="financial snapshot" meta={`${columns.length} quarters`}>
        <div className="sheet-grid">
          <div className="sheet-corner" />
          {columns.map((col) => (
            <div className="sheet-head" key={col}>{col}</div>
          ))}
          {rows.map((row) => (
            <div className="sheet-row" key={row[0]}>
              <div className="sheet-row-label">{row[0]}</div>
              {row.slice(1).map((cell, index) => (
                <div className="sheet-cell" key={`${row[0]}-${index}`}>{cell}</div>
              ))}
            </div>
          ))}
        </div>
      </WorkspaceSectionFrame>
    </WorkspaceContentShell>
  );
}

