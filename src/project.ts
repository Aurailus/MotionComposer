import { makeProject } from '@motion-canvas/core';

import Circle from './scenes/Circle?scene';
import Square from './scenes/Square?scene';
import Rectangle from './scenes/Rectangle?scene';
import Video from './scenes/Video?scene';

import MotionComposer from './plugin/client';

export default makeProject({
  scenes: [
    Circle,
    Square,
    Video,
    Rectangle,
  ],
  plugins: [ MotionComposer() ],
  experimentalFeatures: true
});
