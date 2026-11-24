import React from 'react';
import { Box, Text } from '@forge/react';
import type { TextProps } from '@forge/react';

/**
 * A line of text that keeps the gap its Stack or Inline gives it.
 *
 * Jira's own page styles put 12px above a Text that follows another block. In an Inline
 * that pushes the text below its neighbours, and in a Stack it adds to the gap. A Text
 * that is alone in a Box follows nothing, so it gets no such margin. Use it for rows and
 * for lists of short lines. A paragraph of prose can stay a Text.
 */
export const Line = (props: TextProps) => (
  <Box>
    <Text {...props} />
  </Box>
);
