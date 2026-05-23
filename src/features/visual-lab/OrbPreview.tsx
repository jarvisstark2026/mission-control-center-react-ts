import type { CSSProperties } from 'react';

export function OrbPreview() {
  return (
    <div className="visual-lab__orb" aria-hidden="true">
      <div className="visual-lab__orb-shell">
        <div className="visual-lab__orb-halo" />
        <div className="visual-lab__orb-arc visual-lab__orb-arc--outer" />
        <div className="visual-lab__orb-arc visual-lab__orb-arc--inner" />
        <div className="visual-lab__orb-core" />
        <div className="visual-lab__orb-ring visual-lab__orb-ring--a" />
        <div className="visual-lab__orb-ring visual-lab__orb-ring--b" />
        <div className="visual-lab__neural-net">
          {Array.from({ length: 9 }, (_, index) => (
            <span key={index} className={`visual-lab__node visual-lab__node--${index + 1}`} />
          ))}
        </div>
        <div className="visual-lab__waveform">
          {Array.from({ length: 15 }, (_, index) => (
            <span key={index} style={{ '--bar-index': index } as CSSProperties} />
          ))}
        </div>
      </div>
    </div>
  );
}
