import assert from 'assert';
import { describe, test } from 'node:test';
import { RelationshipStrategyFactory, HierarchyOnlyStrategy, HierarchyWithRelatedStrategy } from '../src/utils/relationshipStrategy.js';

describe('RelationshipStrategy', () => {
  describe('Factory', () => {
    test('should create hierarchy-only strategy by default', () => {
      const strategy = RelationshipStrategyFactory.create();
      assert.ok(strategy instanceof HierarchyOnlyStrategy);
      assert.strictEqual(strategy.getName(), 'hierarchy-only');
    });

    test('should create hierarchy-only strategy explicitly', () => {
      const strategy = RelationshipStrategyFactory.create('hierarchy-only');
      assert.ok(strategy instanceof HierarchyOnlyStrategy);
      assert.strictEqual(strategy.getName(), 'hierarchy-only');
    });

    test('should create hierarchy-with-related strategy', () => {
      const strategy = RelationshipStrategyFactory.create('hierarchy-with-related');
      assert.ok(strategy instanceof HierarchyWithRelatedStrategy);
      assert.strictEqual(strategy.getName(), 'hierarchy-with-related');
    });

    test('should throw error for unknown strategy type', () => {
      assert.throws(() => {
        RelationshipStrategyFactory.create('unknown-strategy');
      }, /Unknown strategy type: unknown-strategy/);
    });

    test('should return available strategies', () => {
      const strategies = RelationshipStrategyFactory.getAvailableStrategies();
      assert.deepStrictEqual(strategies, ['hierarchy-only', 'hierarchy-with-related']);
    });
  });

  describe('Strategy behavior', () => {
    test('hierarchy-only strategy should be defined', () => {
      const strategy = new HierarchyOnlyStrategy();
      assert.strictEqual(typeof strategy.loadChildren, 'function');
      assert.strictEqual(strategy.getName(), 'hierarchy-only');
    });

    test('hierarchy-with-related strategy should be defined', () => {
      const strategy = new HierarchyWithRelatedStrategy();
      assert.strictEqual(typeof strategy.loadChildren, 'function');
      assert.strictEqual(strategy.getName(), 'hierarchy-with-related');
    });
  });
});
