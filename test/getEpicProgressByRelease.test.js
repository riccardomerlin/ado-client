import { test, describe, before, mock } from 'node:test';
import assert from 'node:assert';

// Mock node-fetch
const mockFetch = mock.fn();
mock.module('node-fetch', () => ({
  default: mockFetch
}));

// Mock fs promises
const mockReadFile = mock.fn();
mock.module('fs', () => ({
  promises: {
    readFile: mockReadFile
  }
}));

// Set up environment
process.env.ADO_CLIENT_PAT = 'test-pat';

describe('getEpicProgressByRelease', () => {
  let getEpicProgressByRelease;

  before(async () => {
    // Mock config file read
    mockReadFile.mock.mockImplementation(() => 
      Promise.resolve(JSON.stringify({
        orgUrl: 'https://dev.azure.com/testorg',
        projectName: 'testproject',
        apiVersion: '7.1'
      }))
    );

    // Import the module after mocking
    const module = await import('../src/apis/getEpicProgressByRelease.js');
    getEpicProgressByRelease = module.default;
  });

  test('should calculate epic progress with release filtering', async () => {
    const epicId = 123;
    const release = '25R3';

    // Mock Epic children response
    const mockEpicResponse = {
      id: epicId,
      relations: [
        {
          rel: 'System.LinkTypes.Hierarchy-Forward',
          url: 'https://dev.azure.com/_apis/wit/workItems/456'
        },
        {
          rel: 'System.LinkTypes.Hierarchy-Forward',
          url: 'https://dev.azure.com/_apis/wit/workItems/789'
        }
      ]
    };

    // Mock Epic children details (release filtered)
    const mockEpicChildrenResponse = {
      value: [
        {
          id: 456,
          fields: {
            'System.Title': 'Feature 1',
            'System.State': 'Active',
            'System.WorkItemType': 'Feature',
            'Kneat.Gx.Release': '25R3'
          }
        }
        // Note: Feature 789 is filtered out because it has different release
      ]
    };

    // Mock Feature children response
    const mockFeatureResponse = {
      id: 456,
      relations: [
        {
          rel: 'System.LinkTypes.Hierarchy-Forward',
          url: 'https://dev.azure.com/_apis/wit/workItems/999'
        }
      ]
    };

    // Mock Feature children details
    const mockFeatureChildrenResponse = {
      value: [
        {
          id: 999,
          fields: {
            'System.Title': 'PBI 1',
            'System.State': 'Done',
            'System.WorkItemType': 'Product Backlog Item',
            'Kneat.Gx.Release': '25R3'
          }
        }
      ]
    };

    // Mock PBI children response (no children)
    const mockPbiResponse = {
      id: 999,
      relations: []
    };

    // Set up fetch mock responses
    mockFetch.mock.mockImplementationOnce(() => 
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockEpicResponse)
      })
    );

    mockFetch.mock.mockImplementationOnce(() => 
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockEpicChildrenResponse)
      })
    );

    mockFetch.mock.mockImplementationOnce(() => 
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockFeatureResponse)
      })
    );

    mockFetch.mock.mockImplementationOnce(() => 
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockFeatureChildrenResponse)
      })
    );

    mockFetch.mock.mockImplementationOnce(() => 
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockPbiResponse)
      })
    );

    const result = await getEpicProgressByRelease(epicId, release);
    
    // Assertions
    assert.strictEqual(result.calculationMethod, 'release-filtered');
    assert.strictEqual(result.releaseValue, release);
    assert.strictEqual(result.childCount, 1); // Only one Feature matches the release
    assert.strictEqual(result.children.length, 1);
    assert.strictEqual(result.children[0].id, 456);
    assert.strictEqual(result.children[0].progress, 100); // Feature has 1 Done PBI = 100%
    assert.strictEqual(result.epicProgress, 100); // Epic progress = 100/1 = 100%
    assert.strictEqual(result.totalProgress, 100);
  });

  test('should calculate epic progress without release filtering', async () => {
    const epicId = 123;

    // Mock response with multiple children (no release filtering)
    const mockEpicResponse = {
      id: epicId,
      relations: [
        {
          rel: 'System.LinkTypes.Hierarchy-Forward',
          url: 'https://dev.azure.com/_apis/wit/workItems/456'
        },
        {
          rel: 'System.LinkTypes.Hierarchy-Forward',
          url: 'https://dev.azure.com/_apis/wit/workItems/789'
        }
      ]
    };

    const mockEpicChildrenResponse = {
      value: [
        {
          id: 456,
          fields: {
            'System.Title': 'Feature 1',
            'System.State': 'Done',
            'System.WorkItemType': 'Feature'
          }
        },
        {
          id: 789,
          fields: {
            'System.Title': 'Feature 2',
            'System.State': 'Active',
            'System.WorkItemType': 'Feature'
          }
        }
      ]
    };

    // Mock both features having no children
    const mockNoChildrenResponse = {
      relations: []
    };

    mockFetch.mock.mockImplementationOnce(() => 
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockEpicResponse)
      })
    );

    mockFetch.mock.mockImplementationOnce(() => 
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockEpicChildrenResponse)
      })
    );

    mockFetch.mock.mockImplementationOnce(() => 
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockNoChildrenResponse)
      })
    );

    mockFetch.mock.mockImplementationOnce(() => 
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockNoChildrenResponse)
      })
    );

    const result = await getEpicProgressByRelease(epicId); // No release parameter
    
    // Assertions
    assert.strictEqual(result.calculationMethod, 'all-children');
    assert.strictEqual(result.childCount, 2); // Both Features included
    assert.strictEqual(result.children.length, 2);
    assert.strictEqual(result.children[0].progress, 100); // Done Feature = 100%
    assert.strictEqual(result.children[1].progress, 0); // Active Feature = 0%
    assert.strictEqual(result.epicProgress, 50); // Epic progress = (100+0)/2 = 50%
    assert.strictEqual(result.totalProgress, 100);
  });

  test('should handle epic with no children', async () => {
    const epicId = 123;
    const release = '25R3';

    const mockEpicResponse = {
      id: epicId,
      relations: []
    };

    mockFetch.mock.mockImplementationOnce(() => 
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockEpicResponse)
      })
    );

    const result = await getEpicProgressByRelease(epicId, release);
    
    assert.strictEqual(result.calculationMethod, 'no-children');
    assert.strictEqual(result.epicProgress, 0);
    assert.strictEqual(result.childCount, 0);
    assert.strictEqual(result.children.length, 0);
  });

  test('should throw error when epic ID is not provided', async () => {
    await assert.rejects(
      () => getEpicProgressByRelease(),
      { message: 'Epic ID is required' }
    );
  });
});
