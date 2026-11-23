import React from 'react';
import { Button, Inline, Text } from '@forge/react';
import { waitingLine } from '../text';

interface Props {
  waiting: number;
  /** True once the chat has been opened, while the panel looks for the verdicts. */
  asked: boolean;
  onAsk: () => void;
}

/** Hands the evidence that waits for a check to the Proof Verifier in Rovo chat. */
export const AskVerifier = ({ waiting, asked, onAsk }: Props) => (
  <Inline spread="space-between" alignBlock="center" space="space.100">
    <Text size="small" color="color.text.subtle">
      {asked ? 'The Proof Verifier has the evidence in Rovo chat. Its verdicts show up here.' : waitingLine(waiting)}
    </Text>
    <Button spacing="compact" onClick={onAsk}>
      Ask Proof Verifier
    </Button>
  </Inline>
);
