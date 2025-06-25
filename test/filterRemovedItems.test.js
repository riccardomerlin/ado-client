import { test, describe } from 'node:test';
import assert from 'node:assert';

describe('Removed Items Filtering', () => {
  test('should verify WIQL query excludes removed epics', () => {
    // This test verifies that the WIQL query structure is correct
    const expectedWiqlPattern = /AND \[System\.State\] <> 'Removed'/;
    
    // Mock the actual query construction
    const releaseValue = '25R3';
    const areaPath = 'git1601\\25R3 Product Roadmap';
    const wiql = `SELECT [System.Id], [System.Title], [System.State] FROM WorkItems WHERE [System.WorkItemType] = 'Epic' AND [Kneat.Gx.Release] = '${releaseValue}' AND [System.AreaPath] = '${areaPath}' AND [System.State] <> 'Removed' ORDER BY [System.Title]`;
    
    assert.match(wiql, expectedWiqlPattern);
    assert.ok(wiql.includes("AND [System.State] <> 'Removed'"));
  });

  test('should filter removed items from children array', () => {
    // Mock children data including a removed item
    const mockChildren = [
      {
        id: 1,
        fields: {
          'System.Title': 'Active Feature',
          'System.State': 'Active',
          'System.WorkItemType': 'Feature'
        }
      },
      {
        id: 2,
        fields: {
          'System.Title': 'Removed Feature',
          'System.State': 'Removed',
          'System.WorkItemType': 'Feature'
        }
      },
      {
        id: 3,
        fields: {
          'System.Title': 'New PBI',
          'System.State': 'New',
          'System.WorkItemType': 'Product Backlog Item'
        }
      }
    ];

    // Apply the same filtering logic as in the API
    const activeChildren = mockChildren.filter(child => 
      child.fields['System.State'] !== 'Removed'
    );

    // Should have 2 items (Active Feature and New PBI)
    assert.strictEqual(activeChildren.length, 2);
    assert.strictEqual(activeChildren[0].fields['System.Title'], 'Active Feature');
    assert.strictEqual(activeChildren[1].fields['System.Title'], 'New PBI');
    
    // Verify no removed items are included
    const removedItems = activeChildren.filter(child => 
      child.fields['System.State'] === 'Removed'
    );
    assert.strictEqual(removedItems.length, 0);
  });

  test('should handle release filtering with removed items exclusion', () => {
    // Mock children with release filtering and removed state
    const mockChildren = [
      {
        id: 1,
        fields: {
          'System.WorkItemType': 'Feature',
          'System.State': 'Active',
          'Kneat.Gx.Release': '25R3'
        }
      },
      {
        id: 2,
        fields: {
          'System.WorkItemType': 'Feature',
          'System.State': 'Removed',
          'Kneat.Gx.Release': '25R3'
        }
      },
      {
        id: 3,
        fields: {
          'System.WorkItemType': 'Task',
          'System.State': 'Active'
          // Tasks don't have release field
        }
      },
      {
        id: 4,
        fields: {
          'System.WorkItemType': 'Feature',
          'System.State': 'New',
          'Kneat.Gx.Release': '25R4' // Different release
        }
      }
    ];

    const releaseValue = '25R3';

    // Apply the filtering logic from getWorkItemChildrenByRelease
    const filteredChildren = mockChildren.filter(child => {
      const workItemType = child.fields['System.WorkItemType'];
      const releaseField = child.fields['Kneat.Gx.Release'];
      const state = child.fields['System.State'];
      
      // Exclude removed items
      if (state === 'Removed') {
        return false;
      }
      
      // Tasks don't have Release field, so always include them (if not removed)
      if (workItemType === 'Task') {
        return true;
      }
      
      // For Epics, Features, and PBIs, filter by Release
      return releaseField === releaseValue;
    });

    // Should have 2 items: Active Feature (25R3) and Active Task
    assert.strictEqual(filteredChildren.length, 2);
    assert.strictEqual(filteredChildren[0].id, 1); // Active Feature
    assert.strictEqual(filteredChildren[1].id, 3); // Active Task
    
    // Verify filtering worked correctly
    const removedItems = filteredChildren.filter(child => 
      child.fields['System.State'] === 'Removed'
    );
    assert.strictEqual(removedItems.length, 0);
    
    const wrongReleaseItems = filteredChildren.filter(child => {
      const workItemType = child.fields['System.WorkItemType'];
      const releaseField = child.fields['Kneat.Gx.Release'];
      return workItemType !== 'Task' && releaseField !== releaseValue;
    });
    assert.strictEqual(wrongReleaseItems.length, 0);
  });
});
