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

describe('getWorkItemChildren', () => {
  let getWorkItemChildren;

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
    const module = await import('../src/apis/getWorkItemChildren.js');
    getWorkItemChildren = module.default;
  });

  test('should throw error when work item ID is not provided', async () => {
    await assert.rejects(
      () => getWorkItemChildren(),
      { message: 'Work item ID is required' }
    );
  });

  test('should return empty array when work item has no children', async () => {
    const mockWorkItemResponse = {
      id: 123,
      relations: []
    };

    mockFetch.mock.mockImplementationOnce(() => 
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockWorkItemResponse)
      })
    );

    const result = await getWorkItemChildren(123);
    assert.deepStrictEqual(result, []);
  });

  test('should fetch children successfully', async () => {
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
            'System.WorkItemType': 'Feature'
          }
        },
        {
          id: 789,
          fields: {
            'System.Title': 'Feature 2',
            'System.State': 'Done',
            'System.WorkItemType': 'Feature'
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

    const result = await getWorkItemChildren(123);
    
    assert.strictEqual(result.length, 2);
    assert.strictEqual(result[0].id, 456);
    assert.strictEqual(result[0].title, 'Feature 1');
    assert.strictEqual(result[0].state, 'Active');
    assert.strictEqual(result[1].id, 789);
    assert.strictEqual(result[1].title, 'Feature 2');
    assert.strictEqual(result[1].state, 'Done');
  });
});
