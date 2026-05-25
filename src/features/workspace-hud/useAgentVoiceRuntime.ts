import { useCallback, useEffect, useRef, useState } from 'react';

import type {
  AgentVoiceEventDetail,
  AgentVoiceInstrument,
  AgentVoiceState,
  AgentVoiceTransientEvent,
} from './workspaceHudTypes';

export const agentVoiceEventName = 'mission-control-agent-voice';
const speedOfSoundMetersPerSecond = 343;
const spectrumBinCount = 128;
const waveformSampleCount = 128;
const historySampleCount = 42;
const instrumentRingSampleCount = 192;
const minInstrumentFrequencyHz = 20;
const maxInstrumentFrequencyHz = 16_000;
const defaultBandLevels: AgentVoiceState['bandLevels'] = {
  sub: 0,
  bass: 0,
  lowMid: 0,
  mid: 0,
  presence: 0,
  brilliance: 0,
};

export function normalizeVoiceLevel(level: unknown) {
  if (typeof level !== 'number' || Number.isNaN(level)) return 0;
  return Math.max(0, Math.min(1, level));
}

export function normalizeVoiceSpectrum(spectrum: unknown, binCount = spectrumBinCount) {
  if (!Array.isArray(spectrum)) return Array.from({ length: binCount }, () => 0);
  return Array.from({ length: binCount }, (_, index) => normalizeVoiceLevel(spectrum[index]));
}

export function normalizeVoiceWaveform(waveform: unknown, sampleCount = waveformSampleCount) {
  if (!Array.isArray(waveform)) return Array.from({ length: sampleCount }, () => 0);
  return Array.from({ length: sampleCount }, (_, index) => {
    const value = waveform[index];
    if (typeof value !== 'number' || Number.isNaN(value)) return 0;
    return Math.max(-1, Math.min(1, value));
  });
}

function createZeroRing(sampleCount = instrumentRingSampleCount) {
  return Array.from({ length: sampleCount }, () => 0);
}

function normalizeInstrumentRing(ring: unknown, sampleCount = instrumentRingSampleCount, signed = false) {
  if (!Array.isArray(ring)) return createZeroRing(sampleCount);
  return Array.from({ length: sampleCount }, (_, index) => {
    const value = ring[index];
    if (typeof value !== 'number' || Number.isNaN(value)) return 0;
    return signed ? Math.max(-1, Math.min(1, value)) : normalizeVoiceLevel(value);
  });
}

function normalizeTransientEvents(events: unknown): AgentVoiceTransientEvent[] {
  if (!Array.isArray(events)) return [];

  return events
    .map((event) => {
      if (!event || typeof event !== 'object') return null;
      const item = event as Partial<AgentVoiceTransientEvent>;
      const level = normalizeVoiceLevel(item.level);
      const age = normalizeVoiceLevel(item.age);
      const angle = typeof item.angle === 'number' && Number.isFinite(item.angle) ? item.angle : 0;
      return level > 0 ? { level, age, angle } : null;
    })
    .filter((event): event is AgentVoiceTransientEvent => event !== null)
    .slice(0, 8);
}

export function createSilentAudioInstrument(sampleCount = instrumentRingSampleCount): AgentVoiceInstrument {
  return {
    waveformRing: createZeroRing(sampleCount),
    spectrumWheel: createZeroRing(sampleCount),
    bassRing: createZeroRing(sampleCount),
    midRing: createZeroRing(sampleCount),
    highRing: createZeroRing(sampleCount),
    transientEvents: [],
  };
}

export function getLogFrequencyRatio(frequencyHz: number | null) {
  if (!frequencyHz || !Number.isFinite(frequencyHz) || frequencyHz <= 0) return 0;
  return normalizeVoiceLevel(
    Math.log(frequencyHz / minInstrumentFrequencyHz) /
      Math.log(maxInstrumentFrequencyHz / minInstrumentFrequencyHz),
  );
}

function getFrequencyBinValue(frequencyData: Uint8Array, sampleRate: number, fftSize: number, frequencyHz: number) {
  const bin = Math.max(0, Math.min(frequencyData.length - 1, Math.round((frequencyHz * fftSize) / sampleRate)));
  return normalizeVoiceLevel((frequencyData[bin] ?? 0) / 255);
}

function getMirroredLogFrequency(index: number, sampleCount: number, minHz: number, maxHz: number, phase = 0) {
  const normalized = (((index / sampleCount + phase) % 1) + 1) % 1;
  const folded = normalized <= 0.5 ? normalized * 2 : (1 - normalized) * 2;
  return minHz * (maxHz / minHz) ** folded;
}

export function getLogFrequencyWheel(
  frequencyData: Uint8Array | number[],
  sampleRate = 44_100,
  fftSize = 2048,
  sampleCount = instrumentRingSampleCount,
) {
  const data =
    frequencyData instanceof Uint8Array
      ? frequencyData
      : Uint8Array.from(frequencyData.map((value) => Math.round(normalizeVoiceLevel(value) * 255)));

  return Array.from({ length: sampleCount }, (_, index) => {
    const primaryHz = getMirroredLogFrequency(index, sampleCount, minInstrumentFrequencyHz, maxInstrumentFrequencyHz);
    const shiftedHz = getMirroredLogFrequency(index, sampleCount, minInstrumentFrequencyHz, maxInstrumentFrequencyHz, 0.25);
    const primary = getFrequencyBinValue(data, sampleRate, fftSize, primaryHz);
    const shifted = getFrequencyBinValue(data, sampleRate, fftSize, shiftedHz);
    return normalizeVoiceLevel(primary * 0.72 + shifted * 0.28);
  });
}

export function getAudioBandRing(
  frequencyData: Uint8Array | number[],
  sampleRate: number,
  fftSize: number,
  minHz: number,
  maxHz: number,
  bandLevel: number,
  phase = 0,
  sampleCount = instrumentRingSampleCount,
) {
  const data =
    frequencyData instanceof Uint8Array
      ? frequencyData
      : Uint8Array.from(frequencyData.map((value) => Math.round(normalizeVoiceLevel(value) * 255)));

  return Array.from({ length: sampleCount }, (_, index) => {
    const frequencyHz = getMirroredLogFrequency(index, sampleCount, minHz, maxHz, phase);
    const direct = getFrequencyBinValue(data, sampleRate, fftSize, frequencyHz);
    return normalizeVoiceLevel(direct * 0.76 + normalizeVoiceLevel(bandLevel) * 0.24);
  });
}

export function getWaveformRing(waveform: number[], sampleCount = instrumentRingSampleCount) {
  const samples = normalizeVoiceWaveform(waveform, Math.max(1, waveform.length || waveformSampleCount));
  return Array.from({ length: sampleCount }, (_, index) => {
    const normalized = index / sampleCount;
    const sourceIndex =
      normalized <= 0.5
        ? Math.floor(normalized * 2 * samples.length)
        : Math.floor((1 - normalized) * 2 * samples.length);
    const direct = samples[sourceIndex % samples.length] ?? 0;
    const offset = samples[(sourceIndex + Math.floor(samples.length / 3)) % samples.length] ?? 0;
    return Math.max(-1, Math.min(1, direct * 0.78 + offset * 0.22));
  });
}

export function getNextTransientEvents(
  previousEvents: AgentVoiceTransientEvent[],
  transientLevel: number,
  spectralCentroidHz: number | null,
) {
  const agedEvents = normalizeTransientEvents(previousEvents)
    .map((event) => ({
      ...event,
      age: normalizeVoiceLevel(event.age + 0.035),
      level: normalizeVoiceLevel(event.level * 0.955),
    }))
    .filter((event) => event.age < 1 && event.level > 0.025);

  const nextLevel = normalizeVoiceLevel(transientLevel);
  const hasRecentEvent = agedEvents.some((event) => event.age < 0.14);
  if (nextLevel > 0.18 && !hasRecentEvent) {
    agedEvents.unshift({
      level: nextLevel,
      age: 0,
      angle: -Math.PI / 2 + getLogFrequencyRatio(spectralCentroidHz ?? 440) * Math.PI * 2,
    });
  }

  return agedEvents.slice(0, 8);
}

export function createAudioInstrumentFromAnalyzer({
  waveform,
  frequencyData,
  sampleRate = 44_100,
  fftSize = 2048,
  bandLevels,
  transientLevel = 0,
  spectralCentroidHz = null,
  previousTransientEvents = [],
}: {
  waveform: number[];
  frequencyData: Uint8Array | number[];
  sampleRate?: number;
  fftSize?: number;
  bandLevels: AgentVoiceState['bandLevels'];
  transientLevel?: number;
  spectralCentroidHz?: number | null;
  previousTransientEvents?: AgentVoiceTransientEvent[];
}): AgentVoiceInstrument {
  return {
    waveformRing: getWaveformRing(waveform),
    spectrumWheel: getLogFrequencyWheel(frequencyData, sampleRate, fftSize),
    bassRing: getAudioBandRing(frequencyData, sampleRate, fftSize, 40, 260, bandLevels.bass, 0.08),
    midRing: getAudioBandRing(frequencyData, sampleRate, fftSize, 260, 2_400, bandLevels.mid, 0.2),
    highRing: getAudioBandRing(
      frequencyData,
      sampleRate,
      fftSize,
      2_400,
      14_000,
      Math.max(bandLevels.presence, bandLevels.brilliance),
      0.34,
    ),
    transientEvents: getNextTransientEvents(previousTransientEvents, transientLevel, spectralCentroidHz),
  };
}

function normalizeAudioInstrument(
  instrument: Partial<AgentVoiceInstrument> | undefined,
  fallback = createSilentAudioInstrument(),
): AgentVoiceInstrument {
  return {
    waveformRing: normalizeInstrumentRing(instrument?.waveformRing ?? fallback.waveformRing, instrumentRingSampleCount, true),
    spectrumWheel: normalizeInstrumentRing(instrument?.spectrumWheel ?? fallback.spectrumWheel),
    bassRing: normalizeInstrumentRing(instrument?.bassRing ?? fallback.bassRing),
    midRing: normalizeInstrumentRing(instrument?.midRing ?? fallback.midRing),
    highRing: normalizeInstrumentRing(instrument?.highRing ?? fallback.highRing),
    transientEvents: normalizeTransientEvents(instrument?.transientEvents ?? fallback.transientEvents),
  };
}

export function getWavelengthMeters(frequencyHz: number | null) {
  if (!frequencyHz || !Number.isFinite(frequencyHz) || frequencyHz <= 0) return null;
  return speedOfSoundMetersPerSecond / frequencyHz;
}

function getDominantFrequencyHz(frequencyData: Uint8Array, sampleRate: number, fftSize: number) {
  let maxValue = 0;
  let maxIndex = 0;

  for (let index = 1; index < frequencyData.length; index += 1) {
    const value = frequencyData[index] ?? 0;
    if (value > maxValue) {
      maxValue = value;
      maxIndex = index;
    }
  }

  if (maxValue < 8) return null;
  return (maxIndex * sampleRate) / fftSize;
}

function getRmsAmplitude(timeData: Uint8Array) {
  if (!timeData.length) return 0;

  const sum = timeData.reduce((total, value) => {
    const centered = (value - 128) / 128;
    return total + centered * centered;
  }, 0);

  return normalizeVoiceLevel(Math.sqrt(sum / timeData.length) * 2.6);
}

function getSpectrumBins(frequencyData: Uint8Array, binCount = spectrumBinCount) {
  const bins: number[] = [];
  const bucketSize = Math.max(1, Math.floor(frequencyData.length / binCount));

  for (let bin = 0; bin < binCount; bin += 1) {
    const start = bin * bucketSize;
    const end = Math.min(frequencyData.length, start + bucketSize);
    let total = 0;

    for (let index = start; index < end; index += 1) {
      total += frequencyData[index] ?? 0;
    }

    bins.push(normalizeVoiceLevel(total / Math.max(1, end - start) / 255));
  }

  return bins;
}

function getWaveformSamples(timeData: Uint8Array, sampleCount = waveformSampleCount) {
  const bucketSize = Math.max(1, Math.floor(timeData.length / sampleCount));
  return Array.from({ length: sampleCount }, (_, sample) => {
    const start = sample * bucketSize;
    const end = Math.min(timeData.length, start + bucketSize);
    let total = 0;

    for (let index = start; index < end; index += 1) {
      total += ((timeData[index] ?? 128) - 128) / 128;
    }

    return Math.max(-1, Math.min(1, total / Math.max(1, end - start)));
  });
}

function getAverageBandLevel(frequencyData: Uint8Array, sampleRate: number, fftSize: number, minHz: number, maxHz: number) {
  const start = Math.max(1, Math.floor((minHz * fftSize) / sampleRate));
  const end = Math.min(frequencyData.length - 1, Math.ceil((maxHz * fftSize) / sampleRate));
  if (end <= start) return 0;

  let total = 0;
  for (let index = start; index <= end; index += 1) {
    total += frequencyData[index] ?? 0;
  }

  return normalizeVoiceLevel(total / Math.max(1, end - start + 1) / 255);
}

export function getAudioBandLevels(
  frequencyData: Uint8Array | number[],
  sampleRate = 44_100,
  fftSize = 2048,
): AgentVoiceState['bandLevels'] {
  const data = frequencyData instanceof Uint8Array ? frequencyData : Uint8Array.from(frequencyData.map((value) => Math.round(normalizeVoiceLevel(value) * 255)));

  return {
    sub: getAverageBandLevel(data, sampleRate, fftSize, 20, 60),
    bass: getAverageBandLevel(data, sampleRate, fftSize, 60, 250),
    lowMid: getAverageBandLevel(data, sampleRate, fftSize, 250, 500),
    mid: getAverageBandLevel(data, sampleRate, fftSize, 500, 2_000),
    presence: getAverageBandLevel(data, sampleRate, fftSize, 2_000, 6_000),
    brilliance: getAverageBandLevel(data, sampleRate, fftSize, 6_000, 16_000),
  };
}

export function getSpectralCentroidHz(frequencyData: Uint8Array | number[], sampleRate = 44_100, fftSize = 2048) {
  let weightedTotal = 0;
  let magnitudeTotal = 0;

  for (let index = 1; index < frequencyData.length; index += 1) {
    const magnitude = frequencyData[index] ?? 0;
    const frequency = (index * sampleRate) / fftSize;
    weightedTotal += frequency * magnitude;
    magnitudeTotal += magnitude;
  }

  if (magnitudeTotal <= 0) return null;
  return weightedTotal / magnitudeTotal;
}

function normalizeBandLevels(bandLevels: Partial<AgentVoiceState['bandLevels']> | undefined): AgentVoiceState['bandLevels'] {
  return {
    sub: normalizeVoiceLevel(bandLevels?.sub),
    bass: normalizeVoiceLevel(bandLevels?.bass),
    lowMid: normalizeVoiceLevel(bandLevels?.lowMid),
    mid: normalizeVoiceLevel(bandLevels?.mid),
    presence: normalizeVoiceLevel(bandLevels?.presence),
    brilliance: normalizeVoiceLevel(bandLevels?.brilliance),
  };
}

function createInitialVoiceState(enabled: boolean): AgentVoiceState {
  return {
    enabled,
    status: 'idle',
    level: 0,
    source: typeof window === 'undefined' || !('speechSynthesis' in window) ? 'unavailable' : 'web-speech',
    amplitude: null,
    dominantFrequencyHz: null,
    wavelengthMeters: null,
    spectralCentroidHz: null,
    peakLevel: 0,
    transientLevel: 0,
    bandLevels: defaultBandLevels,
    waveform: normalizeVoiceWaveform(null),
    frequencyBins: normalizeVoiceSpectrum(null),
    history: normalizeVoiceSpectrum(null, historySampleCount),
    instrument: createSilentAudioInstrument(),
    spectrum: normalizeVoiceSpectrum(null),
  };
}

let latestAgentVoiceState = createInitialVoiceState(false);

function setLatestAgentVoiceState(next: AgentVoiceState) {
  latestAgentVoiceState = next;
  return next;
}

export function getLatestAgentVoiceState() {
  return latestAgentVoiceState;
}

export function useAgentVoiceRuntime(enabled: boolean, audioMeterEnabled = false) {
  const [voiceState, setVoiceState] = useState<AgentVoiceState>(() => setLatestAgentVoiceState(createInitialVoiceState(enabled)));
  const pulseTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    setVoiceState((current) =>
      setLatestAgentVoiceState({
        ...current,
        enabled,
        level: enabled ? current.level : 0,
        status: enabled ? current.status : 'idle',
        amplitude: enabled ? current.amplitude : null,
        dominantFrequencyHz: enabled ? current.dominantFrequencyHz : null,
        wavelengthMeters: enabled ? current.wavelengthMeters : null,
        spectralCentroidHz: enabled ? current.spectralCentroidHz : null,
        peakLevel: enabled ? current.peakLevel : 0,
        transientLevel: enabled ? current.transientLevel : 0,
        bandLevels: enabled ? current.bandLevels : defaultBandLevels,
        waveform: enabled ? current.waveform : normalizeVoiceWaveform(null),
        frequencyBins: enabled ? current.frequencyBins : normalizeVoiceSpectrum(null),
        history: enabled ? current.history : normalizeVoiceSpectrum(null, historySampleCount),
        instrument: enabled ? current.instrument : createSilentAudioInstrument(),
        spectrum: enabled ? current.spectrum : normalizeVoiceSpectrum(null),
      }),
    );
  }, [enabled]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const handleAgentVoiceEvent = (event: Event) => {
      const detail = (event as CustomEvent<AgentVoiceEventDetail>).detail ?? {};
      setVoiceState((current) => {
        if (!current.enabled) return current;
        const level = normalizeVoiceLevel(detail.level);
        const dominantFrequencyHz =
          typeof detail.dominantFrequencyHz === 'number' && Number.isFinite(detail.dominantFrequencyHz)
            ? detail.dominantFrequencyHz
            : null;
        const spectralCentroidHz =
          typeof detail.spectralCentroidHz === 'number' && Number.isFinite(detail.spectralCentroidHz)
            ? detail.spectralCentroidHz
            : dominantFrequencyHz;
        const bandLevels = normalizeBandLevels(detail.bandLevels);
        const waveform = normalizeVoiceWaveform(detail.waveform);
        const frequencyBins = normalizeVoiceSpectrum(detail.frequencyBins);
        const transientLevel = normalizeVoiceLevel(detail.transientLevel);
        const instrument = normalizeAudioInstrument(
          detail.instrument,
          createAudioInstrumentFromAnalyzer({
            waveform,
            frequencyData: frequencyBins,
            bandLevels,
            transientLevel,
            spectralCentroidHz,
            previousTransientEvents: current.instrument.transientEvents,
          }),
        );

        return setLatestAgentVoiceState({
          enabled: current.enabled,
          status: detail.status ?? current.status,
          level,
          amplitude: typeof detail.amplitude === 'number' ? normalizeVoiceLevel(detail.amplitude) : level,
          dominantFrequencyHz,
          wavelengthMeters:
            typeof detail.wavelengthMeters === 'number' && Number.isFinite(detail.wavelengthMeters)
              ? detail.wavelengthMeters
              : getWavelengthMeters(dominantFrequencyHz),
          spectralCentroidHz,
          peakLevel: normalizeVoiceLevel(detail.peakLevel ?? detail.level),
          transientLevel,
          bandLevels,
          waveform,
          frequencyBins,
          history: normalizeVoiceSpectrum(detail.history, historySampleCount),
          instrument,
          spectrum: normalizeVoiceSpectrum(detail.spectrum),
          source: detail.source ?? 'agent',
        });
      });
    };

    window.addEventListener(agentVoiceEventName, handleAgentVoiceEvent);
    return () => window.removeEventListener(agentVoiceEventName, handleAgentVoiceEvent);
  }, []);

  useEffect(() => {
    if (!enabled || typeof window === 'undefined' || !('speechSynthesis' in window)) return undefined;

    const interval = window.setInterval(() => {
      const synthesis = window.speechSynthesis;
      const speaking = synthesis.speaking || synthesis.pending;
      setVoiceState((current) => {
        if (current.source === 'agent' && current.status !== 'idle') return current;

        return setLatestAgentVoiceState({
          enabled: current.enabled,
          status: speaking ? 'speaking' : 'idle',
          level: 0,
          source: 'web-speech',
          amplitude: null,
          dominantFrequencyHz: null,
          wavelengthMeters: null,
          spectralCentroidHz: null,
          peakLevel: 0,
          transientLevel: 0,
          bandLevels: defaultBandLevels,
          waveform: normalizeVoiceWaveform(null),
          frequencyBins: normalizeVoiceSpectrum(null),
          history: normalizeVoiceSpectrum(null, historySampleCount),
          instrument: createSilentAudioInstrument(),
          spectrum: normalizeVoiceSpectrum(null),
        });
      });
    }, 480);

    return () => window.clearInterval(interval);
  }, [enabled]);

  useEffect(() => {
    if (!enabled || !audioMeterEnabled || typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      return undefined;
    }

    let cancelled = false;
    let animationFrame = 0;
    let stream: MediaStream | null = null;
    let audioContext: AudioContext | null = null;

    const startMeter = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
          },
        });
        if (cancelled) return;

        audioContext = new AudioContext();
        const source = audioContext.createMediaStreamSource(stream);
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 2048;
        analyser.smoothingTimeConstant = 0.68;
        source.connect(analyser);

        const timeData = new Uint8Array(analyser.fftSize);
        const frequencyData = new Uint8Array(analyser.frequencyBinCount);
        let lastReactUpdateAt = 0;
        let lastStatus: AgentVoiceState['status'] = 'idle';
        let peakLevel = 0;
        let previousAmplitude = 0;
        let history = normalizeVoiceSpectrum(null, historySampleCount);
        let transientEvents: AgentVoiceTransientEvent[] = [];

        const sample = () => {
          analyser.getByteTimeDomainData(timeData);
          analyser.getByteFrequencyData(frequencyData);

          const amplitude = getRmsAmplitude(timeData);
          const dominantFrequencyHz = getDominantFrequencyHz(
            frequencyData,
            audioContext?.sampleRate ?? 44_100,
            analyser.fftSize,
          );
          const wavelengthMeters = getWavelengthMeters(dominantFrequencyHz);
          const spectralCentroidHz = getSpectralCentroidHz(
            frequencyData,
            audioContext?.sampleRate ?? 44_100,
            analyser.fftSize,
          );
          const bandLevels = getAudioBandLevels(frequencyData, audioContext?.sampleRate ?? 44_100, analyser.fftSize);
          const waveform = getWaveformSamples(timeData);
          const frequencyBins = getSpectrumBins(frequencyData, spectrumBinCount);
          const spectrum = getSpectrumBins(frequencyData);
          const nextStatus = amplitude > 0.055 ? 'speaking' : 'listening';
          peakLevel = Math.max(amplitude, peakLevel * 0.965);
          const transientLevel = normalizeVoiceLevel(Math.max(0, amplitude - previousAmplitude) * 6.8);
          previousAmplitude = amplitude;
          history = [...history.slice(1), amplitude];
          const instrument = createAudioInstrumentFromAnalyzer({
            waveform,
            frequencyData,
            sampleRate: audioContext?.sampleRate ?? 44_100,
            fftSize: analyser.fftSize,
            bandLevels,
            transientLevel,
            spectralCentroidHz,
            previousTransientEvents: transientEvents,
          });
          transientEvents = instrument.transientEvents;
          const nextState = setLatestAgentVoiceState({
            enabled: true,
            status: nextStatus,
            level: amplitude,
            amplitude,
            dominantFrequencyHz,
            wavelengthMeters,
            spectralCentroidHz,
            peakLevel,
            transientLevel,
            bandLevels,
            waveform,
            frequencyBins,
            history,
            instrument,
            spectrum,
            source: 'microphone',
          });

          const now = performance.now();
          if (now - lastReactUpdateAt > 180 || nextStatus !== lastStatus) {
            lastReactUpdateAt = now;
            lastStatus = nextStatus;
            setVoiceState((current) => (current.enabled ? nextState : current));
          }

          animationFrame = window.requestAnimationFrame(sample);
        };

        sample();
      } catch {
        if (cancelled) return;
        setVoiceState((current) =>
          setLatestAgentVoiceState({
            ...current,
            status: 'error',
            level: 0,
            amplitude: null,
            dominantFrequencyHz: null,
            wavelengthMeters: null,
            spectralCentroidHz: null,
            peakLevel: 0,
            transientLevel: 0,
            bandLevels: defaultBandLevels,
            waveform: normalizeVoiceWaveform(null),
            frequencyBins: normalizeVoiceSpectrum(null),
            history: normalizeVoiceSpectrum(null, historySampleCount),
            instrument: createSilentAudioInstrument(),
            spectrum: normalizeVoiceSpectrum(null),
            source: 'microphone',
          }),
        );
      }
    };

    void startMeter();

    return () => {
      cancelled = true;
      if (animationFrame) {
        window.cancelAnimationFrame(animationFrame);
      }
      stream?.getTracks().forEach((track) => track.stop());
      void audioContext?.close();
    };
  }, [audioMeterEnabled, enabled]);

  useEffect(
    () => () => {
      if (pulseTimeoutRef.current !== null) {
        window.clearTimeout(pulseTimeoutRef.current);
      }
    },
    [],
  );

  const triggerLocalTestPulse = useCallback(() => {
    if (typeof window === 'undefined') return;

    if (pulseTimeoutRef.current !== null) {
      window.clearTimeout(pulseTimeoutRef.current);
    }

    setVoiceState((current) => {
      const pulseBandLevels: AgentVoiceState['bandLevels'] = {
        sub: 0.24,
        bass: 0.5,
        lowMid: 0.7,
        mid: 0.52,
        presence: 0.4,
        brilliance: 0.28,
      };
      const pulseWaveform = Array.from(
        { length: waveformSampleCount },
        (_, index) => Math.sin((index / waveformSampleCount) * Math.PI * 8) * 0.45,
      );
      const pulseFrequencyBins = Array.from({ length: spectrumBinCount }, (_, index) =>
        normalizeVoiceLevel(0.2 + Math.sin(index * 0.42) * 0.16),
      );
      const pulseSpectrum = Array.from({ length: spectrumBinCount }, (_, index) => {
        const phase = (index / spectrumBinCount) * Math.PI * 2;
        return normalizeVoiceLevel(0.22 + Math.sin(phase * 3) * 0.16 + Math.sin(phase * 7) * 0.08);
      });

      return setLatestAgentVoiceState({
        enabled: current.enabled,
        status: current.enabled ? 'speaking' : 'idle',
        level: current.enabled ? 1 : 0,
        amplitude: current.enabled ? 1 : null,
        dominantFrequencyHz: current.enabled ? 440 : null,
        wavelengthMeters: current.enabled ? getWavelengthMeters(440) : null,
        spectralCentroidHz: current.enabled ? 440 : null,
        peakLevel: current.enabled ? 1 : 0,
        transientLevel: current.enabled ? 1 : 0,
        bandLevels: current.enabled ? pulseBandLevels : defaultBandLevels,
        waveform: current.enabled ? pulseWaveform : normalizeVoiceWaveform(null),
        frequencyBins: current.enabled ? pulseFrequencyBins : normalizeVoiceSpectrum(null),
        history: current.enabled
          ? Array.from({ length: historySampleCount }, (_, index) => normalizeVoiceLevel(index / historySampleCount))
          : normalizeVoiceSpectrum(null, historySampleCount),
        instrument: current.enabled
          ? createAudioInstrumentFromAnalyzer({
              waveform: pulseWaveform,
              frequencyData: pulseFrequencyBins,
              bandLevels: pulseBandLevels,
              transientLevel: 1,
              spectralCentroidHz: 440,
              previousTransientEvents: current.instrument.transientEvents,
            })
          : createSilentAudioInstrument(),
        spectrum: current.enabled ? pulseSpectrum : normalizeVoiceSpectrum(null),
        source: 'local',
      });
    });

    pulseTimeoutRef.current = window.setTimeout(() => {
      pulseTimeoutRef.current = null;
      setVoiceState((current) =>
        setLatestAgentVoiceState({
          ...current,
          status: 'idle',
          level: 0,
          amplitude: null,
          dominantFrequencyHz: null,
          wavelengthMeters: null,
          spectralCentroidHz: null,
          peakLevel: 0,
          transientLevel: 0,
          bandLevels: defaultBandLevels,
          waveform: normalizeVoiceWaveform(null),
          frequencyBins: normalizeVoiceSpectrum(null),
          history: normalizeVoiceSpectrum(null, historySampleCount),
          instrument: createSilentAudioInstrument(),
          spectrum: normalizeVoiceSpectrum(null),
        }),
        );
    }, 900);
  }, []);

  return {
    voiceState,
    triggerLocalTestPulse,
  };
}
