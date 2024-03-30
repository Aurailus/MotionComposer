export function ensure<T = any>(condition: T, message: string): asserts condition {
	if (!condition) throw new Error(message);
}

export function addEventListener<T extends Element>(obj: T, event: string, listener: EventListener): () => void {
	obj.addEventListener(event, listener);
	return () => obj.removeEventListener(event, listener);
}

