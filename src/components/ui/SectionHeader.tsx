import { useId, type HTMLAttributes } from 'react';

import '../../styles/components.css';

type SectionHeaderProps = HTMLAttributes<HTMLElement> & {
  eyebrow?: string;
  title: string;
  description?: string;
};

export function SectionHeader({ eyebrow, title, description, className, children, ...rest }: SectionHeaderProps) {
  const baseId = useId();
  const titleId = `${baseId}-title`;
  const descriptionId = `${baseId}-description`;
  const {
    ['aria-label']: ariaLabelProp,
    ['aria-labelledby']: ariaLabelledByProp,
    ['aria-describedby']: ariaDescribedByProp,
    ...headerProps
  } = rest;
  const ariaLabelledBy = ariaLabelProp ? ariaLabelledByProp : ariaLabelledByProp ?? titleId;
  const ariaDescribedBy = [ariaDescribedByProp, description ? descriptionId : null].filter(Boolean).join(' ');

  return (
    <header
      className={["section-header", className].filter(Boolean).join(' ')}
      aria-labelledby={ariaLabelledBy}
      aria-describedby={ariaDescribedBy || undefined}
      {...headerProps}
    >
      {eyebrow ? <p className="section-header__eyebrow">{eyebrow}</p> : null}
      <h2 id={titleId} className="section-header__title">
        {title}
      </h2>
      {description ? (
        <p id={descriptionId} className="section-header__description">
          {description}
        </p>
      ) : null}
      {children}
    </header>
  );
}
