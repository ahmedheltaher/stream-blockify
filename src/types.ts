export interface StreamBlockifyConfig {
	size?: number;
}

export interface StreamBlockifyState {
	paused: boolean;
	ended: boolean;
	endEmitted: boolean;
	emitting: boolean;
	needDrain: boolean;
}

export interface BufferManager {
	addBuffer(buffer: Buffer): void;
	getTotalLength(): number;
	getChunks(size: number): Buffer[];
	clear(): void;
	getRemainingData(): Buffer | null;
}

export interface StreamStateManager {
	isPaused(): boolean;
	isEmitting(): boolean;
	isEnded(): boolean;
	isEndEmitted(): boolean;
	needsDrain(): boolean;
	setPaused(paused: boolean): void;
	setEmitting(emitting: boolean): void;
	setEnded(ended: boolean): void;
	setEndEmitted(endEmitted: boolean): void;
	setNeedDrain(needDrain: boolean): void;
}
