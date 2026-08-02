import type { Meta, StoryObj } from '@storybook/react';
import Button from '../components/UI/Button';

const meta: Meta<typeof Button> = {
  title: 'UI/Button',
  component: Button,
  argTypes: {
    variant: { control: 'radio', options: ['primary', 'secondary'] },
  },
};

export default meta;
type Story = StoryObj<typeof Button>;

export const Primary: Story = {
  args: { variant: 'primary', children: 'Save changes' },
};

export const Secondary: Story = {
  args: { variant: 'secondary', children: 'Cancel' },
};

export const Disabled: Story = {
  args: { variant: 'primary', children: 'Save changes', disabled: true },
};
