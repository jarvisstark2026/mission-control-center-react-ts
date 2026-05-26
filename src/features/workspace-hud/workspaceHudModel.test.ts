import { describe, expect, it } from 'vitest';

import { createInitialAgentControlState } from '../agent-control';
import { createInitialMissionControlState } from '../mission-control/missionControlReducer';
import { createWorkspaceHudSignals } from './workspaceHudModel';
import { getWorkspaceHudMessage } from './workspaceHudI18n';
import {
  defaultWorkspaceHudSettings,
  normalizeWorkspaceHudSettings,
} from './workspaceHudStorage';
import {
  getAudioBandLevels,
  createAudioInstrumentFromAnalyzer,
  createSilentAudioInstrument,
  getAudioBandRing,
  getLogFrequencyWheel,
  getSpectralCentroidHz,
  getWavelengthMeters,
  getWaveformRing,
  normalizeVoiceLevel,
  normalizeVoiceSpectrum,
  normalizeVoiceWaveform,
} from './useAgentVoiceRuntime';

describe('workspace HUD model', () => {
  it('maps existing mission and workspace state into HUD signals without synthetic counts', () => {
    const missionState = createInitialMissionControlState();
    const agentState = createInitialAgentControlState();
    const signals = createWorkspaceHudSignals({
      missionState,
      agentState,
      workspaceGroups: [
        {
          workspaceId: 'main',
          widgets: [
            { open: true, hidden: false },
            { open: false, hidden: true },
          ],
        },
        {
          workspaceId: 'workspace-1',
          widgets: [{ open: true, hidden: false }],
        },
      ],
      activeModeLabel: 'Manual layout',
      activeRole: 'admin',
      locale: 'en-US',
    });

    expect(signals.sourceLabel).toBe('local/mock');
    expect(signals.workspaceOnCount).toBe(2);
    expect(signals.widgetOpenCount).toBe(2);
    expect(signals.pendingCommands).toBe(missionState.commands.filter((command) => command.status === 'pending').length);
    expect(signals.unacknowledgedNotifications).toBe(
      missionState.notifications.filter((notification) => !notification.acknowledged).length,
    );
    expect(signals.integrationHealth.online).toBe(
      missionState.integrations.filter((integration) => integration.status === 'online').length,
    );
    expect(signals.agent.name).toBe('Mission Control Coordinator');
    expect(signals.telemetry).toHaveLength(Math.min(4, missionState.telemetry.length));
  });

  it('normalizes persisted settings and voice levels safely', () => {
    expect(normalizeWorkspaceHudSettings({ designId: 'signal-halo', colorMode: 'mono', voiceReactionEnabled: false })).toEqual({
      designId: 'signal-halo',
      colorMode: 'mono',
      voiceReactionEnabled: false,
      audioMeterEnabled: false,
    });
    expect(normalizeWorkspaceHudSettings({ designId: 'unknown' as never, colorMode: 'bad' as never })).toEqual(
      defaultWorkspaceHudSettings,
    );
    expect(normalizeVoiceLevel(2)).toBe(1);
    expect(normalizeVoiceLevel(-1)).toBe(0);
    expect(normalizeVoiceLevel(Number.NaN)).toBe(0);
    expect(normalizeVoiceSpectrum([0.2, 2, -1], 3)).toEqual([0.2, 1, 0]);
    expect(normalizeVoiceWaveform([0.2, 2, -2], 3)).toEqual([0.2, 1, -1]);
    expect(getWavelengthMeters(343)).toBe(1);
  });

  it('derives audio bands and spectral centroid from analyzer bins', () => {
    const frequencyData = new Uint8Array(1024);
    frequencyData[4] = 120;
    frequencyData[20] = 220;
    frequencyData[32] = 80;

    const bands = getAudioBandLevels(frequencyData, 44_100, 2048);
    expect(bands.bass).toBeGreaterThan(0);
    expect(bands.mid).toBeGreaterThan(0);
    expect(bands.brilliance).toBe(0);
    expect(getSpectralCentroidHz(frequencyData, 44_100, 2048)).toBeGreaterThan(0);
  });

  it('derives full-circumference audio instrument rings without creating sound from silence', () => {
    const silentFrequencyData = new Uint8Array(1024);
    const silentInstrument = createAudioInstrumentFromAnalyzer({
      waveform: Array.from({ length: 128 }, () => 0),
      frequencyData: silentFrequencyData,
      bandLevels: { sub: 0, bass: 0, lowMid: 0, mid: 0, presence: 0, brilliance: 0 },
    });

    expect(silentInstrument.spectrumWheel.every((value) => value === 0)).toBe(true);
    expect(silentInstrument.bassRing.every((value) => value === 0)).toBe(true);
    expect(silentInstrument.midRing.every((value) => value === 0)).toBe(true);
    expect(silentInstrument.highRing.every((value) => value === 0)).toBe(true);

    const frequencyData = new Uint8Array(1024);
    frequencyData[5] = 200;
    frequencyData[38] = 180;
    frequencyData[220] = 160;
    const instrument = createAudioInstrumentFromAnalyzer({
      waveform: Array.from({ length: 128 }, (_, index) => Math.sin(index / 8) * 0.5),
      frequencyData,
      bandLevels: getAudioBandLevels(frequencyData, 44_100, 2048),
      transientLevel: 0.4,
      spectralCentroidHz: getSpectralCentroidHz(frequencyData, 44_100, 2048),
    });

    expect(instrument.waveformRing).toHaveLength(192);
    expect(instrument.spectrumWheel).toHaveLength(192);
    expect(instrument.bassRing.some((value) => value > 0)).toBe(true);
    expect(instrument.midRing.some((value) => value > 0)).toBe(true);
    expect(instrument.highRing.some((value) => value > 0)).toBe(true);
    expect(instrument.transientEvents).toHaveLength(1);
  });

  it('samples waveform and frequency data into circular rings safely', () => {
    const frequencyData = new Uint8Array(1024);
    frequencyData[4] = 255;
    frequencyData[120] = 128;

    expect(createSilentAudioInstrument().waveformRing.every((value) => value === 0)).toBe(true);
    const waveformRing = getWaveformRing([0, 1, 0, -1], 8);
    expect(waveformRing).toHaveLength(8);
    expect(waveformRing.some((value) => value > 0)).toBe(true);
    expect(waveformRing.some((value) => value < 0)).toBe(true);
    expect(waveformRing.every((value) => value >= -1 && value <= 1)).toBe(true);
    expect(getLogFrequencyWheel(frequencyData, 44_100, 2048, 64).some((value) => value > 0)).toBe(true);
    expect(getAudioBandRing(frequencyData, 44_100, 2048, 40, 260, 0, 0, 64).some((value) => value > 0)).toBe(true);
  });

  it('returns localized labels for English and Portuguese', () => {
    expect(getWorkspaceHudMessage('hud.agent', 'en-US')).toBe('Agent');
    expect(getWorkspaceHudMessage('hud.agent', 'pt-PT')).toBe('Agente');
    expect(getWorkspaceHudMessage('hud.metric.commands', 'pt-PT')).toBe('Comandos pendentes');
  });
});
