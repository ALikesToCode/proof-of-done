import React from 'react';
import { Box, Heading, Inline, Select, Stack, Text } from '@forge/react';
import type { Meter } from '../../../core/meter';
import type { ProjectView } from '../../../services/project-view';
import { Figure, WINDOW_OPTIONS, activityLine, meterFigures, nowFigures } from '../../project-text';
import { card, windowSelect } from '../styles';

interface Props {
  meter: Meter;
  view: Pick<ProjectView, 'contracts' | 'rows'>;
  /** True while a new window is loading. */
  busy: boolean;
  onWindow: (days: number) => void;
}

const Figures = ({ figures }: { figures: Figure[] }) => (
  <Inline space="space.400" shouldWrap>
    {figures.map((figure) => (
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
);

/**
 * The project in numbers a team lead can act on: what needs someone now, and what came
 * in and went out in the window. No label sums it up. The numbers are the message.
 */
export const MeterCard = ({ meter, view, busy, onWindow }: Props) => (
  <Box xcss={card}>
    <Stack space="space.200">
      <Stack space="space.100">
        <Heading size="small" as="h2">
          Needs someone now
        </Heading>
        <Figures figures={nowFigures(view)} />
      </Stack>
      <Stack space="space.100">
        <Inline spread="space-between" alignBlock="center">
          <Heading size="small" as="h2">
            In and out
          </Heading>
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
        <Figures figures={meterFigures(meter)} />
        <Text size="small" color="color.text.subtle">
          {activityLine(meter)} Work arrives when a work item is opened or reopened. It leaves only when one is closed with every
          criterion proven.
        </Text>
      </Stack>
    </Stack>
  </Box>
);
