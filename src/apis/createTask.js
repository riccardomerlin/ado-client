import fetch from 'node-fetch';
import config from '../config.js';

const { orgUrl, projectName, apiVersion } = config;
const pat = process.env.ADO_CLIENT_PAT;

export default async function createTask(title, parentId, description, assignedTo) {
  if (!title) {
    throw new Error('Missing required parameters. Usage: createTask <title> <description> <assignedTo> <parentId> <areaPath> <iterationPath>');
  }

  const url = `${orgUrl}/${projectName}/_apis/wit/workitems/$Task?api-version=${apiVersion}`;

  const body = [
    {
      op: 'add',
      path: '/fields/System.Title',
      from: null,
      value: title
    }
  ];

  if(description && description.trim().length > 0) {
    body.push(
        {
            op: 'add',
            path: '/fields/System.Description',
            from: null,
            value: description
          }
    );
  }  

  if(assignedTo) {
    body.push(
        {
            op: 'add',
            path: '/fields/System.AssignedTo',
            from: null,
            value: assignedTo
          }
    );
  }

  if (parentId) {
    body.push(
        {
            op: 'add',
            path: '/relations/-',
            from: null,
            value: {
                rel: 'System.LinkTypes.Hierarchy-Reverse',
                url: `${orgUrl}/_apis/wit/workItems/${parentId}`,
                attributes: {
                    comment: 'add parent'
                }
            }
        });
  }

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
    throw new Error(`Failed to create Task: ${response.status} ${response.statusText} - ${JSON.stringify(error)}`);
  }

  const result = await response.json();
  return result;
}
