export function getDefaultPagePhotoCounts(totalPhotos: number): number[] {
  if (totalPhotos <= 0) {
    return [0];
  }
  if (totalPhotos === 1) {
    return [1];
  }
  if (totalPhotos === 2) {
    return [2];
  }

  const counts = [1, 2];
  let remaining = totalPhotos - 3;
  while (remaining > 0) {
    const nextCount = Math.min(4, remaining);
    counts.push(nextCount);
    remaining -= nextCount;
  }
  return counts;
}

export function splitPhotoIdsForDefaultPages(photoIds: string[]): string[][] {
  const counts = getDefaultPagePhotoCounts(photoIds.length);
  const pages: string[][] = [];
  let cursor = 0;
  for (const count of counts) {
    pages.push(photoIds.slice(cursor, cursor + count));
    cursor += count;
  }
  return pages;
}
