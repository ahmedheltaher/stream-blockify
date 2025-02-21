import { DefaultStreamStateManager } from '../src/default-stream-state-manager';

describe('DefaultStreamStateManager', () => {
	let manager: DefaultStreamStateManager;

	beforeEach(() => {
		manager = new DefaultStreamStateManager();
	});

	test('should initialize with default state', () => {
		expect(manager.isPaused()).toBe(false);
		expect(manager.isEmitting()).toBe(false);
		expect(manager.isEnded()).toBe(false);
		expect(manager.isEndEmitted()).toBe(false);
		expect(manager.needsDrain()).toBe(false);
	});

	test('should set and get paused state', () => {
		manager.setPaused(true);
		expect(manager.isPaused()).toBe(true);
		manager.setPaused(false);
		expect(manager.isPaused()).toBe(false);
	});

	test('should set and get emitting state', () => {
		manager.setEmitting(true);
		expect(manager.isEmitting()).toBe(true);
		manager.setEmitting(false);
		expect(manager.isEmitting()).toBe(false);
	});

	test('should set and get ended state', () => {
		manager.setEnded(true);
		expect(manager.isEnded()).toBe(true);
		manager.setEnded(false);
		expect(manager.isEnded()).toBe(false);
	});

	test('should set and get endEmitted state', () => {
		manager.setEndEmitted(true);
		expect(manager.isEndEmitted()).toBe(true);
		manager.setEndEmitted(false);
		expect(manager.isEndEmitted()).toBe(false);
	});

	test('should set and get needDrain state', () => {
		manager.setNeedDrain(true);
		expect(manager.needsDrain()).toBe(true);
		manager.setNeedDrain(false);
		expect(manager.needsDrain()).toBe(false);
	});
});
