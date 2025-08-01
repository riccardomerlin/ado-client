import Fastify from 'fastify';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import createTasksFromTemplates from './apis/createTasksFromTemplates.js';
import getTemplates from './apis/getTemplates.js';
import getEpicsByRelease from './apis/getEpicsByRelease.js';
import getEpicProgressByRelease from './apis/getEpicProgressByRelease.js';
import { getChildrenWithBottomUpProgress, getChildrenWithBottomUpProgressUsingStrategy } from './utils/hierarchyProgressCalculator.js';
import config from './config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const fastify = Fastify({ logger: true });

// Debug: Log the paths being used
const publicPath = path.join(__dirname, 'public');
console.log('__dirname:', __dirname);
console.log('publicPath:', publicPath);
try {
  const files = fs.readdirSync(publicPath);
  console.log('Files in publicPath:', files);
} catch (e) {
  console.log('Directory not found:', e.message);
}

fastify.register(import('@fastify/static'), {
  root: publicPath,
  prefix: '/public/',
});

fastify.get('/', async (_, reply) => {
  return reply.sendFile('index.html');
});

// Health check endpoint for App Runner
fastify.get('/health', async (_, reply) => {
  return { status: 'healthy', timestamp: new Date().toISOString() };
});

fastify.get('/tasks', async (_, reply) => {
  return reply.sendFile('tasks.html');
});

fastify.get('/epics', async (_, reply) => {
  return reply.sendFile('epics.html');
});

fastify.get('/api/templates', async (_, reply) => {
  try {
    const templates = await getTemplates();
    reply.send(templates);
  } catch (error) {
    reply.status(500).send({ error: error.message });
  }
});

fastify.get('/api/config', async (_, reply) => {
  try {
    // Return only the necessary config data for the frontend
    const clientConfig = {
      orgUrl: config.orgUrl,
      projectName: config.projectName,
      defaultRelease: config.defaultRelease,
      defaultAreaPath: config.defaultAreaPath,
      defaultRelationshipStrategy: config.defaultRelationshipStrategy || 'hierarchy-only'
    };
    reply.send(clientConfig);
  } catch (error) {
    reply.status(500).send({ error: error.message });
  }
});

fastify.post('/api/create-tasks', async (request, reply) => {
  const { pbiId, templateIds } = request.body;
  try {
    const result = await createTasksFromTemplates(pbiId, templateIds);
    reply.send(result);
  } catch (error) {
    reply.status(500).send({ error: error.message });
  }
});

fastify.get('/api/epics', async (request, reply) => {
  const { release, areaPath } = request.query;
  try {
    const epics = await getEpicsByRelease(release, areaPath);
    reply.send(epics);
  } catch (error) {
    reply.status(500).send({ error: error.message });
  }
});

fastify.get('/api/epics/:id/progress', async (request, reply) => {
  const { id } = request.params;
  const { release, includeAllReleases, relationshipStrategy } = request.query;
  
  try {
    const includeAll = includeAllReleases === 'true';
    const strategy = relationshipStrategy || config.defaultRelationshipStrategy || 'hierarchy-only';
    
    // Use strategy-based approach if a specific strategy is requested
    let childrenWithProgress;
    if (strategy !== 'hierarchy-only') {
      childrenWithProgress = await getChildrenWithBottomUpProgressUsingStrategy(id, release, includeAll, strategy);
    } else {
      // Use original approach for backward compatibility
      const progressData = await getEpicProgressByRelease(id, release, includeAll);
      reply.send(progressData);
      return;
    }
    
    // Calculate Epic progress using the same logic as the original endpoint
    if (childrenWithProgress.length === 0) {
      reply.send({
        epicProgress: 0,
        children: [],
        calculationMethod: 'no-children'
      });
      return;
    }

    const totalProgress = childrenWithProgress.reduce((sum, child) => sum + (child.progress || 0), 0);
    const epicProgress = Math.round(totalProgress / childrenWithProgress.length);
    
    reply.send({
      epicProgress,
      children: childrenWithProgress,
      calculationMethod: release ? 'release-filtered-bottom-up-with-strategy' : 'all-children-bottom-up-with-strategy',
      childCount: childrenWithProgress.length,
      totalProgress,
      releaseValue: release,
      relationshipStrategy: strategy
    });
  } catch (error) {
    reply.status(500).send({ error: error.message });
  }
});

fastify.get('/api/workitems/:id/children', async (request, reply) => {
  const { id } = request.params;
  const { release, includeAllReleases, relationshipStrategy, isNestedExpansion } = request.query;
  
  try {
    // Use the new bottom-up approach for accurate progress calculation
    const includeAll = includeAllReleases === 'true';
    const isNested = isNestedExpansion === 'true';
      // If this is a nested expansion from the UI, force hierarchy-only behavior
    // regardless of the relationship strategy setting
    const effectiveStrategy = isNested ? 'hierarchy-only' : (relationshipStrategy || config.defaultRelationshipStrategy || 'hierarchy-only');
    
    // Use strategy-based approach if a specific strategy is requested
    let childrenWithProgress;
    if (effectiveStrategy !== 'hierarchy-only') {
      childrenWithProgress = await getChildrenWithBottomUpProgressUsingStrategy(id, release, includeAll, effectiveStrategy);
    } else {
      // Use original approach for backward compatibility
      childrenWithProgress = await getChildrenWithBottomUpProgress(id, release, includeAll);
    }
    
    reply.send(childrenWithProgress);
  } catch (error) {
    reply.status(500).send({ error: error.message });
  }
});

const start = async () => {
  try {
    const port = process.env.PORT || config.port || 7010;
    await fastify.listen({ port: port, host: '0.0.0.0' });
    fastify.log.info(`Server listening on port ${port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();