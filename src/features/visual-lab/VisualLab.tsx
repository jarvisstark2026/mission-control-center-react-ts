import { BackdropGrid } from './BackdropGrid';
import { OrbPreview } from './OrbPreview';
import './visualLab.css';

export function VisualLab() {
  return (
    <section className="visual-lab" aria-label="HUD stress-test layer">
      <BackdropGrid />

      <div className="visual-lab__stage">
        <OrbPreview />
      </div>
    </section>
  );
}
