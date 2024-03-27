/* @jsxImportSource preact */

import { useRef, useState, useLayoutEffect } from 'preact/hooks';

import styles from './Media.module.scss';

import * as Icon from '../icon';
import ClipItem, { ClipItemChildProps } from './ClipItem';

const CANVAS = document.createElement('canvas');
const CTX = CANVAS.getContext('2d')!;

export default function AudioClipItem(props: ClipItemChildProps) {
	const imgRef = useRef<HTMLImageElement>(null);
	const [ imgData, setImgData ] = useState<string>();

	useLayoutEffect(() => {
		const W = 109;
		const H = 109 * (11/16);
		const PIXELS_PER_WAVE = 3;
		const POW = 1;

		const numBlocks = Math.floor(W / PIXELS_PER_WAVE);
		const samplesPerBlock = Math.floor(props.source.peaks.length / 2 / numBlocks);

		CANVAS.width = W;
		CANVAS.height = H;
    CTX.clearRect(0, 0, W, H);

		CTX.fillStyle = getComputedStyle(imgRef.current).getPropertyValue('fill');
		CTX.fillStyle = `color-mix(in hsl, ${CTX.fillStyle} ${1/samplesPerBlock*4*100}%, transparent)`;

    CTX.beginPath();

		for (let i = 0; i < numBlocks; i++) {
			for (let j = 0; j < samplesPerBlock; j++) {
				let minPeak = -props.source.peaks[(i * samplesPerBlock + j) * 2] / 32768;
				let maxPeak = -props.source.peaks[(i * samplesPerBlock + j) * 2 + 1] / 32768;
				if (minPeak > maxPeak) {
					const temp = minPeak;
					minPeak = maxPeak;
					maxPeak = temp;
				}

				const minPos = Math.pow(Math.abs(minPeak), POW) * (minPeak < 0 ? -1 : 1) * 3/2 * H/2;
				const maxPos = Math.pow(Math.abs(maxPeak), POW) * (maxPeak < 0 ? -1 : 1) * 3/2 * H/2;
				CTX.fillRect(i * PIXELS_PER_WAVE, H/2 + minPos, PIXELS_PER_WAVE, maxPos - minPos);
			}
		}

		CTX.fill();
		setImgData(CANVAS.toDataURL());
	}, [ props.source ]);

	return (
		<ClipItem
			{...props}
			class={styles.audio}
			name={props.source.name}
			duration={props.source.duration}
			icon={Icon.Audio}
			thumbnail={<img ref={imgRef} class={styles.thumbnail} src={imgData}/>}
		/>
	);
}
