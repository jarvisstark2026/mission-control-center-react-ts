import { useState } from 'react';

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
  if (profile.type === 'web') return 'Open web';
  if (profile.type === 'protocol') return 'Open link';
  return 'Track';
}

export function NativeAppWidget({ role, operationalOs }: { role: ShellRole; operationalOs: OperationalOsRuntime }) {
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
      setStatus('Manual desktop profile tracked. Direct executable launch is blocked.');
      return;
    }
    if (typeof window !== 'undefined') window.open(profile.launchTarget, '_blank', 'noopener,noreferrer');
    setStatus(`${profile.type === 'web' ? 'Opened web profile' : 'Opened protocol link'}: ${profile.name}`);
  };

  return (
    <WorkspaceContentShell className="native-app-surface widget-feature-shell">
      <WorkspaceContentHeader
        eyebrow="Native app"
        title={selectedProfile?.name ?? 'external app profiles'}
        metaEyebrow="source"
        meta="local"
      />

      <WorkspaceStatusStrip
        source="local"
        status={status}
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
                  `manual handoff / ${selectedProfile.launchTarget} / direct executable launch blocked`,
                )
            : createRuntimeSnapshotEvidenceInput('Native app profile', 'native-app-widget', 'No app profile selected.')
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
                  : profile.launchTarget,
              state: profile.id === selectedProfile?.id ? 'active' : profile.type,
              action: {
                label: profile.id === selectedProfile?.id ? getProfileActionLabel(profile) : 'Select',
                onClick: () =>
                  profile.id === selectedProfile?.id
                    ? openProfile(profile)
                    : setProfileState((current) => ({ ...current, selectedProfileId: profile.id, updatedAt: new Date().toISOString() })),
              },
            }))}
            empty="No external app profiles saved."
          />
        ) : (
          <WorkspaceEmptyState source="local" title="No app profiles" detail="Save a web or protocol target for quick external handoff." />
        )}

        <small className="widget-feature-note">
          Mission Control opens web and protocol links. Arbitrary executable paths stay manual until a secure allowlist executor exists.
        </small>
      </WorkspaceSectionFrame>
    </WorkspaceContentShell>
  );
}
