import {makeProject} from '@motion-canvas/core';

import Circle from './scenes/Circle?scene';
import Square from './scenes/Square?scene';
import Rectangle from './scenes/Rectangle?scene';

import MotionComposer from './plugin/client/main';

export default makeProject({
  scenes: [ Circle, Square, Rectangle ],
  plugins: [ MotionComposer() ],
  experimentalFeatures: true
});
