import { WorkspaceCatalogGrid, WorkspaceContentHeader, WorkspaceContentShell, WorkspaceSectionFrame, WorkspaceSummaryPanel } from '../workspaceBlocks';
import { getMarketGraph, marketCategories, type MarketGraph } from '../workspaceMarketData';

export function NewsWidget({
  activeGraph,
  onSelectGraph,
}: {
  activeGraph: MarketGraph;
  onSelectGraph: (graph: MarketGraph) => void;
}) {
  const newsItems = marketCategories.flatMap((category) =>
    category.graphs.map((graph) => ({
      id: graph.id,
      label: graph.label,
      note: `${graph.category} - ${graph.note}`,
      badge: graph.change,
      active: graph.id === activeGraph.id,
    })),
  );

  return (
    <WorkspaceContentShell className="news-surface">
      <WorkspaceContentHeader
        eyebrow="News feed"
        title="market pulse / watchlist"
        metaEyebrow="active"
        meta={activeGraph.ticker}
      />
      <WorkspaceSummaryPanel className="news-summary" title={activeGraph.label}>
        {activeGraph.note}. Selecting a pulse keeps the market graph in sync without borrowing the entire Markets shell wholesale.
      </WorkspaceSummaryPanel>
      <WorkspaceSectionFrame className="news-feed-section" eyebrow="feed" title="signal headlines" meta={`${newsItems.length} items`}>
        <WorkspaceCatalogGrid
          className="news-feed-grid"
          variant="market"
          ariaLabel="Market news signals"
          items={newsItems}
          onSelect={(item) => onSelectGraph(getMarketGraph(item.id))}
        />
      </WorkspaceSectionFrame>
    </WorkspaceContentShell>
  );
}

