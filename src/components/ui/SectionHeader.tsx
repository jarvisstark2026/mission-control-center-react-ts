import type { HTMLAttributes } from 'react';

import '../../styles/components.css';

type SectionHeaderProps = HTMLAttributes<HTMLElement> & {
  eyebrow?: string;
  title: string;
  description?: string;
};

export function SectionHeader({ eyebrow, title, description, className, children, ...rest }: SectionHeaderProps) {
  return (
    <header className={["section-header", className].filter(Boolean).join(' ')} {...rest}>
      {eyebrow ? <p className="section-header__eyebrow">{eyebrow}</p> : null}
      <h2 className="section-header__title">{title}</h2>
      {description ? <p className="section-header__description">{description}</p> : null}
      {children}
    </header>
  );
}
