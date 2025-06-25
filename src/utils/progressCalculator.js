export function calculateProgress(children) {
  if (!children || children.length === 0) {
    return 0;
  }

  // For leaf nodes (items with no children), progress is based on state
  const leafProgress = children.map(child => {
    if (!child.hasChildren) {
      return child.state === 'Done' ? 100 : 0;
    }
    // For items with children, use their calculated progress
    return child.progress || 0;
  });

  const totalProgress = leafProgress.reduce((sum, progress) => sum + progress, 0);
  return Math.round(totalProgress / children.length);
}

export function calculateItemProgress(item, children) {
  if (!children || children.length === 0) {
    // Leaf item - progress based on its own state
    return item.state === 'Done' ? 100 : 0;
  }

  // Parent item - progress based on children's progress
  return calculateProgress(children);
}
