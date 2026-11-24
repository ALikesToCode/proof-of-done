import { xcss } from '@forge/react';

export const card = xcss({
  borderColor: 'color.border',
  borderStyle: 'solid',
  borderWidth: 'border.width',
  borderRadius: 'radius.medium',
  padding: 'space.150',
});

export const evidenceBox = xcss({
  backgroundColor: 'color.background.neutral.subtle',
  borderInlineStartColor: 'color.border.bold',
  borderLeftStyle: 'solid',
  borderInlineStartWidth: 'border.width.selected',
  paddingInlineStart: 'space.150',
  paddingBlock: 'space.050',
});

// Wide enough for its longest option, "Needs a person's attestation", on one line.
export const kindSelect = xcss({ width: '260px' });

export const windowSelect = xcss({ width: '170px' });
export const typeSelect = xcss({ width: '240px' });
export const page = xcss({ padding: 'space.300' });
export const tabBody = xcss({ paddingBlockStart: 'space.200' });
