export function multipartMixedGmailParse(data: string) {
  const separator = data.trim().split('\n')[0].trim()
  const parts = data.split(separator).map(part => part.trim()).filter(part => part !== '' && part !== '--')
  // return parts.map(part => JSON.parse(part.split('\n')[3]))
   return parts.map(part => 
    {
      const split = part.split('\n')
      const index = split.findIndex(str => str === '{')
      const arr = split.slice(index).join('')
      return JSON.parse(arr)
    })
}

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