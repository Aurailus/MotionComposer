export function ensure<T = any>(condition: T, message: string): asserts condition {
	if (!condition) throw new Error(message);
}
