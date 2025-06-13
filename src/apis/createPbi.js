import fetch from 'node-fetch';
import 'dotenv/config';
import { promises as fs } from 'fs';
import path from 'path';

const configPath = path.resolve('config.json');
const config = JSON.parse(await fs.readFile(configPath, 'utf-8'));

const { orgUrl, projectName, release, apiVersion } = config;
const pat = process.env.ADO_CLIENT_PAT;

export default async function createPBI(title, description, assignedTo, acceptanceCriteria, parentId, areaPath, iterationPath) {
  if (!title || !description || !assignedTo || !acceptanceCriteria || !parentId || !areaPath || !iterationPath) {
    throw new Error('Missing required parameters. Usage: createPBI <title> <description> <assignedTo> <acceptanceCriteria> <parentId> <areaPath> <iterationPath>');
  }

  const url = `${orgUrl}/${projectName}/_apis/wit/workitems/$Product Backlog Item?api-version=${apiVersion}`;

  const body = [
    {
      op: 'add',
      path: '/fields/System.Title',
      from: null,
      value: title
    },
    {
      op: 'add',
      path: '/fields/System.Description',
      from: null,
      value: description
    },
    {
      op: 'add',
      path: '/fields/System.AssignedTo',
      from: null,
      value: assignedTo
    },
    {
      op: 'add',
      path: '/fields/Microsoft.VSTS.Common.AcceptanceCriteria',
      from: null,
      value: acceptanceCriteria
    },
    {
      op: 'add',
      path: '/fields/Release',
      from: null,
      value: release
    },
    {
      op: 'add',
      path: '/fields/System.AreaPath',
      from: null,
      value: areaPath
    },
    {
      op: 'add',
      path: '/fields/System.IterationPath',
      from: null,
      value: iterationPath
    }
  ];

  const options = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json-patch+json',
      'Authorization': `Basic ${Buffer.from(':' + pat).toString('base64')}`
    }
  };

  const response = await fetch(url, {
    ...options,
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Failed to create PBI: ${response.status} ${response.statusText} - ${JSON.stringify(error)}`);
  }

  const result = await response.json();
  return result;
}
