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
    
    const name = match[1] ? match[1].trim() : match[0].split('@')[1];
    const email = match[2].trim();

    return { name, email };
  }
  return null;
}

export function mergeEmailsByNameOrEmail(data: Record<string, string>[]): {names: string[], emails: string[]}[] {
  const map = new Map();

  data.forEach(({ name, email }) => {
    if (map.has(name)) {
      map.get(name).emails.add(email);
    } else if (map.has(email)) {
      map.get(email).names.add(name);
    } else {
      const entry = { names: new Set([name]), emails: new Set([email]) };
      map.set(name, entry);
      map.set(email, entry);
    }
  });

  const result = [];
  const seen = new Set();

  map.forEach((value, key) => {
    // console.log('value', value)
    // console.log('key', key)
    if (!seen.has(value)) {
      result.push({
        names: Array.from(value.names).filter(Boolean),
        emails: Array.from(value.emails)
      });
      seen.add(value);
    }
  });

  return result;
}
