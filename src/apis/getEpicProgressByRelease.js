// New API endpoint to calculate Epic progress with release filtering
import getWorkItemChildrenByRelease from './getWorkItemChildrenByRelease.js';
import getWorkItemChildren from './getWorkItemChildren.js';
import { calculateItemProgress } from '../utils/progressCalculator.js';

export default async function getEpicProgressByRelease(epicId, releaseValue, includeAllReleases = false) {
  if (!epicId) {
    throw new Error('Epic ID is required');
  }

  try {
    let children;
    
    if (releaseValue) {
      // Use release-filtered API when release is provided
      children = await getWorkItemChildrenByRelease(epicId, releaseValue, includeAllReleases);
    } else {
      // Fallback to unfiltered API
      children = await getWorkItemChildren(epicId);
    }
    
    // Calculate progress for each child recursively with release filtering
    const childrenWithProgress = await Promise.all(children.map(async (child) => {
      let grandChildren;
        if (releaseValue) {
        grandChildren = await getWorkItemChildrenByRelease(child.id, releaseValue, includeAllReleases);
      } else {
        grandChildren = await getWorkItemChildren(child.id);
      }
      
      // Recursively calculate progress for grandchildren
      let processedGrandChildren = [];
      if (grandChildren.length > 0) {
        processedGrandChildren = await Promise.all(grandChildren.map(async (grandChild) => {
          let greatGrandChildren;
            if (releaseValue) {
            greatGrandChildren = await getWorkItemChildrenByRelease(grandChild.id, releaseValue, includeAllReleases);
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
    
    // Calculate Epic progress using the same logic as frontend
    if (childrenWithProgress.length === 0) {
      return {
        epicProgress: 0,
        children: [],
        calculationMethod: 'no-children'
      };
    }
    
    const totalProgress = childrenWithProgress.reduce((sum, child) => sum + (child.progress || 0), 0);
    const epicProgress = Math.round(totalProgress / childrenWithProgress.length);
    
    return {
      epicProgress,
      children: childrenWithProgress,
      calculationMethod: releaseValue ? 'release-filtered' : 'all-children',
      childCount: childrenWithProgress.length,
      totalProgress,
      releaseValue
    };
    
  } catch (error) {
    throw new Error(`Failed to calculate epic progress: ${error.message}`);
  }
}
