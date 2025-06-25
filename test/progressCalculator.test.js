import { test, describe } from 'node:test';
import assert from 'node:assert';
import { calculateProgress, calculateItemProgress } from '../src/utils/progressCalculator.js';

describe('Progress Calculator', () => {
  test('should return 0 for empty children array', () => {
    const result = calculateProgress([]);
    assert.strictEqual(result, 0);
  });

  test('should return 0 for null or undefined children', () => {
    assert.strictEqual(calculateProgress(null), 0);
    assert.strictEqual(calculateProgress(undefined), 0);
  });

  test('should calculate 100% when all children are done', () => {
    const children = [
      { state: 'Done' },
      { state: 'Done' },
      { state: 'Done' }
    ];
    const result = calculateProgress(children);
    assert.strictEqual(result, 100);
  });

  test('should calculate 0% when no children are done', () => {
    const children = [
      { state: 'New' },
      { state: 'Active' },
      { state: 'Committed' }
    ];
    const result = calculateProgress(children);
    assert.strictEqual(result, 0);
  });

  test('should calculate 50% when half children are done', () => {
    const children = [
      { state: 'Done' },
      { state: 'Active' },
      { state: 'Done' },
      { state: 'New' }
    ];
    const result = calculateProgress(children);
    assert.strictEqual(result, 50);
  });

  test('should round to nearest integer', () => {
    const children = [
      { state: 'Done' },
      { state: 'Active' },
      { state: 'New' }
    ];
    const result = calculateProgress(children);
    assert.strictEqual(result, 33); // 33.33... rounded to 33
  });

  describe('calculateItemProgress', () => {
    test('should return progress based on state for leaf items', () => {
      const item = { state: 'Done' };
      const result = calculateItemProgress(item, []);
      assert.strictEqual(result, 100);
    });

    test('should return 0 for non-done leaf items', () => {
      const item = { state: 'Active' };
      const result = calculateItemProgress(item, []);
      assert.strictEqual(result, 0);
    });

    test('should calculate progress based on children for parent items', () => {
      const item = { state: 'Active' };
      const children = [
        { state: 'Done', hasChildren: false },
        { state: 'Active', hasChildren: false }
      ];
      const result = calculateItemProgress(item, children);
      assert.strictEqual(result, 50); // 1 out of 2 done
    });

    test('should handle mixed progress values in children', () => {
      const item = { state: 'Active' };
      const children = [
        { progress: 100, hasChildren: true },
        { progress: 50, hasChildren: true },
        { progress: 0, hasChildren: true }
      ];
      const result = calculateItemProgress(item, children);
      assert.strictEqual(result, 50); // (100 + 50 + 0) / 3
    });
  });
});
