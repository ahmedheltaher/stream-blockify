import { DefaultStreamStateManager } from '../src/default-stream-state-manager';

describe('DefaultStreamStateManager', () => {
	let stateManager: DefaultStreamStateManager;

	beforeEach(() => {
		stateManager = new DefaultStreamStateManager();
	});

	describe('initial state', () => {
		it('should initialize with correct default values', () => {
			expect(stateManager.isPaused()).toBe(false);
			expect(stateManager.isEmitting()).toBe(false);
			expect(stateManager.isEnded()).toBe(false);
			expect(stateManager.isEndEmitted()).toBe(false);
			expect(stateManager.needsDrain()).toBe(false);
		});
	});

	describe('paused state', () => {
		it('should update and retrieve paused state', () => {
			stateManager.setPaused(true);
			expect(stateManager.isPaused()).toBe(true);

			stateManager.setPaused(false);
			expect(stateManager.isPaused()).toBe(false);
		});
	});

	describe('emitting state', () => {
		it('should update and retrieve emitting state', () => {
			stateManager.setEmitting(true);
			expect(stateManager.isEmitting()).toBe(true);

			stateManager.setEmitting(false);
			expect(stateManager.isEmitting()).toBe(false);
		});
	});

	describe('ended state', () => {
		it('should update and retrieve ended state', () => {
			stateManager.setEnded(true);
			expect(stateManager.isEnded()).toBe(true);

			stateManager.setEnded(false);
			expect(stateManager.isEnded()).toBe(false);
		});
	});

	describe('endEmitted state', () => {
		it('should update and retrieve endEmitted state', () => {
			stateManager.setEndEmitted(true);
			expect(stateManager.isEndEmitted()).toBe(true);

			stateManager.setEndEmitted(false);
			expect(stateManager.isEndEmitted()).toBe(false);
		});
	});

	describe('needDrain state', () => {
		it('should update and retrieve needDrain state', () => {
			stateManager.setNeedDrain(true);
			expect(stateManager.needsDrain()).toBe(true);

			stateManager.setNeedDrain(false);
			expect(stateManager.needsDrain()).toBe(false);
		});
	});

	describe('combined state operations', () => {
		it('should handle multiple state changes independently', () => {
			stateManager.setPaused(true);
			stateManager.setEmitting(true);
			stateManager.setNeedDrain(true);

			expect(stateManager.isPaused()).toBe(true);
			expect(stateManager.isEmitting()).toBe(true);
			expect(stateManager.needsDrain()).toBe(true);
			expect(stateManager.isEnded()).toBe(false);
			expect(stateManager.isEndEmitted()).toBe(false);

			stateManager.setEnded(true);
			stateManager.setPaused(false);

			expect(stateManager.isPaused()).toBe(false);
			expect(stateManager.isEmitting()).toBe(true);
			expect(stateManager.needsDrain()).toBe(true);
			expect(stateManager.isEnded()).toBe(true);
			expect(stateManager.isEndEmitted()).toBe(false);
		});
	});
});
