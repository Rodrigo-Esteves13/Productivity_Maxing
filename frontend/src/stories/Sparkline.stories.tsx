import type { Meta, StoryObj } from '@storybook/react';
import Sparkline from '../components/UI/Sparkline';

const meta: Meta<typeof Sparkline> = {
  title: 'UI/Sparkline',
  component: Sparkline,
};

export default meta;
type Story = StoryObj<typeof Sparkline>;

export const TrendingUp: Story = {
  args: { values: [10, 12, 11, 14, 16, 18], max: 20 },
};

export const TrendingDown: Story = {
  args: { values: [18, 17, 15, 14, 12, 10], max: 20 },
};

export const Volatile: Story = {
  args: { values: [10, 18, 9, 17, 8, 19], max: 20 },
};

// Renders nothing (returns null) with fewer than 2 points - documented
// here so that stays a visible, intentional case rather than a silent
// edge case someone has to go read the source to discover.
export const TooFewPoints: Story = {
  args: { values: [15], max: 20 },
};
