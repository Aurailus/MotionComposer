import {Rect, makeScene2D} from '@motion-canvas/2d';
import {createRef, waitUntil} from '@motion-canvas/core';

export default makeScene2D(function* (view) {
  view.fill('#111111');

  const rect = createRef<Rect>();

  view.add(<Rect ref={rect} size={300} fill={'lightpink'} />);

	yield* waitUntil('start');
  yield* rect().rotation(360, 1);
	yield* waitUntil('back');
	yield* rect().rotation(0, 1);
});
