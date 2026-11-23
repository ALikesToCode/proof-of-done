import React, { useState } from 'react';
import { Button, CodeBlock, Inline, Stack } from '@forge/react';
import { excerptHead } from '../text';

interface Props {
  text: string;
  /** Show all of it from the start, as the review dialog does. */
  whole?: boolean;
}

/** The lines someone pasted as evidence, with their line breaks. The panel folds a long one. */
export const Excerpt = ({ text, whole = false }: Props) => {
  const [open, setOpen] = useState(false);
  const { head, cut } = excerptHead(text);
  const folds = cut && !whole;
  return (
    <Stack space="space.050">
      <CodeBlock text={folds && !open ? head : text} language="text" showLineNumbers={false} shouldWrapLongLines />
      {folds && (
        <Inline>
          <Button spacing="compact" appearance="subtle" onClick={() => setOpen(!open)}>
            {open ? 'Show less of the excerpt' : 'Show the whole excerpt'}
          </Button>
        </Inline>
      )}
    </Stack>
  );
};
