import assert from 'assert';
import { describe, test } from 'node:test';

// Note: These are mock tests to validate structure since we can't easily test against real ADO data
describe('Related Items Integration', () => {
  describe('API Structure Validation', () => {
    test('should export getWorkItemChildrenWithRelated function', async () => {
      try {
        const { default: getWorkItemChildrenWithRelated } = await import('../src/apis/getWorkItemChildrenWithRelated.js');
        assert.strictEqual(typeof getWorkItemChildrenWithRelated, 'function');
        console.log('✓ getWorkItemChildrenWithRelated API exported correctly');
      } catch (error) {
        assert.fail(`Failed to import getWorkItemChildrenWithRelated: ${error.message}`);
      }
    });

    test('should export getWorkItemChildrenWithRelatedByRelease function', async () => {
      try {
        const { default: getWorkItemChildrenWithRelatedByRelease } = await import('../src/apis/getWorkItemChildrenWithRelatedByRelease.js');
        assert.strictEqual(typeof getWorkItemChildrenWithRelatedByRelease, 'function');
        console.log('✓ getWorkItemChildrenWithRelatedByRelease API exported correctly');
      } catch (error) {
        assert.fail(`Failed to import getWorkItemChildrenWithRelatedByRelease: ${error.message}`);
      }
    });

    test('should export relationship strategy classes', async () => {
      try {
        const { RelationshipStrategyFactory, HierarchyOnlyStrategy, HierarchyWithRelatedStrategy } = await import('../src/utils/relationshipStrategy.js');
        
        assert.strictEqual(typeof RelationshipStrategyFactory.create, 'function');
        assert.strictEqual(typeof HierarchyOnlyStrategy, 'function');
        assert.strictEqual(typeof HierarchyWithRelatedStrategy, 'function');
        
        // Test strategy creation
        const hierarchyOnly = RelationshipStrategyFactory.create('hierarchy-only');
        const hierarchyWithRelated = RelationshipStrategyFactory.create('hierarchy-with-related');
        
        assert.ok(hierarchyOnly instanceof HierarchyOnlyStrategy);
        assert.ok(hierarchyWithRelated instanceof HierarchyWithRelatedStrategy);
        
        console.log('✓ Relationship strategy classes exported and working correctly');
      } catch (error) {
        assert.fail(`Failed to test relationship strategies: ${error.message}`);
      }
    });

    test('should export enhanced hierarchy progress calculator functions', async () => {
      try {
        const { getChildrenWithBottomUpProgressUsingStrategy, getChildrenWithBatchedProgressUsingStrategy } = await import('../src/utils/hierarchyProgressCalculator.js');
        
        assert.strictEqual(typeof getChildrenWithBottomUpProgressUsingStrategy, 'function');
        assert.strictEqual(typeof getChildrenWithBatchedProgressUsingStrategy, 'function');
        
        console.log('✓ Enhanced hierarchy progress calculator functions exported correctly');
      } catch (error) {
        assert.fail(`Failed to import enhanced hierarchy functions: ${error.message}`);
      }
    });
  });

  describe('Relationship Filter Logic', () => {
    test('should correctly identify both hierarchy and related relationships', () => {
      // Mock work item with both types of relationships
      const mockWorkItem = {
        relations: [
          {
            rel: 'System.LinkTypes.Hierarchy-Forward',
            url: 'https://example.com/workitem/123'
          },
          {
            rel: 'System.LinkTypes.Related',
            url: 'https://example.com/workitem/456'
          },
          {
            rel: 'System.LinkTypes.Dependency',  // Should be excluded
            url: 'https://example.com/workitem/789'
          }
        ]
      };

      // Apply the same filtering logic as in our new APIs
      const relevantRelations = mockWorkItem.relations?.filter(relation => 
        relation.rel === 'System.LinkTypes.Hierarchy-Forward' || // Direct children
        relation.rel === 'System.LinkTypes.Related'              // Related items
      ) || [];

      assert.strictEqual(relevantRelations.length, 2);
      assert.ok(relevantRelations.some(r => r.rel === 'System.LinkTypes.Hierarchy-Forward'));
      assert.ok(relevantRelations.some(r => r.rel === 'System.LinkTypes.Related'));
      assert.ok(!relevantRelations.some(r => r.rel === 'System.LinkTypes.Dependency'));
      
      console.log('✓ Relationship filtering logic works correctly');
    });

    test('should handle work items with only hierarchy relationships', () => {
      const mockWorkItem = {
        relations: [
          {
            rel: 'System.LinkTypes.Hierarchy-Forward',
            url: 'https://example.com/workitem/123'
          }
        ]
      };

      const relevantRelations = mockWorkItem.relations?.filter(relation => 
        relation.rel === 'System.LinkTypes.Hierarchy-Forward' || 
        relation.rel === 'System.LinkTypes.Related'
      ) || [];

      assert.strictEqual(relevantRelations.length, 1);
      assert.strictEqual(relevantRelations[0].rel, 'System.LinkTypes.Hierarchy-Forward');
      
      console.log('✓ Hierarchy-only relationships handled correctly');
    });

    test('should handle work items with only related relationships', () => {
      const mockWorkItem = {
        relations: [
          {
            rel: 'System.LinkTypes.Related',
            url: 'https://example.com/workitem/456'
          }
        ]
      };

      const relevantRelations = mockWorkItem.relations?.filter(relation => 
        relation.rel === 'System.LinkTypes.Hierarchy-Forward' || 
        relation.rel === 'System.LinkTypes.Related'
      ) || [];

      assert.strictEqual(relevantRelations.length, 1);
      assert.strictEqual(relevantRelations[0].rel, 'System.LinkTypes.Related');
      
      console.log('✓ Related-only relationships handled correctly');
    });

    test('should handle work items with no relevant relationships', () => {
      const mockWorkItem = {
        relations: [
          {
            rel: 'System.LinkTypes.Dependency',
            url: 'https://example.com/workitem/789'
          }
        ]
      };

      const relevantRelations = mockWorkItem.relations?.filter(relation => 
        relation.rel === 'System.LinkTypes.Hierarchy-Forward' || 
        relation.rel === 'System.LinkTypes.Related'
      ) || [];

      assert.strictEqual(relevantRelations.length, 0);
      
      console.log('✓ Work items with no relevant relationships handled correctly');
    });
  });
});
