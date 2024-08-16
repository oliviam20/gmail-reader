export function getBatches(data: string[], batchSize: number = 50) {
  const batches = [];
  const totalBatches = Math.ceil(data.length / batchSize);

  for (let i = 0; i < totalBatches; i++) {
    const start = i * batchSize;
    const end = (i + 1) * batchSize;
    const batch = data.slice(start, end);
    batches.push(batch);
  }

  return batches;
}

export function getMissingStrings(array1: string[], array2: string[]): string[] {
  return array1.filter(str => !array2.includes(str));
}

export function extractSenderInfo(input: string) {
  const regex = /^(?:"?([^"]*)"?\s)?<?([^<>]+)>?$/;
  const match = input.match(regex);
  if (match) {
    const name = match[1] ? match[1].trim() : null;
    const email = match[2].trim();
    return { name, email };
  }
  return null;
} 