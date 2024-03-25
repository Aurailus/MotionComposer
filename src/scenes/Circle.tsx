import {Circle, makeScene2D} from '@motion-canvas/2d';
import {createRef, waitFor, waitUntil} from '@motion-canvas/core';

export default makeScene2D(function* (view) {
  view.fill('#111111');

  const circle = createRef<Circle>();

  view.add(<Circle ref={circle} size={320} fill={'lightseagreen'} />);

  yield* circle().scale(2, 1).to(1, 1);
  yield* waitUntil('almostEnd');
  yield* waitFor(0.1);
});
