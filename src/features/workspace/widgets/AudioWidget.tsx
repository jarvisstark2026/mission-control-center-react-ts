import type { AgentControlState } from '../../agent-control';
import { WorkspaceCompactList, WorkspaceContentHeader, WorkspaceContentShell, WorkspaceSectionFrame, WorkspaceStatusStrip } from '../workspaceBlocks';

export function AudioWidget({ agentControl }: { agentControl?: AgentControlState }) {
  const recentActivity = agentControl?.activity.slice(0, 4) ?? [];
  const bridgeConnected = agentControl?.connectors.some((connector) => connector.status === 'connected') ?? false;
  const rows = [
    {
      id: 'agent-voice',
      meta: 'agent',
      title: bridgeConnected ? 'Agent bridge can report voice/activity events' : 'No agent voice source connected',
      detail: bridgeConnected ? agentControl?.eventStreamStatus ?? 'ready' : 'setup required',
      state: bridgeConnected ? 'ready' : 'offline',
    },
    {
      id: 'hud-meter',
      meta: 'hud',
      title: 'Live audio meter is controlled from Agent / HUD settings',
      detail: 'local mic',
      state: 'ready',
    },
    ...recentActivity.map((activity) => ({
      id: activity.id,
      meta: activity.kind,
      title: activity.title,
      detail: activity.status ?? 'activity',
      state: activity.status ?? 'ready',
    })),
  ];

  return (
    <WorkspaceContentShell className="audio-widget-shell">
      <WorkspaceContentHeader
        eyebrow="Audio"
        title="voice and signal monitor"
        metaEyebrow="source"
        meta={bridgeConnected ? 'bridge activity' : 'not connected'}
      />
      <WorkspaceStatusStrip
        source={bridgeConnected ? 'bridge' : 'unavailable'}
        status={bridgeConnected ? 'agent activity source ready' : 'no live audio source'}
        count={`${recentActivity.length} recent events`}
      />
      <WorkspaceSectionFrame className="media-widget-stage" eyebrow="audio state" title="available signal sources" meta="real values only">
        <div className="audio-surface" aria-hidden="true">
          <div className="audio-ring audio-ring-a" />
          <div className="audio-ring audio-ring-b" />
          <div className="audio-bars audio-bars-idle">
            {Array.from({ length: 12 }).map((_, index) => (
              <i key={index} />
            ))}
          </div>
        </div>
        <WorkspaceCompactList items={rows} empty="Connect an agent bridge or enable the HUD audio meter to see live audio state." ariaLabel="Audio setup rows" />
      </WorkspaceSectionFrame>
    </WorkspaceContentShell>
  );
}
