import fetch from 'node-fetch';
import 'dotenv/config';
import { promises as fs } from 'fs';
import path from 'path';

const configPath = path.resolve('config.json');
const config = JSON.parse(await fs.readFile(configPath, 'utf-8'));

const { orgUrl, projectName, apiVersion, releaseFieldName } = config;
const pat = process.env.ADO_CLIENT_PAT;

/**
 * Gets work item children including both direct hierarchy children and related items with release filtering
 * @param {string} workItemId - The parent work item ID
 * @param {string} releaseValue - Release filter value
 * @param {boolean} includeAllReleases - Include all releases flag
 * @returns {Promise<Array>} Array of child and related work items
 */
export default async function getWorkItemChildrenWithRelatedByRelease(workItemId, releaseValue, includeAllReleases = false) {
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
  
  // Filter for both child relations and related relations
  const relevantRelations = workItem.relations?.filter(relation => 
    relation.rel === 'System.LinkTypes.Hierarchy-Forward' || // Direct children
    relation.rel === 'System.LinkTypes.Related'              // Related items
  ) || [];

  if (relevantRelations.length === 0) {
    return [];
  }
  // Extract IDs from the URLs and create a mapping of ID to relationship type
  const relatedIds = relevantRelations.map(relation => {
    const urlParts = relation.url.split('/');
    return urlParts[urlParts.length - 1];
  });

  // Create mapping from work item ID to relationship type
  const relationshipMap = new Map();
  relevantRelations.forEach(relation => {
    const urlParts = relation.url.split('/');
    const id = urlParts[urlParts.length - 1];
    const isRelatedItem = relation.rel === 'System.LinkTypes.Related';
    relationshipMap.set(id, isRelatedItem ? 'related' : 'hierarchy');
  });

  // Get detailed information for related work items
  const childDetailsUrl = `${orgUrl}/${projectName}/_apis/wit/workitems?ids=${relatedIds.join(',')}&$expand=All&api-version=${apiVersion}`;
  
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

  // Filter children by release (except for Tasks which don't have Release field) and exclude removed items and Test Cases
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
    release: child.fields[releaseFieldName] || 'No Release',
    relationshipType: relationshipMap.get(child.id.toString()) || 'hierarchy'
  }));
}
