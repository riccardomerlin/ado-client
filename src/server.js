import Fastify from 'fastify';
import path from 'path';
import { fileURLToPath } from 'url';
import createTasksFromTemplates from './apis/createTasksFromTemplates.js';
import getTemplates from './apis/getTemplates.js';
import getEpicsByRelease from './apis/getEpicsByRelease.js';
import getWorkItemChildren from './apis/getWorkItemChildren.js';
import getWorkItemChildrenByRelease from './apis/getWorkItemChildrenByRelease.js';
import getEpicProgressByRelease from './apis/getEpicProgressByRelease.js';
import { calculateProgress, calculateItemProgress } from './utils/progressCalculator.js';
import { promises as fs } from 'fs';

const configPath = path.resolve('config.json');
const config = JSON.parse(await fs.readFile(configPath, 'utf-8'));

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const fastify = Fastify({ logger: true });

fastify.register(import('@fastify/static'), {
  root: path.join(__dirname, 'public'),
  prefix: '/public/',
});

fastify.get('/', async (_, reply) => {
  return reply.sendFile('index.html');
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
      defaultAreaPath: config.defaultAreaPath
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
  const { release } = request.query;
  
  try {
    const progressData = await getEpicProgressByRelease(id, release);
    reply.send(progressData);
  } catch (error) {
    reply.status(500).send({ error: error.message });
  }
});

fastify.get('/api/workitems/:id/children', async (request, reply) => {
  const { id } = request.params;
  const { release } = request.query;
  
  try {
    let children;
    
    if (release) {
      // Use release-filtered API when release is provided
      children = await getWorkItemChildrenByRelease(id, release);
    } else {
      // Fallback to unfiltered API for backward compatibility
      children = await getWorkItemChildren(id);
    }
    
    // Calculate progress for each child
    const childrenWithProgress = await Promise.all(children.map(async (child) => {
      let grandChildren;
      
      if (release) {
        grandChildren = await getWorkItemChildrenByRelease(child.id, release);
      } else {
        grandChildren = await getWorkItemChildren(child.id);
      }
      
      // Recursively calculate progress for grandchildren first
      let processedGrandChildren = [];
      if (grandChildren.length > 0) {
        processedGrandChildren = await Promise.all(grandChildren.map(async (grandChild) => {
          let greatGrandChildren;
          
          if (release) {
            greatGrandChildren = await getWorkItemChildrenByRelease(grandChild.id, release);
          } else {
            greatGrandChildren = await getWorkItemChildren(grandChild.id);
          }
          
          const grandChildProgress = calculateItemProgress(grandChild, greatGrandChildren);
          return {
            ...grandChild,
            progress: grandChildProgress,
            hasChildren: greatGrandChildren.length > 0
          };
        }));
      }
      
      const progress = calculateItemProgress(child, processedGrandChildren);
      
      return {
        ...child,
        progress,
        hasChildren: grandChildren.length > 0
      };
    }));
    
    reply.send(childrenWithProgress);
  } catch (error) {
    reply.status(500).send({ error: error.message });
  }
});

const start = async () => {
  try {
    const port = config.port || 7010;
    await fastify.listen({ port: port });
    fastify.log.info(`Server listening on http://localhost:${port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();