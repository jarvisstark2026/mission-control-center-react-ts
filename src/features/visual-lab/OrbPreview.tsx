export function OrbPreview() {
  return (
    <div className="visual-lab__orb" aria-hidden="true">
      <div className="visual-lab__orb-shell">
        <div className="visual-lab__orb-halo" />
        <div className="visual-lab__orb-core" />
        <div className="visual-lab__orb-ring visual-lab__orb-ring--a" />
        <div className="visual-lab__orb-ring visual-lab__orb-ring--b" />
        <div className="visual-lab__orb-glint" />
      </div>
    </div>
  );
}