import fetch from 'node-fetch';
import config from '../config.js';

const { orgUrl, projectName, apiVersion } = config;
const pat = process.env.ADO_CLIENT_PAT;

export default async function getWorkItemChildren(workItemId) {
  if (!workItemId) {
    throw new Error('Work item ID is required');
  }

  // Get the work item with its relations
  const url = `${orgUrl}/${projectName}/_apis/wit/workitems/${workItemId}?$expand=Relations&api-version=${apiVersion}`;
  
  const response = await fetch(url, {
    headers: {
      'Authorization': `Basic ${Buffer.from(':' + pat).toString('base64')}`
    }
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Failed to fetch work item: ${response.status} ${response.statusText} - ${JSON.stringify(error)}`);
  }

  const workItem = await response.json();
  
  // Filter for child relations
  const childRelations = workItem.relations?.filter(relation => 
    relation.rel === 'System.LinkTypes.Hierarchy-Forward'
  ) || [];

  if (childRelations.length === 0) {
    return [];
  }

  // Extract child IDs from the URLs
  const childIds = childRelations.map(relation => {
    const urlParts = relation.url.split('/');
    return urlParts[urlParts.length - 1];
  });

  // Get detailed information for child work items
  const childDetailsUrl = `${orgUrl}/${projectName}/_apis/wit/workitems?ids=${childIds.join(',')}&$expand=All&api-version=${apiVersion}`;
  
  const childDetailsResponse = await fetch(childDetailsUrl, {
    headers: {
      'Authorization': `Basic ${Buffer.from(':' + pat).toString('base64')}`
    }
  });

  if (!childDetailsResponse.ok) {
    const error = await childDetailsResponse.json();
    throw new Error(`Failed to fetch child details: ${childDetailsResponse.status} ${childDetailsResponse.statusText} - ${JSON.stringify(error)}`);
  }
  const childDetailsResult = await childDetailsResponse.json();
    // Filter out removed items and Test Cases
  const activeChildren = childDetailsResult.value.filter(child => {
    const state = child.fields['System.State'];
    const workItemType = child.fields['System.WorkItemType'];
    
    // Exclude removed items
    if (state === 'Removed') {
      return false;
    }
    
    // Exclude Test Cases
    if (workItemType === 'Test Case') {
      return false;
    }
    
    return true;
  });
  
  return activeChildren.map(child => ({
    id: child.id,
    title: child.fields['System.Title'],
    state: child.fields['System.State'],
    workItemType: child.fields['System.WorkItemType']
  }));
}
