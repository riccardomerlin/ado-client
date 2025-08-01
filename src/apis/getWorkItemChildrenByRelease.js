import fetch from 'node-fetch';
import config from '../config.js';

const { orgUrl, projectName, apiVersion, releaseFieldName } = config;
const pat = process.env.ADO_CLIENT_PAT;

export default async function getWorkItemChildrenByRelease(workItemId, releaseValue, includeAllReleases = false) {
  if (!workItemId) {
    throw new Error('Work item ID is required');
  }

  if (!releaseValue) {
    throw new Error('Release value is required');
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
  const childDetailsResult = await childDetailsResponse.json();  // Filter children by release (except for Tasks which don't have Release field) and exclude removed items and Test Cases
  const filteredChildren = childDetailsResult.value.filter(child => {
    const workItemType = child.fields['System.WorkItemType'];
    const releaseField = child.fields[releaseFieldName];
    const state = child.fields['System.State'];
    
    // Exclude removed items
    if (state === 'Removed') {
      return false;
    }
    
    // Exclude Test Cases
    if (workItemType === 'Test Case') {
      return false;
    }
    
    // Tasks don't have Release field, so always include them (if not removed)
    if (workItemType === 'Task') {
      return true;
    }
    
    // If includeAllReleases is true, include all non-removed items regardless of release
    if (includeAllReleases) {
      return true;
    }
    
    // For Epics, Features, and PBIs, filter by Release when includeAllReleases is false
    return releaseField === releaseValue;
  });
  
  return filteredChildren.map(child => ({
    id: child.id,
    title: child.fields['System.Title'],
    state: child.fields['System.State'],
    workItemType: child.fields['System.WorkItemType'],
    release: child.fields[releaseFieldName] || 'No Release'
  }));
}
