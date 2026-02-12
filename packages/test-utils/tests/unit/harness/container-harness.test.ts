/**
 * Unit tests for ContainerTestHarness
 */

import { describe, it, expect } from 'vitest';
import { Container, ContainerModule, injectable } from 'inversify';
import { createContainerTestHarness } from '../../../src/harness/container-harness.js';

// Test fixtures
const TEST_SERVICE = Symbol.for('TestService');
const OTHER_SERVICE = Symbol.for('OtherService');
const MULTI_SERVICE = Symbol.for('MultiService');

interface TestService {
  getValue(): string;
}

@injectable()
class TestServiceImpl implements TestService {
  getValue(): string {
    return 'test-value';
  }
}

@injectable()
class OtherServiceImpl {
  getName(): string {
    return 'other';
  }
}

@injectable()
class MultiImpl1 {
  id = 1;
}

@injectable()
class MultiImpl2 {
  id = 2;
}

const testModule = new ContainerModule((bind) => {
  bind(TEST_SERVICE).to(TestServiceImpl);
  bind(OTHER_SERVICE).to(OtherServiceImpl);
});

const multiModule = new ContainerModule((bind) => {
  bind(MULTI_SERVICE).to(MultiImpl1);
  bind(MULTI_SERVICE).to(MultiImpl2);
});

describe('ContainerTestHarness', () => {
  describe('isBound', () => {
    it('should return true for bound services', () => {
      const harness = createContainerTestHarness({
        modules: [testModule],
      });

      expect(harness.isBound(TEST_SERVICE)).toBe(true);
      expect(harness.isBound(OTHER_SERVICE)).toBe(true);

      harness.dispose();
    });

    it('should return false for unbound services', () => {
      const harness = createContainerTestHarness({
        modules: [testModule],
      });

      expect(harness.isBound(Symbol.for('UnboundService'))).toBe(false);

      harness.dispose();
    });
  });

  describe('get', () => {
    it('should resolve bound services', () => {
      const harness = createContainerTestHarness({
        modules: [testModule],
      });

      const service = harness.get<TestService>(TEST_SERVICE);
      expect(service.getValue()).toBe('test-value');

      harness.dispose();
    });

    it('should throw for unbound services', () => {
      const harness = createContainerTestHarness({
        modules: [testModule],
      });

      expect(() => harness.get(Symbol.for('UnboundService'))).toThrow();

      harness.dispose();
    });

    it('should return singletons', () => {
      const harness = createContainerTestHarness({
        modules: [testModule],
      });

      const service1 = harness.get<TestService>(TEST_SERVICE);
      const service2 = harness.get<TestService>(TEST_SERVICE);
      expect(service1).toBe(service2);

      harness.dispose();
    });
  });

  describe('getAll', () => {
    it('should resolve all bound services for multi-injection', () => {
      const harness = createContainerTestHarness({
        modules: [multiModule],
      });

      const services = harness.getAll<{ id: number }>(MULTI_SERVICE);
      expect(services).toHaveLength(2);
      expect(services.map((s) => s.id).sort()).toEqual([1, 2]);

      harness.dispose();
    });

    it('should return empty array for unbound multi-injection', () => {
      const harness = createContainerTestHarness({
        modules: [testModule],
      });

      const services = harness.getAll(MULTI_SERVICE);
      expect(services).toEqual([]);

      harness.dispose();
    });
  });

  describe('container', () => {
    it('should expose underlying container', () => {
      const harness = createContainerTestHarness({
        modules: [testModule],
      });

      expect(harness.container).toBeInstanceOf(Container);
      expect(harness.container.isBound(TEST_SERVICE)).toBe(true);

      harness.dispose();
    });
  });

  describe('dispose', () => {
    it('should unbind all services', () => {
      const harness = createContainerTestHarness({
        modules: [testModule],
      });

      expect(harness.isBound(TEST_SERVICE)).toBe(true);

      harness.dispose();

      // After dispose, container should be empty
      expect(harness.container.isBound(TEST_SERVICE)).toBe(false);
    });
  });

  describe('multiple modules', () => {
    it('should load all modules', () => {
      const harness = createContainerTestHarness({
        modules: [testModule, multiModule],
      });

      expect(harness.isBound(TEST_SERVICE)).toBe(true);
      expect(harness.isBound(OTHER_SERVICE)).toBe(true);
      expect(harness.isBound(MULTI_SERVICE)).toBe(true);

      harness.dispose();
    });
  });
});
