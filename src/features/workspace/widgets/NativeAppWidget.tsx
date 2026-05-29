import { useState } from 'react';

import type { ShellRole } from '../../shell/roles';
import type { MissionControlEvent, MissionControlRuntime } from '../../mission-control';
import type { OperationalOsRuntime } from '../../operational-os';
import { WorkspaceEvidenceAttachPanel } from '../WorkspaceEvidenceAttachPanel';
import { WorkspaceButton,
  WorkspaceCompactList,  WorkspaceContentShell,
  WorkspaceEmptyState,
  WorkspaceSectionFrame,
  WorkspaceStatusStrip } from '../workspaceBlocks';
import { createRuntimeSnapshotEvidenceInput, createUrlEvidenceInput } from '../workspaceEvidenceModel';
import {
  addNativeAppProfile,
  canLaunchNativeAppProfile,
  loadNativeAppProfileState,
  markNativeAppProfileOpened,
  saveNativeAppProfileState,
  type NativeAppProfile,
} from '../workspaceWidgetFeatureModels';
import { usePersistentWorkspaceState } from '../usePersistentWorkspaceState';

function getProfileActionLabel(profile: NativeAppProfile) {
  if (profile.type === 'web') return 'Stage web launch';
  if (profile.type === 'protocol') return 'Stage protocol launch';
  return 'Track';
}

function createNativeAppLaunchEvents(profile: NativeAppProfile, role: ShellRole): MissionControlEvent[] {
  if (!canLaunchNativeAppProfile(profile)) return [];
  const timestamp = new Date().toISOString();
  const commandId = `native-app-${profile.id}-${Date.parse(timestamp).toString(36)}`;
  return [
    {
      type: 'command',
      command: {
        id: commandId,
        title: `Open ${profile.name}`,
        summary: `Open allowlisted ${profile.type} target from Native App.`,
        source: `native-app:${profile.type}`,
        agent: {
          agentId: 'mission-control-shell',
          agentName: 'Mission Control Shell',
          profile: 'native-app-launch',
        },
        reasoning: `${profile.name} is an allowlisted ${profile.type} profile. Mission Control stages the launch through Command Inbox before any external handoff.`,
        expectedResult: `The approved command opens ${profile.launchTarget} through the registered Mission Control desktop adapter.`,
        scope: 'system',
        risk: profile.type === 'protocol' ? 'elevated' : 'safe',
        status: 'pending',
        requestedAt: timestamp,
        execution: {
          status: 'not-started',
          result: 'Waiting in Command Inbox. Native App does not execute launches directly.',
          rollbackAvailable: false,
        },
        auditTrail: [
          {
            id: `audit-${commandId}-proposed`,
            type: 'proposed',
            actor: `native-app:${role}`,
            timestamp,
            detail: `${profile.name} launch was staged from the Native App widget.`,
          },
        ],
      },
    },
    {
      type: 'notification',
      notification: {
        id: `notification-${commandId}`,
        level: profile.type === 'protocol' ? 'warning' : 'notice',
        title: 'Native App launch staged',
        body: `${profile.name} is waiting in Command Inbox.`,
        source: 'native-app',
        timestamp,
        acknowledged: false,
        relatedCommandId: commandId,
      },
    },
  ];
}

export function NativeAppWidget({ role, missionControl, operationalOs }: { role: ShellRole; missionControl: MissionControlRuntime; operationalOs: OperationalOsRuntime }) {
  const [profileState, setProfileState] = usePersistentWorkspaceState(loadNativeAppProfileState, saveNativeAppProfileState);
  const [profileName, setProfileName] = useState('');
  const [launchTarget, setLaunchTarget] = useState('');
  const [status, setStatus] = useState('Ready');
  const selectedProfile = profileState.profiles.find((profile) => profile.id === profileState.selectedProfileId) ?? profileState.profiles[0] ?? null;

  const saveProfile = () => {
    setProfileState((current) => addNativeAppProfile(current, { name: profileName, launchTarget }));
    setProfileName('');
    setLaunchTarget('');
    setStatus('Profile saved');
  };

  const openProfile = (profile: NativeAppProfile) => {
    setProfileState((current) => markNativeAppProfileOpened(current, profile.id));
    if (!canLaunchNativeAppProfile(profile)) {
      setStatus('Profile tracked. Direct executable launch is blocked unless an allowlisted adapter is designed.');
      return;
    }
    missionControl.ingestEvents(createNativeAppLaunchEvents(profile, role));
    setStatus(`${profile.name} launch staged in Command Inbox.`);
  };

  return (
    <WorkspaceContentShell className="native-app-surface widget-feature-shell">
      <WorkspaceStatusStrip
        source="local"
        status={selectedProfile ? status : 'profile required'}
        count={`${profileState.profiles.length} profiles`}
        updatedAt={selectedProfile ? selectedProfile.type : 'manual safe mode'}
        action={{
          label: selectedProfile ? getProfileActionLabel(selectedProfile) : 'No profile',
          disabled: !selectedProfile,
          onClick: () => selectedProfile && openProfile(selectedProfile),
          title: selectedProfile?.type === 'manual' ? 'Track manual app profile; direct executable launch is blocked' : 'Open selected external target',
        }}
      />

      <WorkspaceEvidenceAttachPanel
        role={role}
        operationalOs={operationalOs}
        evidence={
          selectedProfile
            ? selectedProfile.type === 'web' || selectedProfile.type === 'protocol'
              ? createUrlEvidenceInput(
                  selectedProfile.launchTarget,
                  `${selectedProfile.name} app profile`,
                  'native-app-widget',
                  `${selectedProfile.type} / ${status}`,
                )
              : createRuntimeSnapshotEvidenceInput(
                  `${selectedProfile.name} manual app profile`,
                  'native-app-widget',
                  `${selectedProfile.allowlistStatus} / ${selectedProfile.launchTarget} / direct executable launch blocked`,
                )
            : createRuntimeSnapshotEvidenceInput('Native app profile', 'native-app-widget', 'App profile required.')
        }
        disabled={!selectedProfile}
        disabledReason={!selectedProfile ? 'Save or select an app profile before attaching evidence.' : undefined}
      />

      <WorkspaceSectionFrame className="native-app-bridge-section" eyebrow="profiles" title="external handoff" meta="web / protocol / manual">
        <div className="widget-feature-form widget-feature-inline-form">
          <label>
            <span>Name</span>
            <input value={profileName} onChange={(event) => setProfileName(event.target.value)} placeholder="Codex, Hermes, Notes" />
          </label>
          <label>
            <span>Target</span>
            <input value={launchTarget} onChange={(event) => setLaunchTarget(event.target.value)} placeholder="https://..., codex://, or manual path" />
          </label>
          <WorkspaceButton variant="secondary" onClick={saveProfile} disabled={!profileName.trim() || !launchTarget.trim()}>
            Save profile
          </WorkspaceButton>
        </div>

        {profileState.profiles.length ? (
          <WorkspaceCompactList
            ariaLabel="Native app launch profiles"
            items={profileState.profiles.map((profile) => ({
              id: profile.id,
              meta: profile.type,
              title: profile.name,
              detail:
                profile.type === 'manual'
                  ? 'manual handoff only; executable launch blocked'
                  : `${profile.allowlistStatus} / ${profile.launchTarget}`,
              state: profile.id === selectedProfile?.id ? 'active' : profile.allowlistStatus,
              action: {
                label: profile.id === selectedProfile?.id ? getProfileActionLabel(profile) : 'Select',
                onClick: () =>
                  profile.id === selectedProfile?.id
                    ? openProfile(profile)
                    : setProfileState((current) => ({ ...current, selectedProfileId: profile.id, updatedAt: new Date().toISOString() })),
              },
            }))}
            empty="External handoff profiles appear after local save."
          />
        ) : (
          <WorkspaceEmptyState source="local" title="App profile required" detail="Save a web or protocol target for quick external handoff." />
        )}

        <small className="widget-feature-note">
          Mission Control opens web and protocol links. Arbitrary executable paths stay manual until a secure allowlist executor exists.
        </small>
      </WorkspaceSectionFrame>
    </WorkspaceContentShell>
  );
}
