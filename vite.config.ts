import {defineConfig} from 'vite';
import motionCanvas from '@motion-canvas/vite-plugin';
import ffmpeg from '@motion-canvas/ffmpeg';

import MotionComposer from './src/plugin/vite';

export default defineConfig({
  plugins: [
    motionCanvas(),
    ffmpeg(),
    MotionComposer(),
  ],
});
