// Integration tests for Epic 329168 progress calculation bug fix
// Tests the complete end-to-end functionality with real API calls

import { describe, test, before, after } from 'node:test';
import assert from 'node:assert';
import Fastify from 'fastify';
import path from 'path';
import { fileURLToPath } from 'url';
import { promises as fs } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Epic 329168 Integration Tests', () => {
  let app;

  before(async () => {
    // Create a test server instance
    app = Fastify({ logger: false });

    // Load config
    const configPath = path.resolve('config.json');
    const config = JSON.parse(await fs.readFile(configPath, 'utf-8'));

    // Register routes (same as main server)
    app.register(import('@fastify/static'), {
      root: path.join(__dirname, '../public'),
      prefix: '/public/',
    });

    // Import and register the work items route
    const getWorkItemChildren = (await import('../apis/getWorkItemChildren.js')).default;
    const getWorkItemChildrenByRelease = (await import('../apis/getWorkItemChildrenByRelease.js')).default;
    const { getChildrenWithBottomUpProgress } = await import('../utils/hierarchyProgressCalculator.js');

    app.get('/api/workitems/:id/children', async (request, reply) => {
      const { id } = request.params;
      const { release, includeAllReleases } = request.query;
      
      try {
        const includeAll = includeAllReleases === 'true';
        const childrenWithProgress = await getChildrenWithBottomUpProgress(id, release, includeAll);
        
        reply.send(childrenWithProgress);
      } catch (error) {
        reply.status(500).send({ error: error.message });
      }
    });

    await app.ready();
  });
  after(async () => {
    if (app) {
      await app.close();
    }
  });

  describe('Epic 329168 Progress Calculation', () => {
    test('should return 10% progress for Epic 329168 when accessed as child of Epic 326423', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/workitems/326423/children?release=25R3'
      });

      assert.strictEqual(response.statusCode, 200);
        const children = JSON.parse(response.payload);
      const epic329168 = children.find(child => child.id === 329168 || child.id === '329168');
      
      assert.ok(epic329168, 'Epic 329168 should be found');
      assert.strictEqual(epic329168.progress, 10);
      assert.ok(epic329168.title.includes('Custom Group'), 'Title should contain Epic 329168 info');
    });

    test('should return correct progress breakdown for Epic 329168 direct children', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/workitems/329168/children?release=25R3'
      });

      assert.strictEqual(response.statusCode, 200);
        const features = JSON.parse(response.payload);
      assert.strictEqual(features.length, 2);

      const feature331927 = features.find(f => f.id === 331927 || f.id === '331927');
      const feature329169 = features.find(f => f.id === 329169 || f.id === '329169');

      assert.ok(feature331927, 'Feature 331927 should be found');
      assert.ok(feature329169, 'Feature 329169 should be found');

      // Feature 331927: All PBIs are "New" = 0% progress
      assert.strictEqual(feature331927.progress, 0);

      // Feature 329169: Mixed PBI progress = 20% average
      assert.strictEqual(feature329169.progress, 20);
    });

    test('should correctly calculate Feature 329169 PBI progress', async () => {      const response = await app.inject({
        method: 'GET',
        url: '/api/workitems/329169/children?release=25R3'
      });

      assert.strictEqual(response.statusCode, 200);
        const pbis = JSON.parse(response.payload);
      assert.strictEqual(pbis.length, 2);

      const pbi329379 = pbis.find(p => p.id === 329379 || p.id === '329379');
      const pbi329378 = pbis.find(p => p.id === 329378 || p.id === '329378');

      assert.ok(pbi329379, 'PBI 329379 should be found');
      assert.ok(pbi329378, 'PBI 329378 should be found');

      // PBI 329379: 2 out of 5 tasks completed = 40% progress
      assert.strictEqual(pbi329379.progress, 40);

      // PBI 329378: "New" state = 0% progress  
      assert.strictEqual(pbi329378.progress, 0);
    });

    test('should correctly calculate PBI 329379 task progress', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/workitems/329379/children?release=25R3'
      });

      assert.strictEqual(response.statusCode, 200);
      
      const tasks = JSON.parse(response.payload);
      assert.strictEqual(tasks.length, 5);

      const doneTasks = tasks.filter(t => t.state === 'Done');
      const inProgressTasks = tasks.filter(t => t.state === 'In Progress');
      const newTasks = tasks.filter(t => t.state === 'New');

      assert.strictEqual(doneTasks.length, 2);
      
      // Each done task should have 100% progress
      doneTasks.forEach(task => {
        assert.strictEqual(task.progress, 100);
      });

      // Each non-done task should have 0% progress (per business rules)
      [...inProgressTasks, ...newTasks].forEach(task => {
        assert.strictEqual(task.progress, 0);
      });
    });
  });

  describe('Performance and Reliability', () => {    test('should handle API calls within reasonable time', async () => {
      const startTime = Date.now();
      
      const response = await app.inject({
        method: 'GET',
        url: '/api/workitems/326423/children?release=25R3'
      });

      const endTime = Date.now();
      const duration = endTime - startTime;

      assert.strictEqual(response.statusCode, 200);
      assert.ok(duration < 5000, 'Should complete within 5 seconds');
    });

    test('should return consistent results across multiple calls', async () => {
      const responses = await Promise.all([
        app.inject({ method: 'GET', url: '/api/workitems/329168/children?release=25R3' }),
        app.inject({ method: 'GET', url: '/api/workitems/329168/children?release=25R3' }),
        app.inject({ method: 'GET', url: '/api/workitems/329168/children?release=25R3' })
      ]);

      assert.ok(responses.every(r => r.statusCode === 200), 'All responses should be successful');

      const results = responses.map(r => JSON.parse(r.payload));
      
      // All results should be identical
      assert.deepStrictEqual(results[0], results[1]);
      assert.deepStrictEqual(results[1], results[2]);
    });

    test('should handle includeAllReleases parameter correctly', async () => {
      const withoutFlag = await app.inject({
        method: 'GET',
        url: '/api/workitems/329168/children?release=25R3'
      });

      const withFlag = await app.inject({
        method: 'GET',
        url: '/api/workitems/329168/children?release=25R3&includeAllReleases=true'
      });

      assert.strictEqual(withoutFlag.statusCode, 200);
      assert.strictEqual(withFlag.statusCode, 200);

      const withoutFlagData = JSON.parse(withoutFlag.payload);
      const withFlagData = JSON.parse(withFlag.payload);

      // Results might differ based on release filtering
      assert.ok(Array.isArray(withoutFlagData), 'Without flag should return array');
      assert.ok(Array.isArray(withFlagData), 'With flag should return array');
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid work item IDs gracefully', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/workitems/999999/children?release=25R3'
      });

      // Should either return empty array or proper error response
      assert.ok([200, 404, 500].includes(response.statusCode), 'Should return valid status code');
      
      if (response.statusCode === 200) {
        const data = JSON.parse(response.payload);
        assert.ok(Array.isArray(data), 'Should return array on success');
      }
    });

    test('should handle missing release parameter', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/workitems/329168/children'
      });

      assert.ok([200, 400].includes(response.statusCode), 'Should handle missing release');
    });

    test('should handle malformed release parameter', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/workitems/329168/children?release=invalid-release'
      });

      assert.ok([200, 400].includes(response.statusCode), 'Should handle invalid release');
    });
  });

  describe('Regression Tests', () => {
    test('should not break existing Epic 326423 functionality', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/workitems/326423/children?release=25R3'
      });

      assert.strictEqual(response.statusCode, 200);
      
      const epics = JSON.parse(response.payload);
      assert.ok(Array.isArray(epics), 'Should return array');
      assert.ok(epics.length > 0, 'Should have epics');

      // Each epic should have a valid progress value
      epics.forEach(epic => {
        assert.strictEqual(typeof epic.progress, 'number');
        assert.ok(epic.progress >= 0, 'Progress should be >= 0');
        assert.ok(epic.progress <= 100, 'Progress should be <= 100');
      });
    });

    test('should preserve all original work item properties', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/workitems/329168/children?release=25R3'
      });

      assert.strictEqual(response.statusCode, 200);
      
      const features = JSON.parse(response.payload);
      
      features.forEach(feature => {
        // Required properties should be preserved
        assert.ok(feature.id, 'Should have id');
        assert.ok(feature.title, 'Should have title');
        assert.ok(feature.workItemType, 'Should have workItemType');
        assert.ok(feature.state, 'Should have state');
        assert.strictEqual(typeof feature.progress, 'number', 'Progress should be number');
      });
    });
  });
});
