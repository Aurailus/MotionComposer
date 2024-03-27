import { Txt, Circle, makeScene2D, Rect } from '@motion-canvas/2d';
import { waitFor } from '@motion-canvas/core';

export default makeScene2D(function* (view) {
	view.fill('#0c0c0c');
	view.lineWidth(20);

	const sceneSize = view.size();

	view.add(
		<>
			<Circle position={[ 0, 0 ]} size={sceneSize.y * 1.2} fill='#0f0f0f' />
			<Circle position={[ -sceneSize.x / 2 + 112, -sceneSize.y / 2 + 112 ]} size={144} fill='#131313' />
			<Circle position={[ sceneSize.x / 2 - 112, -sceneSize.y / 2 + 112 ]} size={144} fill='#131313' />
			<Circle position={[ -sceneSize.x / 2 + 112, sceneSize.y / 2 - 112 ]} size={144} fill='#131313' />
			<Circle position={[ sceneSize.x / 2 - 112, sceneSize.y / 2 - 112 ]} size={144} fill='#131313' />
			<Rect position={[ 0, 0 ]} size={[ sceneSize.x * 0.8, 6 ]} fill='#181818' />
			<Rect position={[ 0, 0 ]} size={[ 6, sceneSize.y * 0.8 ]} fill='#181818' />
			{/* <Rect size={sceneSize} stroke='#222' lineWidth={12} /> */}
			<Txt
				fontFamily='"Jetbrains Mono", monospace'
				fill='#555'
				fontWeight={900}
				fontSize={150}
				lineHeight={150}
				y={12}
			>
				No Clip
			</Txt>
		</>
	)
	yield* waitFor(1);
});
