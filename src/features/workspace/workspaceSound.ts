type BrowserAudioWindow = Window & {
  AudioContext?: typeof AudioContext;
  webkitAudioContext?: typeof AudioContext;
};

let lastWidgetAddedSoundAt = 0;

function getAudioContextConstructor() {
  if (typeof window === 'undefined') return null;
  const audioWindow = window as BrowserAudioWindow;
  return audioWindow.AudioContext ?? audioWindow.webkitAudioContext ?? null;
}

export function playWidgetAddedSound() {
  if (typeof window === 'undefined') return;

  const nowMs = window.performance?.now() ?? Date.now();
  if (nowMs - lastWidgetAddedSoundAt < 160) return;

  const AudioContextConstructor = getAudioContextConstructor();
  if (!AudioContextConstructor) return;

  try {
    lastWidgetAddedSoundAt = nowMs;

    const context = new AudioContextConstructor();
    const startTime = context.currentTime + 0.01;
    const duration = 0.36;
    const masterGain = context.createGain();

    masterGain.gain.setValueAtTime(0.0001, startTime);
    masterGain.gain.exponentialRampToValueAtTime(0.035, startTime + 0.035);
    masterGain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
    masterGain.connect(context.destination);

    const notes = [
      { frequency: 523.25, offset: 0 },
      { frequency: 659.25, offset: 0.045 },
      { frequency: 783.99, offset: 0.11 },
    ];

    notes.forEach((note) => {
      const oscillator = context.createOscillator();
      const noteGain = context.createGain();
      const noteStart = startTime + note.offset;
      const noteEnd = noteStart + 0.2;

      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(note.frequency, noteStart);
      noteGain.gain.setValueAtTime(0.0001, noteStart);
      noteGain.gain.exponentialRampToValueAtTime(0.8, noteStart + 0.018);
      noteGain.gain.exponentialRampToValueAtTime(0.0001, noteEnd);

      oscillator.connect(noteGain);
      noteGain.connect(masterGain);
      oscillator.start(noteStart);
      oscillator.stop(noteEnd + 0.02);
    });

    if (context.state === 'suspended') {
      void context.resume().catch(() => undefined);
    }

    window.setTimeout(() => {
      void context.close().catch(() => undefined);
    }, Math.ceil((duration + 0.08) * 1000));
  } catch {
    // Audio feedback is optional; browsers can reject Web Audio for policy reasons.
  }
}
