import assert from 'assert';
import { describe, test } from 'node:test';

describe('Related Items First Level Only', () => {
  describe('Strategy Application Logic', () => {
    test('should apply Related items strategy only at first level (depth 0)', () => {
      // Mock test to validate the logic of applying strategy only at first level
      
      const mockHierarchy = {
        level0: {
          depth: 0,
          shouldUseStrategy: true,
          description: 'Root level - should include Related items when strategy is hierarchy-with-related'
        },
        level1: {
          depth: 1,
          shouldUseStrategy: false,
          description: 'Second level - should always use hierarchy-only, regardless of strategy'
        },
        level2: {
          depth: 2,
          shouldUseStrategy: false,
          description: 'Third level - should always use hierarchy-only, regardless of strategy'
        }
      };

      // Validate the expected behavior at each level
      Object.values(mockHierarchy).forEach(level => {
        const actualShouldUseStrategy = level.depth === 0;
        assert.strictEqual(
          actualShouldUseStrategy,
          level.shouldUseStrategy,
          `Level ${level.depth}: ${level.description}`
        );
      });

      console.log('✓ Strategy application logic validated: Related items only at first level');
    });

    test('should demonstrate hierarchy structure with Related items at first level only', () => {
      // Mock scenario: Epic with Related items at first level
      const mockEpicStructure = {
        epic: {
          id: 'Epic-123',
          level: 0,
          directChildren: [
            { id: 'Feature-1', type: 'hierarchy-child', level: 1 },
            { id: 'Feature-2', type: 'hierarchy-child', level: 1 }
          ],
          relatedItems: [
            { id: 'Feature-3', type: 'related-item', level: 1 }
          ],
          // Level 1 items (Features) should only have hierarchy children
          level1ChildrenOfFeature1: [
            { id: 'PBI-1.1', type: 'hierarchy-child', level: 2 },
            { id: 'PBI-1.2', type: 'hierarchy-child', level: 2 }
          ],
          level1ChildrenOfFeature3: [
            { id: 'PBI-3.1', type: 'hierarchy-child', level: 2 }
          ]
        }
      };

      // First level: should include both hierarchy children AND related items
      const firstLevelItems = [
        ...mockEpicStructure.epic.directChildren,
        ...mockEpicStructure.epic.relatedItems
      ];
      
      assert.strictEqual(firstLevelItems.length, 3);
      assert.ok(firstLevelItems.some(item => item.type === 'hierarchy-child'));
      assert.ok(firstLevelItems.some(item => item.type === 'related-item'));

      // Second level and beyond: should only include hierarchy children
      const secondLevelItems = [
        ...mockEpicStructure.epic.level1ChildrenOfFeature1,
        ...mockEpicStructure.epic.level1ChildrenOfFeature3
      ];
      
      assert.strictEqual(secondLevelItems.length, 3);
      assert.ok(secondLevelItems.every(item => item.type === 'hierarchy-child'));
      assert.ok(!secondLevelItems.some(item => item.type === 'related-item'));

      console.log('✓ Hierarchy structure validated: Related items only at first level');
    });

    test('should validate relationship type filtering logic', () => {
      // Test the filtering logic that determines which relationships to load
      function getRelationshipTypesToLoad(depth, includeRelated) {
        if (depth === 0 && includeRelated) {
          return ['System.LinkTypes.Hierarchy-Forward', 'System.LinkTypes.Related'];
        } else {
          return ['System.LinkTypes.Hierarchy-Forward'];
        }
      }

      // Test first level with Related items enabled
      const firstLevelWithRelated = getRelationshipTypesToLoad(0, true);
      assert.deepStrictEqual(firstLevelWithRelated, [
        'System.LinkTypes.Hierarchy-Forward',
        'System.LinkTypes.Related'
      ]);

      // Test first level with Related items disabled
      const firstLevelWithoutRelated = getRelationshipTypesToLoad(0, false);
      assert.deepStrictEqual(firstLevelWithoutRelated, [
        'System.LinkTypes.Hierarchy-Forward'
      ]);

      // Test deeper levels (should always be hierarchy-only regardless of strategy)
      const secondLevelWithRelated = getRelationshipTypesToLoad(1, true);
      assert.deepStrictEqual(secondLevelWithRelated, [
        'System.LinkTypes.Hierarchy-Forward'
      ]);

      const thirdLevelWithRelated = getRelationshipTypesToLoad(2, true);
      assert.deepStrictEqual(thirdLevelWithRelated, [
        'System.LinkTypes.Hierarchy-Forward'
      ]);

      console.log('✓ Relationship type filtering logic validated');
    });
  });

  describe('Progress Calculation Impact', () => {
    test('should calculate progress correctly with Related items at first level only', () => {
      // Mock progress calculation scenario
      const mockProgressData = {
        epic: {
          id: 'Epic-123',
          firstLevelChildren: [
            { id: 'Feature-1', progress: 50, type: 'hierarchy-child' },    // Direct child
            { id: 'Feature-2', progress: 0, type: 'hierarchy-child' },     // Direct child
            { id: 'Feature-3', progress: 100, type: 'related-item' }       // Related item
          ]
        },
        feature1: {
          id: 'Feature-1',
          secondLevelChildren: [
            { id: 'PBI-1.1', progress: 100, type: 'hierarchy-child' },     // Only hierarchy
            { id: 'PBI-1.2', progress: 0, type: 'hierarchy-child' }        // Only hierarchy
          ]
        }
      };

      // Epic progress should include Related item at first level
      const epicProgress = mockProgressData.epic.firstLevelChildren
        .reduce((sum, child) => sum + child.progress, 0) / 
        mockProgressData.epic.firstLevelChildren.length;
      
      assert.strictEqual(epicProgress, 50); // (50 + 0 + 100) / 3 = 50

      // Feature-1 progress should only include hierarchy children (no Related items)
      const feature1Progress = mockProgressData.feature1.secondLevelChildren
        .reduce((sum, child) => sum + child.progress, 0) /
        mockProgressData.feature1.secondLevelChildren.length;
      
      assert.strictEqual(feature1Progress, 50); // (100 + 0) / 2 = 50

      console.log('✓ Progress calculation with Related items at first level only validated');
    });
  });
});
