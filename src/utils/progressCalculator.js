
/**
 * Maps work item states to progress percentages
 * Business rule: Only "Done" states count as completed
 */
function getStateProgress(state) {
  // Only completed states count as 100%, everything else is 0%
  const completedStates = ['Done', 'Closed', 'Completed'];
  return completedStates.includes(state) ? 100 : 0;
}

export function calculateProgress(children) {
  if (!children || children.length === 0) {
    return 0;
  }

  // Calculate progress for each child
  const childProgress = children.map(child => {
    if (child.hasChildren === false || (!child.hasChildren && (child.progress === undefined || child.progress === null))) {
      // Leaf node - use state-based progress
      return getStateProgress(child.state);
    }
    // For items with children, use their calculated progress
    return child.progress ?? 0;
  });

  const totalProgress = childProgress.reduce((sum, progress) => sum + progress, 0);
  return Math.round(totalProgress / children.length);
}

export function calculateItemProgress(item, children) {
  if (!children || children.length === 0) {
    // Leaf item - progress based on its own state
    return getStateProgress(item.state);
  }

  // Parent item - progress based on children's progress
  return calculateProgress(children);
}
