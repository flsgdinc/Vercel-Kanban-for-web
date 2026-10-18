export function insertIndexAfterRemoval(allIds, draggedId, beforeId) {
  const idsAfterRemoval = allIds.filter((id) => id !== draggedId);
  if (beforeId == null) return idsAfterRemoval.length;

  const targetIndex = idsAfterRemoval.indexOf(beforeId);
  return targetIndex === -1 ? idsAfterRemoval.length : targetIndex;
}