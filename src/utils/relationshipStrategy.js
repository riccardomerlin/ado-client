import getWorkItemChildren from '../apis/getWorkItemChildren.js';
import getWorkItemChildrenByRelease from '../apis/getWorkItemChildrenByRelease.js';
import getWorkItemChildrenWithRelated from '../apis/getWorkItemChildrenWithRelated.js';
import getWorkItemChildrenWithRelatedByRelease from '../apis/getWorkItemChildrenWithRelatedByRelease.js';

/**
 * Strategy pattern for loading work item relationships
 * Allows easy switching between different relationship loading approaches
 */

/**
 * Strategy for loading only direct hierarchy children (current behavior)
 */
export class HierarchyOnlyStrategy {
  async loadChildren(workItemId, release, includeAllReleases) {
    if (release) {
      return await getWorkItemChildrenByRelease(workItemId, release, includeAllReleases);
    } else {
      return await getWorkItemChildren(workItemId);
    }
  }
  
  getName() {
    return 'hierarchy-only';
  }
}

/**
 * Strategy for loading both hierarchy children and related items
 */
export class HierarchyWithRelatedStrategy {
  async loadChildren(workItemId, release, includeAllReleases) {
    if (release) {
      return await getWorkItemChildrenWithRelatedByRelease(workItemId, release, includeAllReleases);
    } else {
      return await getWorkItemChildrenWithRelated(workItemId);
    }
  }
  
  getName() {
    return 'hierarchy-with-related';
  }
}

/**
 * Factory for creating relationship loading strategies
 */
export class RelationshipStrategyFactory {
  static create(strategyType = 'hierarchy-only') {
    switch (strategyType) {
      case 'hierarchy-only':
        return new HierarchyOnlyStrategy();
      case 'hierarchy-with-related':
        return new HierarchyWithRelatedStrategy();
      default:
        throw new Error(`Unknown strategy type: ${strategyType}`);
    }
  }
  
  static getAvailableStrategies() {
    return ['hierarchy-only', 'hierarchy-with-related'];
  }
}
