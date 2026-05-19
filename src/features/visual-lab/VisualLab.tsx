import { BackdropGrid } from './BackdropGrid';
import { OrbPreview } from './OrbPreview';
import { GlassPanel } from '../../components/ui/GlassPanel';
import './visualLab.css';

export function VisualLab() {
  return (
    <section className="visual-lab" aria-label="HUD stress-test layer">
      <BackdropGrid />

      <div className="visual-lab__stage">
        <GlassPanel className="visual-lab__panel visual-lab__panel--left" tone="cool" depth="mid">
          <p className="visual-lab__eyebrow">Layer 01</p>
          <h2>Translucent shell</h2>
          <p>
            This pass establishes the glass-and-light language before any of the clever machinery
            is allowed to show off. Sensible, if rather less glamorous than pretending to be done.
          </p>
          <dl>
            <div>
              <dt>depth</dt>
              <dd>multi-plane</dd>
            </div>
            <div>
              <dt>motion</dt>
              <dd>subtle drift</dd>
            </div>
          </dl>
        </GlassPanel>

        <OrbPreview />

        <GlassPanel className="visual-lab__panel visual-lab__panel--right" tone="ice" depth="mid" borderStrength="soft">
          <p className="visual-lab__eyebrow">Layer 02</p>
          <h2>Preview lane</h2>
          <p>
            The centre readout is intentionally compact: enough glow to feel cinematic, not enough
            spectacle to confuse a command surface with a nightclub.
          </p>
          <ul>
            <li>glass panels</li>
            <li>thin-line geometry</li>
            <li>controlled bloom</li>
          </ul>
        </GlassPanel>
      </div>
    </section>
  );
}