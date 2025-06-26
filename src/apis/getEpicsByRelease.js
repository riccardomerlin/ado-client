import fetch from 'node-fetch';
import 'dotenv/config';
import { promises as fs } from 'fs';
import path from 'path';

const configPath = path.resolve('config.json');
const config = JSON.parse(await fs.readFile(configPath, 'utf-8'));

const { orgUrl, projectName, apiVersion, releaseFieldName } = config;
const pat = process.env.ADO_CLIENT_PAT;

export default async function getEpicsByRelease(releaseValue, areaPath) {
  if (!releaseValue) {
    throw new Error('Release value is required');
  }
  
  if (!areaPath) {
    throw new Error('AreaPath value is required');
  }

  const wiql = `SELECT [System.Id], [System.Title], [System.State] FROM WorkItems WHERE [System.WorkItemType] = 'Epic' AND [${releaseFieldName}] = '${releaseValue}' AND [System.AreaPath] = '${areaPath}' AND [System.State] <> 'Removed' ORDER BY [System.Title]`;
  
  const url = `${orgUrl}/${projectName}/_apis/wit/wiql?api-version=${apiVersion}`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Basic ${Buffer.from(':' + pat).toString('base64')}`
    },
    body: JSON.stringify({ query: wiql })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Failed to fetch epics: ${response.status} ${response.statusText} - ${JSON.stringify(error)}`);
  }

  const result = await response.json();
  
  // If no work items found, return empty array
  if (!result.workItems || result.workItems.length === 0) {
    return [];
  }

  // Get detailed information for each work item
  const workItemIds = result.workItems.map(wi => wi.id);
  const detailsUrl = `${orgUrl}/${projectName}/_apis/wit/workitems?ids=${workItemIds.join(',')}&$expand=All&api-version=${apiVersion}`;
  
  const detailsResponse = await fetch(detailsUrl, {
    headers: {
      'Authorization': `Basic ${Buffer.from(':' + pat).toString('base64')}`
    }
  });

  if (!detailsResponse.ok) {
    const error = await detailsResponse.json();
    throw new Error(`Failed to fetch epic details: ${detailsResponse.status} ${detailsResponse.statusText} - ${JSON.stringify(error)}`);
  }
  const detailsResult = await detailsResponse.json();
  
  // Filter out epics that have parents (only show top-level epics)
  const topLevelEpics = detailsResult.value.filter(workItem => {
    // Check if this epic has a parent relationship
    const relations = workItem.relations || [];
    const hasParent = relations.some(relation => 
      relation.rel === 'System.LinkTypes.Hierarchy-Reverse' // This indicates a parent relationship
    );
    return !hasParent; // Only include epics without parents
  });
  
  return topLevelEpics.map(workItem => ({
    id: workItem.id,
    title: workItem.fields['System.Title'],
    state: workItem.fields['System.State'],
    workItemType: workItem.fields['System.WorkItemType']
  }));
}
