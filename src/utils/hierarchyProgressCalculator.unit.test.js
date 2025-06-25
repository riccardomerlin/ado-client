// Unit tests for hierarchy progress calculator focusing on calculation logic

import { test, describe } from 'node:test';
import assert from 'node:assert';

// Import the progress calculation function directly
import { calculateItemProgress } from './progressCalculator.js';

describe('HierarchyProgressCalculator - Unit Tests', () => {
    describe('calculateItemProgress', () => {
        test('should calculate progress for leaf nodes based on state', () => {
            const taskNew = { workItemType: 'Task', state: 'New' };
            const taskClosed = { workItemType: 'Task', state: 'Closed' };
            const taskActive = { workItemType: 'Task', state: 'Active' };
            const taskDone = { workItemType: 'Task', state: 'Done' };

            // Only Done/Closed/Completed states count as 100%, everything else is 0%
            assert.strictEqual(calculateItemProgress(taskNew, []), 0);
            assert.strictEqual(calculateItemProgress(taskClosed, []), 100);
            assert.strictEqual(calculateItemProgress(taskActive, []), 0);  // Active = 0% per business rules
            assert.strictEqual(calculateItemProgress(taskDone, []), 100);
        }); test('should calculate progress for parent items based on children average', () => {
            const feature = { workItemType: 'Feature', state: 'Active' };
            const children = [
                { progress: 0 },   // New task
                { progress: 100 }, // Done task
                { progress: 0 },   // Active task (0% per business rules)
                { progress: 100 }  // Closed task
            ];

            // Average: (0 + 100 + 0 + 100) / 4 = 50%
            const expectedProgress = Math.round((0 + 100 + 0 + 100) / 4);
            assert.strictEqual(calculateItemProgress(feature, children), expectedProgress);
        }); test('should handle empty children array', () => {
            const epic = { workItemType: 'Epic', state: 'Active' };
            // When no children, should return progress based on state (Active = 0% per business rules)
            assert.strictEqual(calculateItemProgress(epic, []), 0);
        });

        test('should calculate Epic 329168 scenario correctly', () => {
            // Feature 329169: PBI 329379 = 40% (2/5 tasks done), PBI 329378 = 0% (New)
            const feature329169 = { workItemType: 'Feature', state: 'Active' };
            const feature329169Children = [
                { progress: 40 }, // PBI 329379 with 2/5 tasks completed
                { progress: 0 }   // PBI 329378 (New state)
            ];
            assert.strictEqual(calculateItemProgress(feature329169, feature329169Children), 20); // (40 + 0) / 2

            // Feature 331927: All 3 PBIs are New = 0% progress
            const feature331927 = { workItemType: 'Feature', state: 'New' };
            const feature331927Children = [
                { progress: 0 }, // PBI 331928 (New)
                { progress: 0 }, // PBI 331929 (New) 
                { progress: 0 }  // PBI 331930 (New)
            ];
            assert.strictEqual(calculateItemProgress(feature331927, feature331927Children), 0); // (0 + 0 + 0) / 3

            // Epic 329168: Feature 329169 (20%) + Feature 331927 (0%)
            const epic329168 = { workItemType: 'Epic', state: 'Active' };
            const epic329168Children = [
                { progress: 20 }, // Feature 329169
                { progress: 0 }   // Feature 331927
            ];
            assert.strictEqual(calculateItemProgress(epic329168, epic329168Children), 10); // (20 + 0) / 2 = 10%
        }); test('should handle PBI with mixed task states', () => {
            // PBI 329379: 5 tasks (2 done, 1 in progress, 2 new)
            const pbi329379 = { workItemType: 'Product Backlog Item', state: 'Active' };
            const pbi329379Children = [
                { progress: 100 }, // Task 1 (Done)
                { progress: 100 }, // Task 2 (Done)
                { progress: 0 },   // Task 3 (In Progress - counts as 0% per business rules)
                { progress: 0 },   // Task 4 (New)
                { progress: 0 }    // Task 5 (New)
            ];

            // Expected: (100 + 100 + 0 + 0 + 0) / 5 = 200 / 5 = 40%
            // This matches the actual API response for PBI 329379
            assert.strictEqual(calculateItemProgress(pbi329379, pbi329379Children), 40);
        });

        test('should round to nearest integer', () => {
            const parent = { workItemType: 'Feature', state: 'Active' };

            // Test rounding down
            const childrenDown = [
                { progress: 33 },
                { progress: 33 }
            ];
            assert.strictEqual(calculateItemProgress(parent, childrenDown), 33); // 33.0

            // Test rounding up  
            const childrenUp = [
                { progress: 33 },
                { progress: 34 }
            ];
            assert.strictEqual(calculateItemProgress(parent, childrenUp), 34); // 33.5 -> 34
        });
    });
    describe('Progress State Mapping', () => {
        test('should map all known states correctly', () => {
            const workItem = { workItemType: 'Task' };

            // Test all state mappings - business rule: only Done/Closed/Completed = 100%
            const stateTests = [
                { state: 'New', expected: 0 },
                { state: 'Approved', expected: 0 },
                { state: 'Committed', expected: 0 },
                { state: 'Active', expected: 0 },        // Different from previous assumption
                { state: 'In Progress', expected: 0 },   // Different from previous assumption
                { state: 'Resolved', expected: 0 },      // Different from previous assumption
                { state: 'Closed', expected: 100 },
                { state: 'Completed', expected: 100 },
                { state: 'Done', expected: 100 },
                { state: 'Unknown State', expected: 0 } // Default for unknown states
            ];

            stateTests.forEach(({ state, expected }) => {
                const item = { ...workItem, state };
                assert.strictEqual(
                    calculateItemProgress(item, []),
                    expected,
                    `State '${state}' should map to ${expected}%`
                );
            });
        });
    });
});
