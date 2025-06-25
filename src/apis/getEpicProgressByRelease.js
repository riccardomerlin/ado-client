// New API endpoint to calculate Epic progress with release filtering
import { getChildrenWithBottomUpProgress } from '../utils/hierarchyProgressCalculator.js';

export default async function getEpicProgressByRelease(epicId, releaseValue, includeAllReleases = false) {
  if (!epicId) {
    throw new Error('Epic ID is required');
  }

  try {
    // Use the new bottom-up hierarchy calculator for accurate progress calculation
    const childrenWithProgress = await getChildrenWithBottomUpProgress(epicId, releaseValue, includeAllReleases);
    
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
      calculationMethod: releaseValue ? 'release-filtered-bottom-up' : 'all-children-bottom-up',
      childCount: childrenWithProgress.length,
      totalProgress,
      releaseValue
    };
    
  } catch (error) {
    throw new Error(`Failed to calculate epic progress: ${error.message}`);
  }
}
