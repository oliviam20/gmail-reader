/* eslint-disable @typescript-eslint/no-explicit-any */
import axios from 'axios';
import type { WorkerPool } from './worker-pool';

interface EmailData {
  historyId: string;
  id: string;
  internalDate: string;
  labelIds: string[];
  payload: {
    body: {
      size: number
    },
    filename: string;
    headers: Record<string, string>[];
    mimeType: string;
    partId: string;
    parts: Record<string, any>[];
  };
  sizeEstimate: number;
  snippet: string;
  threadId: string;
}

export function multipartMixedGmailParse(data: string) {
  const separator = data.trim().split('\n')[0].trim()
  const parts = data.split(separator).map(part => part.trim()).filter(part => part !== '' && part !== '--')
   return parts.map(part => 
    {
      const split = part.split('\n')
      const index = split.findIndex(str => str === '{')
      const arr = split.slice(index).join('')
      return JSON.parse(arr)
    })
}

export function getBatchMessageBodyStrings(ids: string[]): string[] {
  return ids.map(id => `--batch\nContent-Type: application/http\n\nGET /gmail/v1/users/me/messages/${id}`);
}

export async function getBatchMessages(pool: WorkerPool, accessToken: string, strings: string[]) {
  // internalDate is more reliable than the 'date' in the headers
  const results = await Promise.all(strings.map(string => pool.execute(() => axios.request({
    method: 'post',
    maxBodyLength: Infinity,
    url: 'https://www.googleapis.com/batch/gmail/v1',
    headers: { 
      'Content-Type': 'multipart/mixed; boundary=batch', 
      'Authorization': `Bearer ${accessToken}`
    },
    params: {
      format: 'full'
    },
    data: string
  }))))
  const parsedResults: EmailData[] = results.flatMap(result => multipartMixedGmailParse(result.data));
  return parsedResults;
}