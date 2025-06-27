// Bottom-up hierarchy progress calculator
// Solves the fundamental problem where progress depends on children but we process parents first

import getWorkItemChildren from '../apis/getWorkItemChildren.js';
import getWorkItemChildrenByRelease from '../apis/getWorkItemChildrenByRelease.js';
import { calculateItemProgress } from './progressCalculator.js';
import { RelationshipStrategyFactory } from './relationshipStrategy.js';

/**
 * Loads complete work item hierarchy and calculates progress bottom-up
 * @param {string} parentId - The parent work item ID
 * @param {string} release - Release filter (optional)
 * @param {boolean} includeAllReleases - Include all releases flag
 * @returns {Promise<Array>} Children with accurately calculated progress
 */
export async function getChildrenWithBottomUpProgress(parentId, release, includeAllReleases = false) {
  // Phase 1: Load complete hierarchy (all levels)
  const hierarchy = await loadCompleteHierarchy(parentId, release, includeAllReleases);
  
  // Phase 2: Calculate progress bottom-up (leaves to root)
  const withProgress = calculateProgressBottomUp(hierarchy);
  
  return withProgress;
}

/**
 * Loads complete work item hierarchy and calculates progress bottom-up with configurable relationship strategy
 * @param {string} parentId - The parent work item ID
 * @param {string} release - Release filter (optional)
 * @param {boolean} includeAllReleases - Include all releases flag
 * @param {string} relationshipStrategy - Strategy for loading relationships ('hierarchy-only' | 'hierarchy-with-related')
 *                                        Note: Strategy only applies to first level; deeper levels always use hierarchy-only
 * @returns {Promise<Array>} Children with accurately calculated progress
 */
export async function getChildrenWithBottomUpProgressUsingStrategy(parentId, release, includeAllReleases = false, relationshipStrategy = 'hierarchy-only') {
  // Create the appropriate strategy
  const strategy = RelationshipStrategyFactory.create(relationshipStrategy);
  
  // Phase 1: Load complete hierarchy (all levels) using the strategy
  const hierarchy = await loadCompleteHierarchyWithStrategy(parentId, release, includeAllReleases, strategy);
  
  // Phase 2: Calculate progress bottom-up (leaves to root)
  const withProgress = calculateProgressBottomUp(hierarchy);
  
  return withProgress;
}

/**
 * Recursively loads the complete hierarchy for a work item
 * @param {string} workItemId - Work item ID to load hierarchy for
 * @param {string} release - Release filter
 * @param {boolean} includeAllReleases - Include all releases flag
 * @param {number} depth - Current depth (for preventing infinite loops)
 * @returns {Promise<Object>} Complete hierarchy with all descendants
 */
async function loadCompleteHierarchy(workItemId, release, includeAllReleases, depth = 0) {
  // Prevent infinite recursion (max 10 levels deep)
  if (depth > 10) {
    return [];
  }
  
  // Load direct children
  let children;
  if (release) {
    children = await getWorkItemChildrenByRelease(workItemId, release, includeAllReleases);
  } else {
    children = await getWorkItemChildren(workItemId);
  }
  
  // Recursively load complete hierarchy for each child
  const childrenWithHierarchy = await Promise.all(
    children.map(async (child) => {
      const descendants = await loadCompleteHierarchy(child.id, release, includeAllReleases, depth + 1);
      return {
        ...child,
        children: descendants,
        depth: depth + 1
      };
    })
  );
    return childrenWithHierarchy;
}

/**
 * Recursively loads the complete hierarchy for a work item using a relationship strategy
 * @param {string} workItemId - Work item ID to load hierarchy for
 * @param {string} release - Release filter
 * @param {boolean} includeAllReleases - Include all releases flag
 * @param {Object} strategy - Relationship loading strategy
 * @param {number} depth - Current depth (for preventing infinite loops)
 * @returns {Promise<Object>} Complete hierarchy with all descendants
 */
async function loadCompleteHierarchyWithStrategy(workItemId, release, includeAllReleases, strategy, depth = 0) {
  // Prevent infinite recursion (max 10 levels deep)
  if (depth > 10) {
    return [];
  }
  
  // Use the provided strategy only for the first level (depth 0)
  // For deeper levels (depth > 0), always use hierarchy-only strategy
  let children;
  if (depth === 0) {
    // First level: use the requested strategy (may include Related items)
    children = await strategy.loadChildren(workItemId, release, includeAllReleases);
  } else {
    // Deeper levels: always use hierarchy-only strategy
    if (release) {
      children = await getWorkItemChildrenByRelease(workItemId, release, includeAllReleases);
    } else {
      children = await getWorkItemChildren(workItemId);
    }
  }
  
  // Recursively load complete hierarchy for each child using hierarchy-only for deeper levels
  const childrenWithHierarchy = await Promise.all(
    children.map(async (child) => {
      const descendants = await loadCompleteHierarchyWithStrategy(child.id, release, includeAllReleases, strategy, depth + 1);
      return {
        ...child,
        children: descendants,
        depth: depth + 1
      };
    })
  );
  
  return childrenWithHierarchy;
}

/**
 * Calculates progress bottom-up from leaves to root
 * @param {Array} hierarchy - Complete hierarchy with all descendants
 * @returns {Array} Hierarchy with progress calculated for all items
 */
function calculateProgressBottomUp(hierarchy) {
  // Process each item in the hierarchy
  function processItem(item) {
    // First, recursively process all children (go deeper first)
    if (item.children && item.children.length > 0) {
      item.children = item.children.map(processItem);
      
      // Now calculate this item's progress based on processed children
      item.progress = calculateItemProgress(item, item.children);
      item.hasChildren = true;
    } else {
      // Leaf node - progress based on state
      item.progress = calculateItemProgress(item, []);
      item.hasChildren = false;
    }
    
    // Remove the children property for the final output (only needed for calculation)
    const { children, depth, ...itemWithoutChildren } = item;
    return {
      ...itemWithoutChildren,
      hasChildren: item.hasChildren
    };
  }
  
  return hierarchy.map(processItem);
}

/**
 * Alternative approach: Load hierarchy in batches for better performance
 * @param {string} parentId - Parent work item ID
 * @param {string} release - Release filter
 * @param {boolean} includeAllReleases - Include all releases flag
 * @returns {Promise<Array>} Children with progress calculated efficiently
 */
export async function getChildrenWithBatchedProgress(parentId, release, includeAllReleases = false) {
  // Load all items level by level
  const allItems = new Map(); // id -> item
  const relationships = new Map(); // parentId -> [childIds]
  
  // Level 1: Direct children
  let currentLevel = [parentId];
  let level = 0;
  
  while (currentLevel.length > 0 && level < 10) {
    const nextLevel = [];
    
    // Load children for all items at current level in parallel
    const childrenResults = await Promise.all(
      currentLevel.map(async (itemId) => {
        let children;
        if (release) {
          children = await getWorkItemChildrenByRelease(itemId, release, includeAllReleases);
        } else {
          children = await getWorkItemChildren(itemId);
        }
        return { parentId: itemId, children };
      })
    );
    
    // Process results
    for (const { parentId: itemId, children } of childrenResults) {
      relationships.set(itemId, children.map(c => c.id));
      
      for (const child of children) {
        allItems.set(child.id, { ...child, depth: level + 1 });
        nextLevel.push(child.id);
      }
    }
    
    currentLevel = nextLevel;
    level++;
  }
    // Calculate progress bottom-up
  return calculateProgressForBatchedItems(parentId, allItems, relationships);
}

/**
 * Alternative approach: Load hierarchy in batches for better performance with configurable relationship strategy
 * @param {string} parentId - Parent work item ID
 * @param {string} release - Release filter
 * @param {boolean} includeAllReleases - Include all releases flag
 * @param {string} relationshipStrategy - Strategy for loading relationships ('hierarchy-only' | 'hierarchy-with-related')
 *                                        Note: Strategy only applies to first level; deeper levels always use hierarchy-only
 * @returns {Promise<Array>} Children with progress calculated efficiently
 */
export async function getChildrenWithBatchedProgressUsingStrategy(parentId, release, includeAllReleases = false, relationshipStrategy = 'hierarchy-only') {
  // Create the appropriate strategy
  const strategy = RelationshipStrategyFactory.create(relationshipStrategy);
  
  // Load all items level by level
  const allItems = new Map(); // id -> item
  const relationships = new Map(); // parentId -> [childIds]
  
  // Level 1: Direct children
  let currentLevel = [parentId];
  let level = 0;
    while (currentLevel.length > 0 && level < 10) {
    const nextLevel = [];
    
    // Load children for all items at current level in parallel
    // Use strategy only for first level (level 0), hierarchy-only for deeper levels
    const childrenResults = await Promise.all(
      currentLevel.map(async (itemId) => {
        let children;
        if (level === 0) {
          // First level: use the requested strategy (may include Related items)
          children = await strategy.loadChildren(itemId, release, includeAllReleases);
        } else {
          // Deeper levels: always use hierarchy-only strategy
          if (release) {
            children = await getWorkItemChildrenByRelease(itemId, release, includeAllReleases);
          } else {
            children = await getWorkItemChildren(itemId);
          }
        }
        return { parentId: itemId, children };
      })
    );
    
    // Process results
    for (const { parentId: itemId, children } of childrenResults) {
      relationships.set(itemId, children.map(c => c.id));
      
      for (const child of children) {
        allItems.set(child.id, { ...child, depth: level + 1 });
        nextLevel.push(child.id);
      }
    }
    
    currentLevel = nextLevel;
    level++;
  }
  
  // Calculate progress bottom-up
  return calculateProgressForBatchedItems(parentId, allItems, relationships);
}

/**
 * Calculate progress for items loaded in batches
 */
function calculateProgressForBatchedItems(parentId, allItems, relationships) {
  const processedItems = new Map();
  
  function processItem(itemId) {
    if (processedItems.has(itemId)) {
      return processedItems.get(itemId);
    }
    
    const item = allItems.get(itemId);
    if (!item) return null;
    
    const childIds = relationships.get(itemId) || [];
    
    if (childIds.length === 0) {
      // Leaf node
      const processed = {
        ...item,
        progress: calculateItemProgress(item, []),
        hasChildren: false
      };
      processedItems.set(itemId, processed);
      return processed;
    } else {
      // Process children first
      const processedChildren = childIds
        .map(childId => processItem(childId))
        .filter(child => child !== null);
      
      const processed = {
        ...item,
        progress: calculateItemProgress(item, processedChildren),
        hasChildren: processedChildren.length > 0
      };
      processedItems.set(itemId, processed);
      return processed;
    }
  }
  
  // Get direct children of parent and process them
  const directChildIds = relationships.get(parentId) || [];
  return directChildIds
    .map(childId => processItem(childId))
    .filter(child => child !== null);
}
