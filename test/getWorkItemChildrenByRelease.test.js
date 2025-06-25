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

describe('getWorkItemChildrenByRelease', () => {
  let getWorkItemChildrenByRelease;

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
    const module = await import('../src/apis/getWorkItemChildrenByRelease.js');
    getWorkItemChildrenByRelease = module.default;
  });

  test('should throw error when work item ID is not provided', async () => {
    await assert.rejects(
      () => getWorkItemChildrenByRelease(),
      { message: 'Work item ID is required' }
    );
  });

  test('should throw error when release value is not provided', async () => {
    await assert.rejects(
      () => getWorkItemChildrenByRelease(123),
      { message: 'Release value is required' }
    );
  });

  test('should filter children by release (excluding Tasks)', async () => {
    const mockWorkItemResponse = {
      id: 123,
      relations: [
        {
          rel: 'System.LinkTypes.Hierarchy-Forward',
          url: 'https://dev.azure.com/_apis/wit/workItems/456'
        },
        {
          rel: 'System.LinkTypes.Hierarchy-Forward',
          url: 'https://dev.azure.com/_apis/wit/workItems/789'
        },
        {
          rel: 'System.LinkTypes.Hierarchy-Forward',
          url: 'https://dev.azure.com/_apis/wit/workItems/999'
        }
      ]
    };

    const mockChildrenResponse = {
      value: [
        {
          id: 456,
          fields: {
            'System.Title': 'Feature 1',
            'System.State': 'Active',
            'System.WorkItemType': 'Feature',
            'Release': 'Release 1.0'
          }
        },
        {
          id: 789,
          fields: {
            'System.Title': 'Feature 2',
            'System.State': 'Done',
            'System.WorkItemType': 'Feature',
            'Release': 'Release 2.0' // Different release - should be filtered out
          }
        },
        {
          id: 999,
          fields: {
            'System.Title': 'Task 1',
            'System.State': 'Active',
            'System.WorkItemType': 'Task'
            // Tasks don't have Release field - should always be included
          }
        }
      ]
    };

    mockFetch.mock.mockImplementationOnce(() => 
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockWorkItemResponse)
      })
    );

    mockFetch.mock.mockImplementationOnce(() => 
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockChildrenResponse)
      })
    );

    const result = await getWorkItemChildrenByRelease(123, 'Release 1.0');
    
    // Should only include Feature 1 (matching release) and Task 1 (Tasks are always included)
    assert.strictEqual(result.length, 2);
    assert.strictEqual(result[0].id, 456);
    assert.strictEqual(result[0].title, 'Feature 1');
    assert.strictEqual(result[1].id, 999);
    assert.strictEqual(result[1].title, 'Task 1');
  });
});
