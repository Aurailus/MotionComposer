/* @jsxImportSource preact */

import Clip, { ClipChildProps } from './Clip';

export default function MissingClip({ clip, ...props }: ClipChildProps) {
	return (
		<Clip
			{...props}
			clip={clip}
			labelChildren={
				<p>Missing Clip</p>
			}
		/>
	);
}
