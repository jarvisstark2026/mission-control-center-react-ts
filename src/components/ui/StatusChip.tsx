import type { HTMLAttributes } from 'react';

import '../../styles/components.css';

type StatusChipTone = 'ice' | 'cool' | 'neutral';

type StatusChipProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: StatusChipTone;
};

const toneClassNames: Record<StatusChipTone, string> = {
  ice: 'status-chip--ice',
  cool: 'status-chip--cool',
  neutral: 'status-chip--neutral',
};

export function StatusChip({ tone = 'neutral', className, children, ...rest }: StatusChipProps) {
  return (
    <span className={["status-chip", toneClassNames[tone], className].filter(Boolean).join(' ')} {...rest}>
      {children}
    </span>
  );
}