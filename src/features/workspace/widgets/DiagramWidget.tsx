import { useRef, useState } from 'react';

import type { ShellRole } from '../../shell/roles';
import type { OperationalOsRuntime } from '../../operational-os';
import { WorkspaceEvidenceAttachPanel } from '../WorkspaceEvidenceAttachPanel';
import {
  WorkspaceButton,
  WorkspaceCompactList,
  WorkspaceContentHeader,
  WorkspaceContentShell,
  WorkspaceEmptyState,
  WorkspaceSectionFrame,
  WorkspaceStatusStrip,
} from '../workspaceBlocks';
import { createRuntimeSnapshotEvidenceInput } from '../workspaceEvidenceModel';
import {
  createDiagramFromTitle,
  importDiagramJson,
  loadDiagramSurfaceState,
  saveDiagramSurfaceState,
  type DiagramDocument,
  type DiagramLink,
  type DiagramNode,
} from '../workspaceWidgetFeatureModels';
import { usePersistentWorkspaceState } from '../usePersistentWorkspaceState';

function getSelectedDiagram(diagram: DiagramDocument | null, nodeId: string) {
  return diagram?.nodes.find((node) => node.id === nodeId) ?? null;
}

function renderLinkPath(from: DiagramNode | null, to: DiagramNode | null) {
  if (!from || !to) return '';
  const controlX = (from.x + to.x) / 2;
  const controlY = Math.min(from.y, to.y) - 10;
  return `M ${from.x} ${from.y} Q ${controlX} ${controlY} ${to.x} ${to.y}`;
}

export function DiagramWidget({ role, operationalOs }: { role: ShellRole; operationalOs: OperationalOsRuntime }) {
  const [diagramState, setDiagramState] = usePersistentWorkspaceState(loadDiagramSurfaceState, saveDiagramSurfaceState);
  const [titleDraft, setTitleDraft] = useState('');
  const [nodeDraft, setNodeDraft] = useState('');
  const [linkFrom, setLinkFrom] = useState('');
  const [linkTo, setLinkTo] = useState('');
  const [jsonDraft, setJsonDraft] = useState('');
  const [importError, setImportError] = useState<string | null>(null);
  const titleInputRef = useRef<HTMLInputElement | null>(null);
  const nodeInputRef = useRef<HTMLInputElement | null>(null);

  const selectedDiagram = diagramState.diagrams.find((diagram) => diagram.id === diagramState.selectedDiagramId) ?? diagramState.diagrams[0] ?? null;
  const nodeCount = selectedDiagram?.nodes.length ?? 0;
  const linkCount = selectedDiagram?.links.length ?? 0;

  const createDiagram = () => {
    const nextTitle = titleDraft.trim() || titleInputRef.current?.value.trim() || '';
    setDiagramState((current) => createDiagramFromTitle(current, nextTitle));
    setTitleDraft('');
    if (titleInputRef.current) titleInputRef.current.value = '';
  };

  const addNode = () => {
    const label = nodeDraft.trim() || nodeInputRef.current?.value.trim() || '';
    if (!label || !selectedDiagram) return;
    const now = new Date().toISOString();
    const nextNode: DiagramNode = {
      id: `node-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || selectedDiagram.nodes.length + 1}-${Date.now()}`,
      label,
      x: 16 + ((selectedDiagram.nodes.length * 23) % 68),
      y: 18 + ((selectedDiagram.nodes.length * 19) % 62),
    };
    setDiagramState((current) => ({
      ...current,
      diagrams: current.diagrams.map((diagram) =>
        diagram.id === selectedDiagram.id
          ? {
              ...diagram,
              nodes: [...diagram.nodes, nextNode].slice(0, 24),
              updatedAt: now,
            }
          : diagram,
      ),
      selectedDiagramId: selectedDiagram.id,
      updatedAt: now,
    }));
    setNodeDraft('');
    if (nodeInputRef.current) nodeInputRef.current.value = '';
  };

  const addLink = () => {
    if (!selectedDiagram || !linkFrom || !linkTo || linkFrom === linkTo) return;
    const now = new Date().toISOString();
    const nextLink: DiagramLink = {
      id: `link-${linkFrom}-${linkTo}-${Date.now()}`,
      from: linkFrom,
      to: linkTo,
    };
    setDiagramState((current) => ({
      ...current,
      diagrams: current.diagrams.map((diagram) =>
        diagram.id === selectedDiagram.id
          ? {
              ...diagram,
              links: [nextLink, ...diagram.links.filter((link) => !(link.from === nextLink.from && link.to === nextLink.to))].slice(0, 32),
              updatedAt: now,
            }
          : diagram,
      ),
      selectedDiagramId: selectedDiagram.id,
      updatedAt: now,
    }));
  };

  const importJson = () => {
    const result = importDiagramJson(diagramState, jsonDraft);
    setDiagramState(result.state);
    setImportError(result.error);
    if (!result.error) setJsonDraft('');
  };

  return (
    <WorkspaceContentShell className="diagram-widget-shell widget-feature-shell">
      <WorkspaceContentHeader
        eyebrow="Diagram"
        title={selectedDiagram?.title ?? 'local topology documents'}
        metaEyebrow="source"
        meta={selectedDiagram?.source ?? 'local'}
      />
      <WorkspaceStatusStrip
        source="local"
        status={selectedDiagram ? `${nodeCount} nodes / ${linkCount} links` : 'no diagram selected'}
        count={`${diagramState.diagrams.length} saved diagrams`}
        updatedAt={selectedDiagram ? `updated ${new Date(selectedDiagram.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'local'}
      />

      <WorkspaceEvidenceAttachPanel
        role={role}
        operationalOs={operationalOs}
        evidence={
          selectedDiagram
            ? createRuntimeSnapshotEvidenceInput(
                `${selectedDiagram.title} diagram`,
                selectedDiagram.source === 'json' ? 'diagram-json' : 'diagram-local',
                `${selectedDiagram.nodes.length} nodes / ${selectedDiagram.links.length} links / ${selectedDiagram.source}`,
              )
            : createRuntimeSnapshotEvidenceInput('Diagram document', 'diagram-widget', 'No diagram selected.')
        }
        disabled={!selectedDiagram}
        disabledReason={!selectedDiagram ? 'Create or import a diagram before attaching evidence.' : undefined}
      />

      <WorkspaceSectionFrame className="media-widget-stage diagram-feature-stage" eyebrow="canvas" title="graph document" meta="nodes / links">
        <div className="diagram-surface diagram-feature-surface" aria-label="Diagram canvas">
          {selectedDiagram ? (
            <svg viewBox="0 0 100 100" role="img" aria-label={`${selectedDiagram.title} diagram`}>
              <defs>
                <filter id="diagram-node-glow">
                  <feGaussianBlur stdDeviation="1.4" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>
              {selectedDiagram.links.map((link) => (
                <path
                  key={link.id}
                  className="diagram-feature-link"
                  d={renderLinkPath(getSelectedDiagram(selectedDiagram, link.from), getSelectedDiagram(selectedDiagram, link.to))}
                />
              ))}
              {selectedDiagram.nodes.map((node) => (
                <g key={node.id} className="diagram-feature-node" transform={`translate(${node.x} ${node.y})`}>
                  <circle r="4.2" />
                  <text x="6" y="2.4">{node.label.slice(0, 18)}</text>
                </g>
              ))}
            </svg>
          ) : (
            <WorkspaceEmptyState source="local" title="No diagram selected" detail="Create a diagram or import JSON with nodes and links." />
          )}
        </div>

        <div className="widget-feature-two-column">
          <div className="widget-feature-form" aria-label="Create diagram">
            <label>
              <span>Diagram</span>
              <input ref={titleInputRef} value={titleDraft} onChange={(event) => setTitleDraft(event.target.value)} placeholder="System, room, workflow" />
            </label>
            <WorkspaceButton variant="secondary" onClick={createDiagram} disabled={!titleDraft.trim()}>
              Create diagram
            </WorkspaceButton>
            <label>
              <span>Node</span>
              <input ref={nodeInputRef} value={nodeDraft} onChange={(event) => setNodeDraft(event.target.value)} placeholder="API, sensor, app, step" disabled={!selectedDiagram} />
            </label>
            <WorkspaceButton variant="secondary" onClick={addNode} disabled={!selectedDiagram || !nodeDraft.trim()}>
              Add node
            </WorkspaceButton>
          </div>

          <div className="widget-feature-form" aria-label="Diagram links and JSON import">
            <label>
              <span>Link from</span>
              <select value={linkFrom} onChange={(event) => setLinkFrom(event.target.value)} disabled={!selectedDiagram?.nodes.length}>
                <option value="">Select node</option>
                {selectedDiagram?.nodes.map((node) => <option key={node.id} value={node.id}>{node.label}</option>)}
              </select>
            </label>
            <label>
              <span>Link to</span>
              <select value={linkTo} onChange={(event) => setLinkTo(event.target.value)} disabled={!selectedDiagram?.nodes.length}>
                <option value="">Select node</option>
                {selectedDiagram?.nodes.map((node) => <option key={node.id} value={node.id}>{node.label}</option>)}
              </select>
            </label>
            <WorkspaceButton variant="secondary" onClick={addLink} disabled={!selectedDiagram || !linkFrom || !linkTo || linkFrom === linkTo}>
              Add link
            </WorkspaceButton>
            <label>
              <span>JSON import</span>
              <textarea value={jsonDraft} onChange={(event) => setJsonDraft(event.target.value)} placeholder='{"title":"Bridge","nodes":[...],"links":[...]}' rows={3} />
            </label>
            <WorkspaceButton variant="secondary" onClick={importJson} disabled={!jsonDraft.trim()}>
              Import JSON
            </WorkspaceButton>
            {importError ? <small className="widget-feature-error">{importError}</small> : null}
          </div>
        </div>

        <WorkspaceCompactList
          ariaLabel="Saved diagram documents"
          items={diagramState.diagrams.slice(0, 6).map((diagram) => ({
            id: diagram.id,
            meta: diagram.source,
            title: diagram.title,
            detail: `${diagram.nodes.length} nodes / ${diagram.links.length} links`,
            state: diagram.id === selectedDiagram?.id ? 'active' : diagram.source,
            action: {
              label: diagram.id === selectedDiagram?.id ? 'Active' : 'Open',
              disabled: diagram.id === selectedDiagram?.id,
              onClick: () => setDiagramState((current) => ({ ...current, selectedDiagramId: diagram.id, updatedAt: new Date().toISOString() })),
            },
          }))}
          empty="Create a diagram or import a JSON graph."
        />
      </WorkspaceSectionFrame>
    </WorkspaceContentShell>
  );
}
