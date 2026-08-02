import type { Meta, StoryObj } from '@storybook/react';
import StatusBadge from '../components/UI/StatusBadge';

const meta: Meta<typeof StatusBadge> = {
  title: 'UI/StatusBadge',
  component: StatusBadge,
};

export default meta;
type Story = StoryObj<typeof StatusBadge>;

export const Ahead: Story = { args: { status: 'AHEAD' } };
export const OnTrack: Story = { args: { status: 'ON_TRACK' } };
export const Behind: Story = { args: { status: 'BEHIND' } };
export const VeryBehind: Story = { args: { status: 'VERY_BEHIND' } };
// Falls back to the neutral-gray style (see StatusBadge.tsx's `styles`
// map, which has no COMPLETED entry) - deliberate, not a bug, but worth
// having a story for so that stays a deliberate choice and not something
// that quietly regresses.
export const Completed: Story = { args: { status: 'COMPLETED' } };
