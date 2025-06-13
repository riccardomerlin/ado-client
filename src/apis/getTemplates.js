import fetch from 'node-fetch';
import 'dotenv/config';
import createTaskFromTemplate from './createTaskFromTemplate.js';
import { promises as fs } from 'fs';
import path from 'path';

const configPath = path.resolve('config.json');
const config = JSON.parse(await fs.readFile(configPath, 'utf-8'));

const { orgUrl, projectName, teamId, apiVersion } = config;
const pat = process.env.ADO_CLIENT_PAT;

export default async function getTemplates() {
  const url = `${orgUrl}/${projectName}/${teamId}/_apis/wit/templates?api-version=${apiVersion}`;
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Basic ${Buffer.from(':' + pat).toString('base64')}`
    }
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Failed to fetch templates: ${response.status} ${response.statusText} - ${JSON.stringify(error)}`);
  }

  const result = await response.json();
  // Filter and sort templates by title alphabetically
  const taskTemplates = result.value
    .filter(template => template.workItemTypeName === 'Task')
    .sort((a, b) => a.name.localeCompare(b.name));
  return taskTemplates;
}