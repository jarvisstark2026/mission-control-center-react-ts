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
  ice: 'rgba(255, 255, 255, 0.14)',
  cool: 'rgba(108, 157, 255, 0.16)',
  neutral: 'rgba(97, 116, 148, 0.16)',
};

const depthTokens: Record<GlassPanelDepth, { blur: string; shadow: string }> = {
  shallow: {
    blur: '16px',
    shadow: '0 16px 36px rgba(0, 0, 0, 0.26)',
  },
  mid: {
    blur: '22px',
    shadow: '0 24px 58px rgba(0, 0, 0, 0.32)',
  },
  deep: {
    blur: '30px',
    shadow: '0 34px 86px rgba(0, 0, 0, 0.4)',
  },
};

const borderTokens: Record<GlassPanelBorder, string> = {
  soft: 'rgba(255, 255, 255, 0.08)',
  balanced: 'rgba(255, 255, 255, 0.12)',
  strong: 'rgba(255, 255, 255, 0.18)',
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
