import fetch from 'node-fetch';
import config from '../config.js';

const { orgUrl, projectName, apiVersion } = config;
const pat = process.env.ADO_CLIENT_PAT;

export default async function createPullRequest(sourceBranch, targetBranch, repositoryIdOrName, title, description) {
  if (!sourceBranch || !targetBranch || !title || !repositoryIdOrName) {
    throw new Error('Missing required parameters. Usage: createPullRequest <sourceBranch> <targetBranch> <repositoryIdOrName> <title> <description>');
  }

  const url = `${orgUrl}/${projectName}/_apis/git/repositories/${repositoryIdOrName}/pullrequests?api-version=${apiVersion}`;

  const body = {
    sourceRefName: `refs/heads/${sourceBranch}`,
    targetRefName: `refs/heads/${targetBranch}`,
    title: title,
    description: description || '',
    reviewers: [{ id: '0a9de26f-e52f-4330-906a-999c579c2ef4'}]
  };

  const options = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Basic ${Buffer.from(':' + pat).toString('base64')}`
    },
    body: JSON.stringify(body)
  };

  const response = await fetch(url, options);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Failed to create Pull Request: ${response.status} ${response.statusText} - ${JSON.stringify(error)}`);
  }

  const result = await response.json();
  return result;
}
