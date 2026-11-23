import React from 'react';
import { Box, Heading, Inline, Lozenge, Select, Stack, Text } from '@forge/react';
import type { Meter } from '../../../core/meter';
import { METER, WINDOW_OPTIONS, activityLine, meterFigures } from '../../project-text';
import { card, windowSelect } from '../styles';

interface Props {
  meter: Meter;
  /** True while a new window is loading. */
  busy: boolean;
  onWindow: (days: number) => void;
}

/** Is the project converging, or only busy? The verdict, the reason and the numbers behind it. */
export const MeterCard = ({ meter, busy, onWindow }: Props) => {
  const badge = METER[meter.verdict];
  return (
    <Box xcss={card}>
      <Stack space="space.200">
        <Inline spread="space-between" alignBlock="center">
          <Inline space="space.150" alignBlock="center">
            <Heading size="small" as="h2">
              Project meter
            </Heading>
            <Lozenge appearance={badge.tone} isBold>
              {badge.label}
            </Lozenge>
          </Inline>
          <Box xcss={windowSelect}>
            <Select
              inputId="meter-window"
              isDisabled={busy}
              options={WINDOW_OPTIONS}
              value={WINDOW_OPTIONS.find((option) => option.value === String(meter.windowDays))}
              onChange={(option: { value: string } | null) => onWindow(Number(option?.value ?? 7))}
            />
          </Box>
        </Inline>
        <Text>{meter.reason}</Text>
        <Inline space="space.400" shouldWrap>
          {meterFigures(meter).map((figure) => (
            <Stack key={figure.label} space="space.0">
              <Heading size="large" as="div">
                {figure.value}
              </Heading>
              <Text size="small" color="color.text.subtle">
                {figure.label}
              </Text>
              {figure.note && (
                <Text size="small" color="color.text.subtlest">
                  {figure.note}
                </Text>
              )}
            </Stack>
          ))}
        </Inline>
        <Text size="small" color="color.text.subtle">
          {activityLine(meter)} Work arrives when a work item is opened or reopened. It leaves only when one is closed with every
          criterion proven.
        </Text>
      </Stack>
    </Box>
  );
};
