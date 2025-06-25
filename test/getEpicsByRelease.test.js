import { test, describe, before, mock } from 'node:test';
import assert from 'node:assert';

// Set up environment
process.env.ADO_CLIENT_PAT = 'test-pat';

describe('getEpicsByRelease', () => {
  let getEpicsByRelease;
  let originalFetch;

  before(async () => {
    // Mock global fetch
    originalFetch = global.fetch;
    global.fetch = mock.fn();
    
    // Mock fs module by creating a temporary config
    const fs = await import('fs');
    const originalReadFile = fs.promises.readFile;
    fs.promises.readFile = mock.fn().mockImplementation(() => 
      Promise.resolve(JSON.stringify({
        orgUrl: 'https://dev.azure.com/testorg',
        projectName: 'testproject',
        apiVersion: '7.1'
      }))
    );

    // Import the module after mocking
    const module = await import('../src/apis/getEpicsByRelease.js');
    getEpicsByRelease = module.default;
  });
  test('should throw error when release value is not provided', async () => {
    await assert.rejects(
      () => getEpicsByRelease(),
      { message: 'Release value is required' }
    );
  });

  test('should throw error when area path is not provided', async () => {
    await assert.rejects(
      () => getEpicsByRelease('Release 1.0'),
      { message: 'AreaPath value is required' }
    );
  });  test('should return empty array when no work items found', async () => {
    global.fetch.mock.mockImplementationOnce(() => 
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ workItems: [] })
      })
    );

    const result = await getEpicsByRelease('Release 1.0', 'git1601\\25R3 Product Roadmap');
    assert.deepStrictEqual(result, []);
  });

  test('should fetch epics successfully', async () => {
    const mockWiqlResponse = {
      workItems: [{ id: 123 }, { id: 456 }]
    };

    const mockDetailsResponse = {
      value: [
        {
          id: 123,
          fields: {
            'System.Title': 'Epic 1',
            'System.State': 'Active',
            'System.WorkItemType': 'Epic'
          }
        },
        {
          id: 456,
          fields: {
            'System.Title': 'Epic 2',
            'System.State': 'New',
            'System.WorkItemType': 'Epic'
          }
        }
      ]
    };

    global.fetch.mock.mockImplementationOnce(() => 
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockWiqlResponse)
      })
    );

    global.fetch.mock.mockImplementationOnce(() => 
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockDetailsResponse)
      })
    );

    const result = await getEpicsByRelease('Release 1.0', 'git1601\\25R3 Product Roadmap');
    
    assert.strictEqual(result.length, 2);
    assert.strictEqual(result[0].id, 123);
    assert.strictEqual(result[0].title, 'Epic 1');
    assert.strictEqual(result[0].state, 'Active');
    assert.strictEqual(result[1].id, 456);
    assert.strictEqual(result[1].title, 'Epic 2');
  });

  test('should filter out removed epics', async () => {
    const mockWiqlResponse = {
      workItems: [{ id: 123 }, { id: 456 }, { id: 789 }]
    };

    const mockDetailsResponse = {
      value: [
        {
          id: 123,
          fields: {
            'System.Title': 'Active Epic',
            'System.State': 'Active',
            'System.WorkItemType': 'Epic'
          }
        },
        {
          id: 456,
          fields: {
            'System.Title': 'Removed Epic',
            'System.State': 'Removed',
            'System.WorkItemType': 'Epic'
          }
        },
        {
          id: 789,
          fields: {
            'System.Title': 'New Epic',
            'System.State': 'New',
            'System.WorkItemType': 'Epic'
          }
        }
      ]
    };

    global.fetch.mock.mockImplementationOnce(() => 
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockWiqlResponse)
      })
    );

    global.fetch.mock.mockImplementationOnce(() => 
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockDetailsResponse)
      })
    );

    const result = await getEpicsByRelease('Release 1.0', 'git1601\\25R3 Product Roadmap');
    
    // Should return 2 items (Active and New), filtering out the Removed one
    assert.strictEqual(result.length, 2);
    assert.strictEqual(result[0].id, 123);
    assert.strictEqual(result[0].title, 'Active Epic');
    assert.strictEqual(result[1].id, 789);
    assert.strictEqual(result[1].title, 'New Epic');
    
    // Verify no removed items are included
    const removedItems = result.filter(item => item.state === 'Removed');
    assert.strictEqual(removedItems.length, 0);
  });
});
