import type { CSSProperties, HTMLAttributes } from 'react';

import { classNames } from '../../lib/classNames';
import '../../styles/components.css';

type GlassPanelTone = 'ice' | 'cool' | 'neutral';
type GlassPanelDepth = 'shallow' | 'mid' | 'deep';
type GlassPanelBorder = 'soft' | 'balanced' | 'strong';

type GlassPanelProps = HTMLAttributes<HTMLDivElement> & {
  tone?: GlassPanelTone;
  depth?: GlassPanelDepth;
  borderStrength?: GlassPanelBorder;
  selected?: boolean;
};

const toneTokens: Record<GlassPanelTone, string> = {
  ice: 'var(--glass-panel-tone-ice)',
  cool: 'var(--glass-panel-tone-cool)',
  neutral: 'var(--glass-panel-tone-neutral)',
};

const depthTokens: Record<GlassPanelDepth, { blur: string; shadow: string }> = {
  shallow: {
    blur: '16px',
    shadow: '0 16px 36px var(--theme-shadow-color)',
  },
  mid: {
    blur: '22px',
    shadow: '0 24px 58px var(--theme-shadow-color)',
  },
  deep: {
    blur: '30px',
    shadow: '0 34px 86px var(--theme-shadow-color)',
  },
};

const borderTokens: Record<GlassPanelBorder, string> = {
  soft: 'var(--glass-panel-border-soft)',
  balanced: 'var(--glass-panel-border-balanced)',
  strong: 'var(--glass-panel-border-strong-token)',
};

export function GlassPanel({
  tone = 'cool',
  depth = 'mid',
  borderStrength = 'balanced',
  selected = false,
  className,
  style,
  children,
  ...rest
}: GlassPanelProps) {
  const depthTokensForSelection = depthTokens[depth];

  const panelStyle = {
    ...style,
    '--glass-panel-tint': toneTokens[tone],
    '--glass-panel-blur': depthTokensForSelection.blur,
    '--glass-panel-shadow': depthTokensForSelection.shadow,
    '--glass-panel-border': borderTokens[borderStrength],
  } as CSSProperties;

  return (
    <div
      className={classNames('glass-panel', selected && 'glass-panel--selected', className)}
      style={panelStyle}
      {...rest}
    >
      {children}
    </div>
  );
}
