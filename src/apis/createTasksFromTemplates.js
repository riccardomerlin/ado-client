import 'dotenv/config';
import createTaskFromTemplate from './createTaskFromTemplate.js';

export default async function createTasksFromTemplates(pbiId, templateIds) {
  const tasks = await Promise.all(templateIds.map(templateId => createTaskFromTemplate(templateId, pbiId)));
  return tasks;
}