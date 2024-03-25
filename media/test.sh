ffmpeg -i sphinx_of_black_quartz.wav -ac 1 -filter:a aresample=100 -map 0:a -c:a pcm_s16le -f data -
