import type { StorybookConfig } from '@storybook/react-vite';

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(ts|tsx)'],
  addons: [
    // Flags contrast/label/role issues directly in the Storybook UI -
    // genuinely useful here given Input.tsx's label/id bug this same
    // round turned up; catches the next one of those at story-authoring
    // time instead of by accident.
    '@storybook/addon-a11y',
    '@storybook/addon-docs',
  ],
  framework: {
    name: '@storybook/react-vite',
    options: {},
  },
  staticDirs: ['../public'],
};

export default config;
