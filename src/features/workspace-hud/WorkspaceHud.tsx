import { useEffect, useRef } from 'react';

import { classNames } from '../../lib/classNames';
import { getWorkspaceHudMessage } from './workspaceHudI18n';
import { getLatestAgentVoiceState } from './useAgentVoiceRuntime';
import type {
  AgentVoiceState,
  WorkspaceHudColorMode,
  WorkspaceHudDesignId,
  WorkspaceHudSettings,
  WorkspaceHudSignals,
} from './workspaceHudTypes';
import './workspaceHud.css';

const spectrumBinCount = 128;
const waveformPointCount = 192;
const maxDevicePixelRatio = 2;

type HudPalette = {
  primary: string;
  secondary: string;
  accent: string;
  muted: string;
  glass: string;
};

function clamp(value: number, min = 0, max = 1) {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function getColorModeClass(colorMode: WorkspaceHudColorMode) {
  return `color-${colorMode}`;
}

function getAudioValue(spectrum: number[], index: number) {
  if (!spectrum.length) return 0;
  return clamp(spectrum[index % spectrum.length] ?? 0);
}

function getWaveformValue(waveform: number[], index: number) {
  if (!waveform.length) return 0;
  const value = waveform[index % waveform.length] ?? 0;
  if (!Number.isFinite(value)) return 0;
  return Math.max(-1, Math.min(1, value));
}

function getRingValue(ring: number[], index: number, signed = false) {
  if (!ring.length) return 0;
  const value = ring[index % ring.length] ?? 0;
  if (!Number.isFinite(value)) return 0;
  return signed ? Math.max(-1, Math.min(1, value)) : clamp(value);
}

function getFrequencyAngle(frequencyHz: number | null) {
  if (!frequencyHz || !Number.isFinite(frequencyHz) || frequencyHz <= 0) return -Math.PI / 2;
  const ratio = clamp(Math.log(frequencyHz / 20) / Math.log(16_000 / 20));
  return -Math.PI / 2 + ratio * Math.PI * 2;
}

function getCommandRatio(signals: WorkspaceHudSignals) {
  const total = signals.pendingCommands + signals.activeCommands;
  if (total <= 0) return 0;
  return clamp(signals.pendingCommands / total);
}

function getNotificationRatio(signals: WorkspaceHudSignals) {
  return clamp(signals.unacknowledgedNotifications / 12);
}

function getIntegrationRatio(signals: WorkspaceHudSignals) {
  const total =
    signals.integrationHealth.online + signals.integrationHealth.degraded + signals.integrationHealth.offline;
  if (total <= 0) return 0;
  return clamp(signals.integrationHealth.online / total);
}

function formatPercent(value: number | null) {
  return value === null ? '--' : `${Math.round(value * 100)}%`;
}

function formatFrequency(value: number | null) {
  if (value === null) return '--';
  return value >= 1000 ? `${(value / 1000).toFixed(1)}kHz` : `${Math.round(value)}Hz`;
}

function formatWavelength(value: number | null) {
  if (value === null) return '--';
  return value < 1 ? `${Math.round(value * 100)}cm` : `${value.toFixed(2)}m`;
}

function formatCompactNumber(value: number, locale?: string) {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(value);
}

function drawArc(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  start: number,
  sweep: number,
  color: string,
  lineWidth: number,
  alpha = 1,
) {
  if (sweep <= 0) return;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(cx, cy, radius, start, start + sweep);
  ctx.stroke();
  ctx.restore();
}

function drawSegmentedRing(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  segments: number,
  rotation: number,
  color: string,
  lineWidth: number,
  alpha: number,
  fillRatio = 1,
) {
  const gap = Math.PI / Math.max(segments * 2.2, 1);
  const segmentSweep = (Math.PI * 2) / segments - gap;
  const activeSegments = Math.ceil(segments * clamp(fillRatio));

  for (let index = 0; index < segments; index += 1) {
    const start = rotation + index * ((Math.PI * 2) / segments);
    const itemAlpha = index < activeSegments ? alpha : alpha * 0.26;
    drawArc(ctx, cx, cy, radius, start, segmentSweep, color, lineWidth, itemAlpha);
  }
}

function drawTicks(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  count: number,
  color: string,
  alpha: number,
) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  ctx.globalAlpha *= alpha;

  for (let index = 0; index < count; index += 1) {
    const angle = (index / count) * Math.PI * 2 - Math.PI / 2;
    const major = index % 6 === 0;
    const inner = radius - (major ? 16 : 8);
    const outer = radius + (major ? 6 : 2);
    ctx.lineWidth = major ? 1.4 : 0.8;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(angle) * inner, cy + Math.sin(angle) * inner);
    ctx.lineTo(cx + Math.cos(angle) * outer, cy + Math.sin(angle) * outer);
    ctx.stroke();
  }

  ctx.restore();
}

function drawDottedRing(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  count: number,
  color: string,
  alpha: number,
  phase: number,
  activeRatio = 1,
) {
  ctx.save();
  ctx.fillStyle = color;

  for (let index = 0; index < count; index += 1) {
    const angle = (index / count) * Math.PI * 2 + phase;
    const isActive = index / count <= activeRatio;
    ctx.globalAlpha = alpha * (isActive ? 1 : 0.28);
    ctx.beginPath();
    ctx.arc(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius, isActive ? 1.35 : 0.75, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function drawGhostRing(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  color: string,
  alpha: number,
  lineWidth = 1,
) {
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawBracketMarks(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  color: string,
  alpha: number,
) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.2;
  ctx.lineCap = 'square';
  ctx.globalAlpha *= alpha;

  for (let index = 0; index < 8; index += 1) {
    const angle = index * (Math.PI / 4);
    const tangent = angle + Math.PI / 2;
    const centerX = cx + Math.cos(angle) * radius;
    const centerY = cy + Math.sin(angle) * radius;
    const length = index % 2 === 0 ? radius * 0.09 : radius * 0.055;
    const inset = radius * 0.028;
    ctx.beginPath();
    ctx.moveTo(centerX - Math.cos(tangent) * length * 0.5, centerY - Math.sin(tangent) * length * 0.5);
    ctx.lineTo(centerX + Math.cos(tangent) * length * 0.5, centerY + Math.sin(tangent) * length * 0.5);
    ctx.moveTo(centerX - Math.cos(angle) * inset, centerY - Math.sin(angle) * inset);
    ctx.lineTo(centerX - Math.cos(angle) * inset * 2.3, centerY - Math.sin(angle) * inset * 2.3);
    ctx.stroke();
  }

  ctx.restore();
}

function drawLowerArcGauges(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  palette: HudPalette,
  signals: WorkspaceHudSignals,
) {
  const ratios = [getCommandRatio(signals), getNotificationRatio(signals), getIntegrationRatio(signals)];
  const colors = [palette.primary, palette.secondary, palette.accent];
  const start = Math.PI * 0.62;
  const sweep = Math.PI * 0.28;

  for (let index = 0; index < ratios.length; index += 1) {
    const itemRadius = radius * (0.82 + index * 0.055);
    drawArc(ctx, cx, cy, itemRadius, start + index * 0.05, sweep, palette.muted, 1, 0.14);
    drawArc(ctx, cx, cy, itemRadius, start + index * 0.05, sweep * (ratios[index] ?? 0), colors[index] ?? palette.primary, 2.1, 0.72);
  }
}

function drawCrossLines(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  color: string,
  alpha: number,
) {
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.setLineDash([radius * 0.12, radius * 0.08]);

  for (let index = 0; index < 4; index += 1) {
    const angle = index * (Math.PI / 2);
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(angle) * radius * 0.24, cy + Math.sin(angle) * radius * 0.24);
    ctx.lineTo(cx + Math.cos(angle) * radius * 1.05, cy + Math.sin(angle) * radius * 1.05);
    ctx.stroke();
  }

  ctx.restore();
}

function drawMicroLabel(
  ctx: CanvasRenderingContext2D,
  label: string,
  value: string,
  x: number,
  y: number,
  align: CanvasTextAlign,
  palette: HudPalette,
  scale: number,
) {
  ctx.save();
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.font = `700 ${Math.max(8, scale * 0.027)}px Inter, system-ui, sans-serif`;
  ctx.fillStyle = palette.primary;
  ctx.globalAlpha *= 0.72;
  ctx.fillText(label, x, y - scale * 0.014);
  ctx.font = `800 ${Math.max(9, scale * 0.032)}px Inter, system-ui, sans-serif`;
  ctx.fillStyle = 'rgba(242, 250, 255, 0.88)';
  ctx.globalAlpha *= 0.9;
  ctx.fillText(value, x, y + scale * 0.024);
  ctx.restore();
}

function createDynamicHudGradient(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  palette: HudPalette,
  phase: number,
  level: number,
) {
  const angle = phase * 0.42;
  const offsetX = Math.cos(angle) * radius * (0.62 + level * 0.14);
  const offsetY = Math.sin(angle) * radius * (0.62 + level * 0.14);
  const gradient = ctx.createLinearGradient(cx - offsetX, cy - offsetY, cx + offsetX, cy + offsetY);
  gradient.addColorStop(0, 'rgba(5, 14, 24, 0.18)');
  gradient.addColorStop(0.18, palette.primary);
  gradient.addColorStop(0.48, 'rgba(10, 18, 32, 0.34)');
  gradient.addColorStop(0.72, palette.secondary);
  gradient.addColorStop(1, palette.accent);
  return gradient;
}

function drawAmplitudeUnderlay(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  voiceState: AgentVoiceState,
  palette: HudPalette,
  phase: number,
  reducedDetail: boolean,
) {
  const waveformRing = voiceState.instrument.waveformRing;
  const bassRing = voiceState.instrument.bassRing;
  const midRing = voiceState.instrument.midRing;
  const highRing = voiceState.instrument.highRing;
  const sampleCount = waveformRing.length || waveformPointCount;
  const step = reducedDetail ? 3 : 1;
  const spin = phase * 0.025;
  const baselineRadius = radius * 0.4;
  const amplitude = radius * (0.3 + voiceState.level * 0.28 + voiceState.peakLevel * 0.12 + voiceState.bandLevels.bass * 0.12);

  ctx.save();
  ctx.beginPath();

  for (let index = 0; index <= sampleCount; index += step) {
    const ratio = index / sampleCount;
    const angle = ratio * Math.PI * 2 - Math.PI / 2 + spin;
    const wave = Math.abs(getRingValue(waveformRing, index, true));
    const bass = getRingValue(bassRing, index);
    const mid = getRingValue(midRing, index);
    const high = getRingValue(highRing, index);
    const pressure = wave * 0.58 + bass * 0.22 + mid * 0.13 + high * 0.07;
    const edge =
      baselineRadius +
      pressure * amplitude +
      Math.sin(angle * 6.5 - phase * 1.1) * voiceState.level * radius * 0.032;
    const x = cx + Math.cos(angle) * edge;
    const y = cy + Math.sin(angle) * edge;
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }

  for (let index = sampleCount; index >= 0; index -= step) {
    const ratio = index / sampleCount;
    const angle = ratio * Math.PI * 2 - Math.PI / 2 + spin;
    const bass = getRingValue(bassRing, index);
    const floor =
      baselineRadius -
      radius * (0.055 + voiceState.level * 0.052 + bass * 0.045) +
      Math.cos(angle * 4.5 + phase * 0.35) * voiceState.level * radius * 0.012;
    ctx.lineTo(cx + Math.cos(angle) * floor, cy + Math.sin(angle) * floor);
  }

  ctx.closePath();
  const gradient = ctx.createRadialGradient(cx, cy, baselineRadius * 0.55, cx, cy, radius * 0.8);
  gradient.addColorStop(0, 'rgba(5, 14, 24, 0.02)');
  gradient.addColorStop(0.42, palette.primary);
  gradient.addColorStop(0.68, palette.secondary);
  gradient.addColorStop(1, palette.accent);
  ctx.fillStyle = gradient;
  ctx.globalAlpha = 0.12 + voiceState.level * 0.26 + voiceState.peakLevel * 0.14;
  ctx.fill();

  ctx.strokeStyle = palette.secondary;
  ctx.lineWidth = Math.max(1.9, radius * (0.01 + voiceState.peakLevel * 0.008));
  ctx.globalAlpha = 0.3 + voiceState.level * 0.34;
  ctx.stroke();
  ctx.restore();
}

function drawAmplitudeCrestGlow(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  voiceState: AgentVoiceState,
  palette: HudPalette,
  phase: number,
  reducedDetail: boolean,
) {
  const waveformRing = voiceState.instrument.waveformRing;
  const bassRing = voiceState.instrument.bassRing;
  const midRing = voiceState.instrument.midRing;
  const highRing = voiceState.instrument.highRing;
  const spectrumWheel = voiceState.instrument.spectrumWheel;
  const sampleCount = waveformRing.length || waveformPointCount;
  const step = reducedDetail ? 3 : 1;
  const baseRadius = radius * 0.47;
  const spin = phase * 0.025;

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.beginPath();

  for (let index = 0; index <= sampleCount; index += step) {
    const ratio = index / sampleCount;
    const angle = ratio * Math.PI * 2 - Math.PI / 2 + spin;
    const wave = Math.abs(getRingValue(waveformRing, index, true));
    const bass = getRingValue(bassRing, index);
    const mid = getRingValue(midRing, index);
    const high = getRingValue(highRing, index);
    const spectrum = getRingValue(spectrumWheel, index);
    const pressure = wave * 0.58 + bass * 0.24 + mid * 0.1 + high * 0.05 + spectrum * 0.03;
    const edge =
      baseRadius +
      pressure * radius * (0.42 + voiceState.level * 0.13) +
      Math.sin(angle * 5.5 - phase * 0.9) * voiceState.level * radius * 0.034;
    const x = cx + Math.cos(angle) * edge;
    const y = cy + Math.sin(angle) * edge;
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }

  ctx.closePath();
  ctx.strokeStyle = createDynamicHudGradient(ctx, cx, cy, radius * 0.96, palette, phase + Math.PI * 0.35, voiceState.level);
  ctx.lineWidth = Math.max(2.2, radius * (0.012 + voiceState.level * 0.012 + voiceState.peakLevel * 0.008));
  ctx.globalAlpha = 0.18 + voiceState.level * 0.42 + voiceState.peakLevel * 0.2;
  ctx.stroke();

  ctx.strokeStyle = palette.secondary;
  ctx.lineWidth = Math.max(0.8, radius * 0.004);
  ctx.globalAlpha = 0.18 + voiceState.level * 0.28;
  ctx.stroke();
  ctx.restore();
}

function drawAmplitudeRibbon(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  voiceState: AgentVoiceState,
  palette: HudPalette,
  phase: number,
  reducedDetail: boolean,
) {
  const waveformRing = voiceState.instrument.waveformRing;
  const bassRing = voiceState.instrument.bassRing;
  const midRing = voiceState.instrument.midRing;
  const highRing = voiceState.instrument.highRing;
  const spectrumWheel = voiceState.instrument.spectrumWheel;
  const sampleCount = waveformRing.length || waveformPointCount;
  const step = reducedDetail ? 3 : 1;
  const baseRadius = radius * 0.47;
  const ribbonThickness = radius * (0.07 + voiceState.level * 0.2 + voiceState.peakLevel * 0.055 + voiceState.bandLevels.bass * 0.1);
  const spin = phase * 0.025;

  ctx.save();
  drawAmplitudeUnderlay(ctx, cx, cy, radius, voiceState, palette, phase, reducedDetail);
  ctx.beginPath();

  for (let index = 0; index <= sampleCount; index += step) {
    const ratio = index / sampleCount;
    const angle = ratio * Math.PI * 2 - Math.PI / 2 + spin;
    const wave = Math.abs(getRingValue(waveformRing, index, true));
    const bass = getRingValue(bassRing, index);
    const mid = getRingValue(midRing, index);
    const high = getRingValue(highRing, index);
    const spectrum = getRingValue(spectrumWheel, index);
    const pressure = wave * 0.58 + bass * 0.24 + mid * 0.1 + high * 0.05 + spectrum * 0.03;
    const edge =
      baseRadius +
      pressure * radius * (0.42 + voiceState.level * 0.13) +
      Math.sin(angle * 5.5 - phase * 0.9) * voiceState.level * radius * 0.034;
    const x = cx + Math.cos(angle) * (edge + ribbonThickness * (0.58 + high * 0.5));
    const y = cy + Math.sin(angle) * (edge + ribbonThickness * (0.58 + high * 0.5));
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }

  for (let index = sampleCount; index >= 0; index -= step) {
    const ratio = index / sampleCount;
    const angle = ratio * Math.PI * 2 - Math.PI / 2 + spin;
    const wave = Math.abs(getRingValue(waveformRing, index, true));
    const bass = getRingValue(bassRing, index);
    const spectrum = getRingValue(spectrumWheel, index);
    const pressure = wave * 0.5 + bass * 0.28 + spectrum * 0.12;
    const edge =
      baseRadius -
      ribbonThickness * (1.02 + bass * 0.7) +
      pressure * radius * 0.13 +
      Math.cos(angle * 4 - phase * 0.4) * voiceState.level * radius * 0.022;
    ctx.lineTo(cx + Math.cos(angle) * edge, cy + Math.sin(angle) * edge);
  }

  ctx.closePath();
  const gradient = createDynamicHudGradient(ctx, cx, cy, radius, palette, phase, voiceState.level);
  ctx.fillStyle = gradient;
  ctx.globalAlpha = 0.2 + voiceState.level * 0.4 + voiceState.peakLevel * 0.16;
  ctx.fill();

  ctx.globalAlpha = 0.42 + voiceState.level * 0.26 + voiceState.peakLevel * 0.34;
  ctx.strokeStyle = palette.secondary;
  ctx.lineWidth = Math.max(3.4, radius * (0.02 + voiceState.level * 0.01 + voiceState.peakLevel * 0.018));
  ctx.stroke();

  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = createDynamicHudGradient(ctx, cx, cy, radius * 0.82, palette, phase + Math.PI * 0.6, voiceState.level);
  ctx.lineWidth = Math.max(1.4, radius * (0.008 + voiceState.peakLevel * 0.009));
  ctx.globalAlpha = 0.12 + voiceState.level * 0.24 + voiceState.peakLevel * 0.16;
  ctx.stroke();
  ctx.globalCompositeOperation = 'source-over';

  ctx.beginPath();
  for (let index = 0; index <= sampleCount; index += step) {
    const ratio = index / sampleCount;
    const angle = ratio * Math.PI * 2 - Math.PI / 2 + spin;
    const wave = Math.abs(getRingValue(waveformRing, index, true));
    const bass = getRingValue(bassRing, index);
    const mid = getRingValue(midRing, index);
    const edge = baseRadius + (wave * 0.72 + bass * 0.28 + mid * 0.18) * radius * (0.38 + voiceState.level * 0.08);
    const x = cx + Math.cos(angle) * edge;
    const y = cy + Math.sin(angle) * edge;
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.strokeStyle = palette.primary;
  ctx.lineWidth = Math.max(1.8, radius * (0.01 + voiceState.level * 0.006 + voiceState.peakLevel * 0.005));
  ctx.globalAlpha = 0.56 + voiceState.level * 0.3;
  ctx.stroke();

  drawAmplitudeCrestGlow(ctx, cx, cy, radius, voiceState, palette, phase, reducedDetail);
  ctx.restore();
}

function drawCentralMembrane(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  level: number,
  voiceState: AgentVoiceState,
  palette: HudPalette,
  phase: number,
  reducedMotion: boolean,
) {
  const waveformRing = voiceState.instrument.waveformRing.length ? voiceState.instrument.waveformRing : voiceState.waveform;
  const spectrumWheel = voiceState.instrument.spectrumWheel.length ? voiceState.instrument.spectrumWheel : voiceState.frequencyBins;
  const bassRing = voiceState.instrument.bassRing;
  const midRing = voiceState.instrument.midRing;
  const highRing = voiceState.instrument.highRing;
  const highAverage = highRing.reduce((total, value) => total + value, 0) / Math.max(1, highRing.length);
  const bandLevels = voiceState.bandLevels;
  const innerRadius = radius * (0.34 + level * 0.02);
  const waveAmplitude = radius * (0.15 + level * 0.22);
  const primaryPhase = reducedMotion ? 0 : phase * 0.85;
  const secondaryPhase = reducedMotion ? 0 : -phase * 0.55;

  ctx.save();
  for (let trail = 3; trail >= 1; trail -= 1) {
    ctx.beginPath();

    for (let index = 0; index <= waveformPointCount; index += 1) {
      const ratio = index / waveformPointCount;
      const angle = ratio * Math.PI * 2 - Math.PI / 2;
      const value = Math.abs(getRingValue(waveformRing, Math.floor(ratio * waveformRing.length), true));
      const bass = getRingValue(bassRing, index);
      const mid = getRingValue(midRing, index);
      const edge =
        innerRadius * (1.08 + trail * 0.11) +
        value * radius * (0.1 + trail * 0.048) +
        bass * radius * (0.028 + trail * 0.012) +
        mid * radius * 0.014 +
        Math.sin(angle * (7 + trail * 3) + primaryPhase * 0.7) * level * radius * 0.01;
      const x = cx + Math.cos(angle) * edge;
      const y = cy + Math.sin(angle) * edge;

      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }

    ctx.closePath();
    ctx.strokeStyle = trail === 3 ? palette.primary : palette.secondary;
    ctx.lineWidth = Math.max(0.55, radius * 0.0028);
    ctx.globalAlpha = 0.1 + trail * 0.045 + level * 0.16;
    ctx.stroke();
  }

  ctx.globalAlpha = 1;
  ctx.beginPath();

  for (let index = 0; index <= waveformPointCount; index += 1) {
    const ratio = index / waveformPointCount;
    const angle = ratio * Math.PI * 2 - Math.PI / 2;
    const wave = getRingValue(waveformRing, Math.floor(ratio * waveformRing.length), true);
    const spectrum = getRingValue(spectrumWheel, index);
    const bass = getRingValue(bassRing, index);
    const mid = getRingValue(midRing, index);
    const high = getRingValue(highRing, index);
    const signal = Math.abs(wave) * 0.5 + spectrum * 0.18 + bass * 0.16 + mid * 0.1 + high * 0.06;
    const edge =
      innerRadius +
      signal * waveAmplitude +
      level * radius * 0.032 +
      bandLevels.sub * radius * 0.02 +
      Math.sin(angle * 8 + primaryPhase) * level * radius * 0.018 +
      Math.cos(angle * 13 + secondaryPhase) * high * radius * 0.017;
    const x = cx + Math.cos(angle) * edge;
    const y = cy + Math.sin(angle) * edge;

    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }

  ctx.closePath();
  ctx.fillStyle = createDynamicHudGradient(ctx, cx, cy, radius * 0.68, palette, phase, level);
  ctx.globalAlpha *= 0.18 + level * 0.12;
  ctx.fill();
  const fill = ctx.createRadialGradient(cx, cy, radius * 0.05, cx, cy, radius * 0.54);
  fill.addColorStop(0, 'rgba(4, 12, 22, 0.66)');
  fill.addColorStop(0.44, 'rgba(9, 21, 36, 0.5)');
  fill.addColorStop(0.72, 'rgba(17, 34, 52, 0.2)');
  fill.addColorStop(1, 'rgba(4, 10, 18, 0.08)');
  ctx.fillStyle = fill;
  ctx.globalAlpha = 1;
  ctx.fill();
  ctx.strokeStyle = palette.secondary;
  ctx.lineWidth = Math.max(2.2, radius * (0.012 + voiceState.peakLevel * 0.006));
  ctx.globalAlpha *= 0.94;
  ctx.stroke();

  ctx.beginPath();
  for (let index = 0; index <= waveformPointCount; index += 1) {
    const ratio = index / waveformPointCount;
    const angle = ratio * Math.PI * 2 - Math.PI / 2;
    const value = getRingValue(spectrumWheel, index);
    const edge = innerRadius * 1.26 + value * radius * 0.18 + level * radius * 0.03;
    const x = cx + Math.cos(angle) * edge;
    const y = cy + Math.sin(angle) * edge;
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.strokeStyle = palette.primary;
  ctx.lineWidth = Math.max(0.9, radius * (0.005 + highAverage * 0.003));
  ctx.globalAlpha *= 0.64 + Math.min(0.2, highAverage * 0.2);
  ctx.stroke();
  ctx.restore();
}

function drawOscilloscopeTrace(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  waveform: number[],
  palette: HudPalette,
  level: number,
) {
  ctx.save();
  ctx.strokeStyle = palette.primary;
  ctx.lineWidth = Math.max(0.9, radius * 0.004);
  ctx.globalAlpha *= 0.42 + level * 0.35;
  ctx.beginPath();

  const traceRadius = radius * 0.24;
  const amplitude = radius * (0.025 + level * 0.045);

  for (let index = 0; index <= waveformPointCount; index += 1) {
    const ratio = index / waveformPointCount;
    const angle = ratio * Math.PI * 2 - Math.PI / 2;
    const wave = getWaveformValue(waveform, Math.floor(ratio * waveform.length));
    const edge = traceRadius + wave * amplitude;
    const x = cx + Math.cos(angle) * edge;
    const y = cy + Math.sin(angle) * edge;
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }

  ctx.closePath();
  ctx.stroke();
  ctx.restore();
}

function drawBandRings(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  voiceState: AgentVoiceState,
  palette: HudPalette,
  phase: number,
  reducedDetail: boolean,
) {
  const bassRing = voiceState.instrument.bassRing;
  const midRing = voiceState.instrument.midRing;
  const highRing = voiceState.instrument.highRing;
  const spectrumWheel = voiceState.instrument.spectrumWheel;

  ctx.save();
  ctx.lineCap = 'round';
  const pathBands = [
    { ring: bassRing, itemRadius: 0.5, amplitude: 0.1, color: palette.secondary, width: 2.2, alpha: 0.36 },
    { ring: midRing, itemRadius: 0.62, amplitude: 0.072, color: palette.primary, width: 1.55, alpha: 0.42 },
    { ring: spectrumWheel, itemRadius: 0.72, amplitude: 0.048, color: palette.accent, width: 1.05, alpha: 0.3 },
  ];

  for (const band of pathBands) {
    if (!band.ring.length) continue;
    ctx.beginPath();
    const step = reducedDetail ? 3 : 1;
    for (let index = 0; index <= band.ring.length; index += step) {
      const value = getRingValue(band.ring, index);
      const angle = (index / band.ring.length) * Math.PI * 2 - Math.PI / 2 + phase * 0.018;
      const edge = radius * band.itemRadius + value * radius * band.amplitude;
      const x = cx + Math.cos(angle) * edge;
      const y = cy + Math.sin(angle) * edge;
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.strokeStyle = band.color;
    ctx.lineWidth = band.width;
    ctx.globalAlpha = band.alpha + voiceState.level * 0.18;
    ctx.stroke();
  }

  ctx.globalAlpha = 0.28 + voiceState.bandLevels.mid * 0.36;
  ctx.strokeStyle = palette.primary;
  ctx.lineWidth = 1.1;
  const segmentStep = reducedDetail ? 8 : 4;
  for (let index = 0; index < midRing.length; index += segmentStep) {
    const value = getRingValue(midRing, index);
    if (value <= 0.015) continue;
    const angle = (index / midRing.length) * Math.PI * 2 - Math.PI / 2 - phase * 0.04;
    const sweep = Math.PI * (0.007 + value * 0.018);
    drawArc(ctx, cx, cy, radius * (0.89 + value * 0.025), angle, sweep, palette.primary, 1.2 + value * 1.6, 0.26 + value * 0.5);
  }

  ctx.globalAlpha = 0.22 + voiceState.bandLevels.brilliance * 0.4;
  ctx.strokeStyle = palette.secondary;
  ctx.lineWidth = 0.8;
  const highStep = reducedDetail ? 6 : 2;
  for (let index = 0; index < highRing.length; index += highStep) {
    const value = getRingValue(highRing, index);
    if (value <= 0.01) continue;
    const angle = (index / highRing.length) * Math.PI * 2 - Math.PI / 2 + phase * 0.025;
    const inner = radius * (0.97 - value * 0.012);
    const outer = radius * (1.0 + value * 0.13);
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(angle) * inner, cy + Math.sin(angle) * inner);
    ctx.lineTo(cx + Math.cos(angle) * outer, cy + Math.sin(angle) * outer);
    ctx.stroke();
  }

  ctx.restore();
}

function drawPeakAndTransientMarkers(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  voiceState: AgentVoiceState,
  palette: HudPalette,
  phase: number,
) {
  const peakAngle = getFrequencyAngle(voiceState.spectralCentroidHz ?? voiceState.dominantFrequencyHz);

  ctx.save();
  ctx.lineCap = 'round';
  ctx.strokeStyle = palette.secondary;
  ctx.lineWidth = 2;
  ctx.globalAlpha *= 0.38 + voiceState.peakLevel * 0.42;
  ctx.beginPath();
  ctx.moveTo(cx + Math.cos(peakAngle) * radius * 0.71, cy + Math.sin(peakAngle) * radius * 0.71);
  ctx.lineTo(cx + Math.cos(peakAngle) * radius * 0.82, cy + Math.sin(peakAngle) * radius * 0.82);
  ctx.stroke();

  for (const event of voiceState.instrument.transientEvents) {
    const fade = 1 - clamp(event.age);
    const pulseRadius = radius * (0.68 + event.age * 0.52 + event.level * 0.08);
    const sweep = Math.PI * (0.16 + event.level * 0.42) * fade;
    ctx.strokeStyle = event.level > 0.55 ? palette.secondary : palette.primary;
    ctx.lineWidth = 0.9 + event.level * 1.8;
    ctx.globalAlpha = fade * (0.16 + event.level * 0.56);
    ctx.beginPath();
    ctx.arc(cx, cy, pulseRadius, event.angle - sweep * 0.5 + phase * 0.05, event.angle + sweep * 0.5 + phase * 0.05);
    ctx.stroke();
  }

  ctx.restore();
}

function drawAudioHistoryTrail(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  voiceState: AgentVoiceState,
  palette: HudPalette,
  phase: number,
) {
  const history = voiceState.history;
  if (!history.length) return;

  ctx.save();
  ctx.fillStyle = palette.primary;

  for (let index = 0; index < history.length; index += 1) {
    const value = getAudioValue(history, index);
    if (value <= 0.01) continue;
    const age = index / Math.max(1, history.length - 1);
    const angle = -Math.PI * 0.92 + age * Math.PI * 1.84 + phase * 0.08;
    const distance = radius * (1.0 + value * 0.16);
    ctx.globalAlpha = value * age * 0.36;
    ctx.beginPath();
    ctx.arc(cx + Math.cos(angle) * distance, cy + Math.sin(angle) * distance, 0.9 + value * 2.4, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function drawSpectrumSpikes(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  level: number,
  spectrum: number[],
  palette: HudPalette,
) {
  ctx.save();
  ctx.strokeStyle = palette.secondary;
  ctx.lineCap = 'round';
  ctx.globalAlpha *= 0.28 + level * 0.45;

  for (let index = 0; index < spectrumBinCount; index += 1) {
    const value = getAudioValue(spectrum, index);
    const angle = (index / spectrumBinCount) * Math.PI * 2 - Math.PI / 2;
    const inner = radius * (0.62 - value * 0.03);
    const outer = radius * (0.66 + value * 0.26 + level * 0.06);
    ctx.lineWidth = 0.8 + value * 1.6;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(angle) * inner, cy + Math.sin(angle) * inner);
    ctx.lineTo(cx + Math.cos(angle) * outer, cy + Math.sin(angle) * outer);
    ctx.stroke();
  }

  ctx.restore();
}

function drawRadialEqComb(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  level: number,
  frequencyBins: number[],
  palette: HudPalette,
) {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.globalAlpha *= 0.2 + level * 0.48;

  for (let index = 0; index < spectrumBinCount; index += 1) {
    const binIndex = Math.floor((index / spectrumBinCount) * Math.max(1, frequencyBins.length - 1));
    const value = getAudioValue(frequencyBins, binIndex);
    const angle = (index / spectrumBinCount) * Math.PI * 2 - Math.PI / 2;
    const inner = radius * (0.78 - value * 0.025);
    const outer = radius * (0.82 + value * 0.34 + level * 0.04);
    ctx.strokeStyle = index % 3 === 0 ? palette.primary : palette.secondary;
    ctx.lineWidth = 0.55 + value * 1.25;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(angle) * inner, cy + Math.sin(angle) * inner);
    ctx.lineTo(cx + Math.cos(angle) * outer, cy + Math.sin(angle) * outer);
    ctx.stroke();
  }

  ctx.restore();
}

function drawNeuralNodes(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  level: number,
  palette: HudPalette,
  phase: number,
) {
  const nodes = Array.from({ length: 14 }, (_, index) => {
    const angle = (index / 14) * Math.PI * 2 + Math.sin(phase * 0.22 + index) * 0.04;
    const distance = radius * (0.64 + (index % 3) * 0.09);
    return {
      x: cx + Math.cos(angle) * distance,
      y: cy + Math.sin(angle) * distance,
      size: 2.2 + (index % 4) * 0.45 + level * 2.5,
    };
  });

  ctx.save();
  ctx.strokeStyle = palette.primary;
  ctx.lineWidth = 0.8;
  ctx.globalAlpha *= 0.2 + level * 0.12;
  for (let index = 0; index < nodes.length; index += 1) {
    const node = nodes[index];
    const next = nodes[(index + 3) % nodes.length];
    if (!node || !next) continue;
    ctx.beginPath();
    ctx.moveTo(node.x, node.y);
    ctx.lineTo(next.x, next.y);
    ctx.stroke();
  }

  ctx.fillStyle = palette.accent;
  ctx.globalAlpha *= 2.4;
  for (const node of nodes) {
    ctx.beginPath();
    ctx.arc(node.x, node.y, node.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawDesignLayer(
  ctx: CanvasRenderingContext2D,
  designId: WorkspaceHudDesignId,
  cx: number,
  cy: number,
  radius: number,
  palette: HudPalette,
  phase: number,
  level: number,
  signals: WorkspaceHudSignals,
) {
  const commandRatio = getCommandRatio(signals);
  const notificationRatio = getNotificationRatio(signals);
  const integrationRatio = getIntegrationRatio(signals);

  if (designId === 'signal-halo') {
    drawSegmentedRing(ctx, cx, cy, radius * 1.04, 64, -phase * 0.28, palette.primary, 0.95, 0.5, 0.86);
    drawSegmentedRing(ctx, cx, cy, radius * 0.86, 44, phase * 0.22, palette.secondary, 1.4, 0.46, commandRatio);
    drawSegmentedRing(ctx, cx, cy, radius * 0.58, 32, -phase * 0.18, palette.primary, 0.95, 0.3, 1);
    drawArc(ctx, cx, cy, radius * 1.13, -Math.PI / 2, Math.PI * 2 * integrationRatio, palette.accent, 2.7, 0.7);
    return;
  }

  if (designId === 'network-aperture') {
    drawSegmentedRing(ctx, cx, cy, radius * 1.02, 24, phase * 0.12, palette.primary, 1.1, 0.42, integrationRatio);
    drawNeuralNodes(ctx, cx, cy, radius, level, palette, phase);
    drawArc(ctx, cx, cy, radius * 0.78, Math.PI * 0.22, Math.PI * 2 * commandRatio, palette.secondary, 2.4, 0.58);
    return;
  }

  if (designId === 'diagnostic-compass') {
    drawCrossLines(ctx, cx, cy, radius, palette.primary, 0.24);
    drawSegmentedRing(ctx, cx, cy, radius * 0.98, 8, Math.PI / 8, palette.primary, 2, 0.36, 1);
    drawSegmentedRing(ctx, cx, cy, radius * 0.7, 16, -phase * 0.16, palette.accent, 1.1, 0.48, notificationRatio);
    return;
  }

  drawSegmentedRing(ctx, cx, cy, radius * 1.02, 42, phase * 0.16, palette.primary, 1.2, 0.48, 0.9);
  drawSegmentedRing(ctx, cx, cy, radius * 0.84, 24, -phase * 0.24, palette.secondary, 1.8, 0.42, commandRatio);
  drawSegmentedRing(ctx, cx, cy, radius * 0.62, 32, phase * 0.08, palette.accent, 1, 0.42, integrationRatio);
}

function drawHudFrame({
  ctx,
  width,
  height,
  settings,
  signals,
  voiceState,
  interacting,
  reducedMotion,
  palette,
  locale,
  smoothedSpectrum,
  timestamp,
}: {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  settings: WorkspaceHudSettings;
  signals: WorkspaceHudSignals;
  voiceState: AgentVoiceState;
  interacting: boolean;
  reducedMotion: boolean;
  palette: HudPalette;
  locale?: string;
  smoothedSpectrum: number[];
  timestamp: number;
}) {
  ctx.clearRect(0, 0, width, height);

  const level = settings.voiceReactionEnabled && voiceState.enabled ? clamp(voiceState.level) : 0;
  const sourceSpectrum =
    settings.voiceReactionEnabled && voiceState.enabled
      ? voiceState.instrument.spectrumWheel.length
        ? voiceState.instrument.spectrumWheel
        : voiceState.spectrum
      : [];
  const smoothing = interacting || reducedMotion ? 0.14 : 0.32;

  for (let index = 0; index < spectrumBinCount; index += 1) {
    const next = getAudioValue(sourceSpectrum, index);
    smoothedSpectrum[index] = (smoothedSpectrum[index] ?? 0) + (next - (smoothedSpectrum[index] ?? 0)) * smoothing;
  }

  const shortest = Math.min(width, height);
  const narrow = width < 620;
  const radius = clamp(shortest * (narrow ? 0.23 : 0.26), 82, 220);
  const cx = width / 2;
  const cy = height * (narrow ? 0.5 : 0.53);
  const phase = reducedMotion ? 0 : timestamp / 1000;
  const visualAlpha = interacting ? 0.4 : narrow ? 0.58 : 0.9;

  ctx.save();
  ctx.globalAlpha = visualAlpha;
  ctx.lineJoin = 'round';

  const glow = ctx.createRadialGradient(cx, cy, radius * 0.1, cx, cy, radius * 1.38);
  glow.addColorStop(0, `rgba(120, 238, 255, ${0.13 + level * 0.1})`);
  glow.addColorStop(0.46, 'rgba(22, 99, 142, 0.06)');
  glow.addColorStop(1, 'rgba(1, 8, 15, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(cx, cy, radius * 1.38, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = palette.muted;
  ctx.lineWidth = 1;
  ctx.globalAlpha *= 0.58;
  drawGhostRing(ctx, cx, cy, radius * 1.28, palette.primary, 0.16, 0.7);
  drawGhostRing(ctx, cx, cy, radius * 1.11, palette.muted, 0.3, 0.9);
  drawGhostRing(ctx, cx, cy, radius * 0.73, palette.secondary, 0.16, 0.8);
  drawGhostRing(ctx, cx, cy, radius * 0.47, palette.muted, 0.38, 0.8);
  drawGhostRing(ctx, cx, cy, radius * 0.2, palette.primary, 0.3, 0.75);
  ctx.globalAlpha = visualAlpha;

  drawDottedRing(ctx, cx, cy, radius * 0.52, 72, palette.primary, 0.38, phase * 0.08, 0.72);
  drawDottedRing(ctx, cx, cy, radius * 0.94, 96, palette.secondary, 0.26, -phase * 0.05, getNotificationRatio(signals));
  drawTicks(ctx, cx, cy, radius * 1.12, 96, palette.primary, 0.36);
  drawBracketMarks(ctx, cx, cy, radius * 1.33, palette.primary, 0.42);
  drawDesignLayer(ctx, settings.designId, cx, cy, radius, palette, phase, level, signals);
  drawAudioHistoryTrail(ctx, cx, cy, radius, voiceState, palette, phase);
  drawRadialEqComb(ctx, cx, cy, radius, level, voiceState.instrument.spectrumWheel, palette);
  drawSpectrumSpikes(ctx, cx, cy, radius, level, smoothedSpectrum, palette);
  drawBandRings(ctx, cx, cy, radius, voiceState, palette, phase, interacting || reducedMotion);
  drawAmplitudeRibbon(ctx, cx, cy, radius, voiceState, palette, phase, interacting || reducedMotion);
  drawCentralMembrane(ctx, cx, cy, radius, level, voiceState, palette, phase, reducedMotion);
  drawOscilloscopeTrace(ctx, cx, cy, radius, voiceState.instrument.waveformRing, palette, level);
  drawPeakAndTransientMarkers(ctx, cx, cy, radius, voiceState, palette, phase);
  drawLowerArcGauges(ctx, cx, cy, radius, palette, signals);

  drawArc(ctx, cx, cy, radius * 1.18, -Math.PI / 2, Math.PI * 2 * getCommandRatio(signals), palette.primary, 2.4, 0.82);
  drawArc(ctx, cx, cy, radius * 0.96, Math.PI * 0.1, Math.PI * 2 * getNotificationRatio(signals), palette.secondary, 2, 0.72);
  drawArc(ctx, cx, cy, radius * 0.76, Math.PI * 0.62, Math.PI * 2 * getIntegrationRatio(signals), palette.accent, 1.7, 0.7);

  ctx.fillStyle = palette.glass;
  ctx.strokeStyle = palette.primary;
  ctx.lineWidth = 1.2;
  ctx.globalAlpha *= 0.76;
  ctx.beginPath();
  ctx.arc(cx, cy, radius * 0.1 + level * radius * 0.025, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  const labelRadius = radius * (narrow ? 1.34 : 1.42);
  const labels = [
    { label: 'AMP', value: formatPercent(voiceState.amplitude), angle: -Math.PI / 2, align: 'center' as const },
    { label: 'PEAK', value: formatPercent(voiceState.peakLevel), angle: -Math.PI * 0.68, align: 'right' as const },
    { label: 'HZ', value: formatFrequency(voiceState.spectralCentroidHz ?? voiceState.dominantFrequencyHz), angle: -Math.PI * 0.28, align: 'left' as const },
    { label: 'WL', value: formatWavelength(voiceState.wavelengthMeters), angle: Math.PI * 0.26, align: 'left' as const },
    { label: 'BASS', value: formatPercent(voiceState.bandLevels.bass), angle: Math.PI * 0.66, align: 'right' as const },
    { label: 'MID', value: formatPercent(voiceState.bandLevels.mid), angle: Math.PI / 2, align: 'center' as const },
    { label: 'HIGH', value: formatPercent(voiceState.bandLevels.brilliance), angle: Math.PI * 0.34, align: 'left' as const },
    { label: 'CMD', value: formatCompactNumber(signals.pendingCommands, locale), angle: Math.PI, align: 'right' as const },
  ];

  for (const item of labels) {
    const x = cx + Math.cos(item.angle) * labelRadius;
    const y = cy + Math.sin(item.angle) * labelRadius;
    drawMicroLabel(ctx, item.label, item.value, x, y, item.align, palette, radius);
  }

  ctx.restore();
}

function readPalette(root: HTMLElement): HudPalette {
  const styles = getComputedStyle(root);
  return {
    primary: styles.getPropertyValue('--hud-primary').trim() || 'rgba(78, 231, 255, 0.9)',
    secondary: styles.getPropertyValue('--hud-secondary').trim() || 'rgba(240, 82, 255, 0.9)',
    accent: styles.getPropertyValue('--hud-accent').trim() || 'rgba(255, 188, 92, 0.86)',
    muted: styles.getPropertyValue('--hud-muted').trim() || 'rgba(226, 238, 248, 0.5)',
    glass: styles.getPropertyValue('--hud-surface').trim() || 'rgba(4, 13, 22, 0.28)',
  };
}

export function WorkspaceHud({
  settings,
  signals,
  voiceState,
  interacting,
  locale,
}: {
  settings: WorkspaceHudSettings;
  signals: WorkspaceHudSignals;
  voiceState: AgentVoiceState;
  interacting: boolean;
  locale?: string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const settingsRef = useRef(settings);
  const signalsRef = useRef(signals);
  const voiceStateRef = useRef(voiceState);
  const interactingRef = useRef(interacting);
  const localeRef = useRef(locale);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    signalsRef.current = signals;
  }, [signals]);

  useEffect(() => {
    voiceStateRef.current = voiceState;
  }, [voiceState]);

  useEffect(() => {
    interactingRef.current = interacting;
  }, [interacting]);

  useEffect(() => {
    localeRef.current = locale;
  }, [locale]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const root = rootRef.current;
    if (!canvas || !root || typeof window === 'undefined') return undefined;
    if (window.navigator.userAgent.toLowerCase().includes('jsdom')) return undefined;

    let context: CanvasRenderingContext2D | null = null;
    try {
      context = canvas.getContext('2d');
    } catch {
      return undefined;
    }
    if (!context) return undefined;

    const smoothedSpectrum = Array.from({ length: spectrumBinCount }, () => 0);
    const mediaQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const scheduleAnimationFrame =
      window.requestAnimationFrame?.bind(window) ??
      ((callback: FrameRequestCallback) => window.setTimeout(() => callback(performance.now()), 16));
    const cancelAnimationFrame =
      window.cancelAnimationFrame?.bind(window) ?? ((handle: number) => window.clearTimeout(handle));
    let reducedMotion = mediaQuery?.matches ?? false;
    let width = 0;
    let height = 0;
    let animationFrame = 0;

    const resize = () => {
      const rect = root.getBoundingClientRect();
      const nextWidth = Math.max(240, Math.floor(rect.width));
      const nextHeight = Math.max(240, Math.floor(rect.height));
      const ratio = Math.min(window.devicePixelRatio || 1, maxDevicePixelRatio);

      if (nextWidth === width && nextHeight === height && canvas.width === Math.floor(nextWidth * ratio)) return;

      width = nextWidth;
      height = nextHeight;
      canvas.width = Math.floor(width * ratio);
      canvas.height = Math.floor(height * ratio);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context?.setTransform(ratio, 0, 0, ratio, 0, 0);
    };

    const handleMotionChange = () => {
      reducedMotion = mediaQuery?.matches ?? false;
    };

    mediaQuery?.addEventListener?.('change', handleMotionChange);
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(resize);
    observer?.observe(root);
    resize();

    const render = (timestamp: number) => {
      resize();
      drawHudFrame({
        ctx: context,
        width,
        height,
        settings: settingsRef.current,
        signals: signalsRef.current,
        voiceState: settingsRef.current.voiceReactionEnabled ? getLatestAgentVoiceState() : voiceStateRef.current,
        interacting: interactingRef.current,
        reducedMotion,
        palette: readPalette(root),
        locale: localeRef.current,
        smoothedSpectrum,
        timestamp,
      });
      animationFrame = scheduleAnimationFrame(render);
    };

    animationFrame = scheduleAnimationFrame(render);

    return () => {
      mediaQuery?.removeEventListener?.('change', handleMotionChange);
      observer?.disconnect();
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }
    };
  }, []);

  return (
    <div
      ref={rootRef}
      className={classNames(
        'workspace-hud',
        `design-${settings.designId}`,
        getColorModeClass(settings.colorMode),
        interacting && 'is-interacting',
        settings.voiceReactionEnabled && voiceState.enabled && voiceState.level > 0 && 'is-voice-active',
      )}
      aria-label={getWorkspaceHudMessage('hud.title', locale)}
    >
      <canvas className="workspace-hud-canvas" ref={canvasRef} aria-hidden="true" />
    </div>
  );
}
