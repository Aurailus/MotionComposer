// @ts-ignore
import { exec, spawn } from 'child_process';
// @ts-ignore
import { promises as fs } from 'fs';

import * as FileTypes from '../common/FileTypes';
import sharp from 'sharp';

async function audio(path: string) {
	const SAMPLE_INTERVAL = 1000;
	const peaks = await new Promise<number[]>((res, rej) => {
		const ffmpeg = spawn('ffmpeg', [ '-i', path, '-ac', '1', '-filter:a', `aresample=${SAMPLE_INTERVAL}`,
			'-map', '0:a', '-c:a', 'pcm_s16le', '-f', 'data', '-' ]);

		// @ts-ignore
		let bufferData = Buffer.alloc(0);

		ffmpeg.stdout.on('data', (data: any) => {
			// @ts-ignore
			bufferData = Buffer.concat([bufferData, data]);
		});

		ffmpeg.on('close', (code: any) => {
			if (code === 0) {
				const peaks = [];
				for (let i = 0; i < bufferData.length; i += 2) peaks.push(bufferData.readInt16LE(i));
				res(peaks);
			}
			else {
				rej(`ffmpeg exited with code ${code}`);
			}
		});
	});

	return {
		type: 'audio',
		peaks,
		name: path.slice(path.lastIndexOf('/') + 1),
		path,
		duration: peaks.length / SAMPLE_INTERVAL
	};
}

async function video(path: string) {
	const audioData = await audio(path);

	const outputPath = `/tmp/${audioData.name}.thumbnail.png`;

	await new Promise<void>((res, rej) => {
		const ffmpeg = spawn('ffmpeg', [ '-i', path, '-y', '-vf', 'thumbnail,scale=240:-1', '-frames:v', '1', outputPath ]);

		ffmpeg.on('close', (code: any) => {
			if (code === 0) res();
			else rej(`ffmpeg exited with code ${code}`);
		});
	});

	const thumbFile = await fs.readFile(outputPath);
	const thumbnail = `data:image/x-png;base64,${thumbFile.toString('base64')}`;
	await fs.unlink(outputPath);

	return {
		...audioData,
		type: 'video',
		thumbnail
	};
}

async function image(path: string) {
	const buffer = await sharp(path)
		.resize(240, 180, { fit: 'cover' })
		.png()
		.toBuffer()

	const thumbnail = `data:image/x-png;base64,${buffer.toString('base64')}`;

	return {
		type: 'image',
		name: path.slice(path.lastIndexOf('/') + 1),
		path,
		thumbnail,
		duration: 0
	};
}

export default function Plugin() {
	return {
		name: 'motion-composer-media-importer',
		transform: async (_: string, id: string) => {
			if (!id.endsWith('?meta')) return;
			const ext = id.slice(id.lastIndexOf('.') + 1, id.lastIndexOf('?'));
			const path = id.slice(0, id.lastIndexOf('?meta'));

			if (FileTypes.Audio.indexOf(ext) !== -1) {
				const data = await audio(path);
				return `export default JSON.parse(\`${JSON.stringify(data)}\`)`;
			}

			if (FileTypes.Video.indexOf(ext) !== -1) {
				const data = await video(path);
				return `export default JSON.parse(\`${JSON.stringify(data)}\`)`;
			}

			if (FileTypes.Image.indexOf(ext) !== -1) {
				const data = await image(path);
				return `export default JSON.parse(\`${JSON.stringify(data)}\`)`;
			}
		}
	}
}
