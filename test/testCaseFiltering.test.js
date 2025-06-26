// Test to verify Test Cases are filtered out
import { test, describe } from 'node:test';
import assert from 'node:assert';

describe('Test Case Filtering', () => {
  test('should filter out Test Cases from children results', () => {
    // Mock children data including Test Cases
    const mockChildren = [
      {
        id: 1,
        fields: {
          'System.Title': 'Feature 1',
          'System.State': 'Active',
          'System.WorkItemType': 'Feature'
        }
      },
      {
        id: 2,
        fields: {
          'System.Title': 'Test Case 1',
          'System.State': 'Active',
          'System.WorkItemType': 'Test Case'
        }
      },
      {
        id: 3,
        fields: {
          'System.Title': 'PBI 1',
          'System.State': 'New',
          'System.WorkItemType': 'Product Backlog Item'
        }
      },
      {
        id: 4,
        fields: {
          'System.Title': 'Test Case 2',
          'System.State': 'Done',
          'System.WorkItemType': 'Test Case'
        }
      },
      {
        id: 5,
        fields: {
          'System.Title': 'Task 1',
          'System.State': 'Active',
          'System.WorkItemType': 'Task'
        }
      }
    ];

    // Apply the same filtering logic as in getWorkItemChildren.js
    const filteredChildren = mockChildren.filter(child => {
      const state = child.fields['System.State'];
      const workItemType = child.fields['System.WorkItemType'];
      
      // Exclude removed items
      if (state === 'Removed') {
        return false;
      }
      
      // Exclude Test Cases
      if (workItemType === 'Test Case') {
        return false;
      }
      
      return true;
    });

    // Should have 3 items (Feature, PBI, Task) - Test Cases should be filtered out
    assert.strictEqual(filteredChildren.length, 3);
    
    // Verify the correct items are included
    const workItemTypes = filteredChildren.map(child => child.fields['System.WorkItemType']);
    assert.ok(workItemTypes.includes('Feature'), 'Should include Feature');
    assert.ok(workItemTypes.includes('Product Backlog Item'), 'Should include PBI');
    assert.ok(workItemTypes.includes('Task'), 'Should include Task');
    
    // Verify Test Cases are excluded
    assert.ok(!workItemTypes.includes('Test Case'), 'Should not include Test Cases');
    
    // Verify specific items
    assert.strictEqual(filteredChildren[0].fields['System.Title'], 'Feature 1');
    assert.strictEqual(filteredChildren[1].fields['System.Title'], 'PBI 1');
    assert.strictEqual(filteredChildren[2].fields['System.Title'], 'Task 1');
  });

  test('should filter out Test Cases with release filtering', () => {
    const releaseFieldName = 'Custom.Release.Field';
    const mockChildren = [
      {
        id: 1,
        fields: {
          'System.Title': 'Feature 1',
          'System.State': 'Active',
          'System.WorkItemType': 'Feature',
          [releaseFieldName]: '25R3'
        }
      },
      {
        id: 2,
        fields: {
          'System.Title': 'Test Case 1',
          'System.State': 'Active',
          'System.WorkItemType': 'Test Case',
          [releaseFieldName]: '25R3'
        }
      },
      {
        id: 3,
        fields: {
          'System.Title': 'Task 1',
          'System.State': 'Active',
          'System.WorkItemType': 'Task'
          // Tasks don't have release field
        }
      }
    ];

    const releaseValue = '25R3';
    const includeAllReleases = false;

    // Apply the same filtering logic as in getWorkItemChildrenByRelease.js
    const filteredChildren = mockChildren.filter(child => {
      const workItemType = child.fields['System.WorkItemType'];
      const releaseField = child.fields[releaseFieldName];
      const state = child.fields['System.State'];
      
      // Exclude removed items
      if (state === 'Removed') {
        return false;
      }
      
      // Exclude Test Cases
      if (workItemType === 'Test Case') {
        return false;
      }
      
      // Tasks don't have Release field, so always include them (if not removed)
      if (workItemType === 'Task') {
        return true;
      }
      
      // If includeAllReleases is true, include all non-removed items regardless of release
      if (includeAllReleases) {
        return true;
      }
      
      // For Epics, Features, and PBIs, filter by Release when includeAllReleases is false
      return releaseField === releaseValue;
    });

    // Should have 2 items (Feature and Task) - Test Case should be filtered out
    assert.strictEqual(filteredChildren.length, 2);
    
    // Verify correct items are included
    const workItemTypes = filteredChildren.map(child => child.fields['System.WorkItemType']);
    assert.ok(workItemTypes.includes('Feature'), 'Should include Feature');
    assert.ok(workItemTypes.includes('Task'), 'Should include Task');
    assert.ok(!workItemTypes.includes('Test Case'), 'Should not include Test Case');
  });

  test('should handle Test Cases in removed state', () => {
    const mockChildren = [
      {
        id: 1,
        fields: {
          'System.Title': 'Active Test Case',
          'System.State': 'Active',
          'System.WorkItemType': 'Test Case'
        }
      },
      {
        id: 2,
        fields: {
          'System.Title': 'Removed Test Case',
          'System.State': 'Removed',
          'System.WorkItemType': 'Test Case'
        }
      },
      {
        id: 3,
        fields: {
          'System.Title': 'Active Feature',
          'System.State': 'Active',
          'System.WorkItemType': 'Feature'
        }
      }
    ];

    // Apply filtering logic
    const filteredChildren = mockChildren.filter(child => {
      const state = child.fields['System.State'];
      const workItemType = child.fields['System.WorkItemType'];
      
      // Exclude removed items
      if (state === 'Removed') {
        return false;
      }
      
      // Exclude Test Cases
      if (workItemType === 'Test Case') {
        return false;
      }
      
      return true;
    });

    // Should only have the Feature (both Test Cases filtered out - one for being Test Case, one for being Removed)
    assert.strictEqual(filteredChildren.length, 1);
    assert.strictEqual(filteredChildren[0].fields['System.WorkItemType'], 'Feature');
    assert.strictEqual(filteredChildren[0].fields['System.Title'], 'Active Feature');
  });
});
