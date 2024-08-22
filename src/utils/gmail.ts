/* eslint-disable @typescript-eslint/no-explicit-any */
import axios from 'axios';
import { getBatches, getMissingStrings } from './index';
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

export async function getBatchGmailMessages(pool: WorkerPool, accessToken: string, strings: string[]) {
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

export async function getGmailMessageList(accessToken: string, year: number, pageToken?: string) {
  try {
    // scope is readonly
    // filter with q, https://support.google.com/mail/answer/7190?hl=en
    // All dates used in the search query are interpreted as midnight on that date in the PST timezone. To specify accurate dates for other timezones pass the value in seconds instead (epoch)
    const messageResponse = await axios.get('https://www.googleapis.com/gmail/v1/users/me/messages', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      params: {
        // q: 'subject:welcome after:2023/08/12'
        // q: 'subject:welcome'
        // q: 'subject:(introducing%20welcome)'
        // q: '{subject:welcome subject:introducing subject:order subject:receipt subject:invoice subject:tracking subject:purchase} AND -olivia.t.mo@outlook.com AND -l.jonathan.mo@gmail.com AND before:2024/08/01 AND after:2023/08/01',
        q: `{subject:welcome subject:introducing subject:order subject:receipt subject:invoice subject:tracking subject:purchase label:spam} AND -olivia.t.mo@outlook.com AND -l.jonathan.mo@gmail.com AND before:${year + 1}/01/01 after:${year}/01/01`,
        ...(pageToken ? { pageToken } : {})
      }
    });

    const nextPageToken: string | undefined = messageResponse.data.nextPageToken;
    const messages: {
      threadId: string;
      id: string;
    }[] = messageResponse.data.messages;

    return { nextPageToken, messages };
  } catch (error) {
    console.error('Error fetching gmail messages list', error);
    throw new Error('Error fetching gmail messages list');
  }
}

export async function fetchGmailMessages(accessToken: string, pool: WorkerPool, messageIds: string[]): Promise<EmailData[] | undefined> {
  try {
    if (messageIds.length) {
      // get gmail messages in batches
      // const messageIds = messages.map(message => message.id);
      const getStrings = getBatchMessageBodyStrings(messageIds);
      const batches = getBatches(getStrings, 10);
      const formattedGetStringsBatches = batches.map(batch => batch.join('\n\n').concat('\n--batch--'));
      const results = await getBatchGmailMessages(pool, accessToken, formattedGetStringsBatches);

      // get list of ids from results and failed ids
      const parsedResultsWithoutErrors = results.filter(result => result.id);
      const idsFromParsedResultsWithoutErrors = parsedResultsWithoutErrors.map(result => result.id);
      const missingIds = getMissingStrings(messageIds, idsFromParsedResultsWithoutErrors);

      let retryResults: EmailData[] | undefined = [];
      console.log('aaaaa missig', missingIds)
      if (missingIds.length) {
        retryResults = await fetchGmailMessages(accessToken, pool, missingIds)
      }

      return [...parsedResultsWithoutErrors, ...(retryResults ? retryResults : [])];
    }
  } catch (error) {
    console.error('Error fetching emails', error);
    throw new Error('Error fetching emails');
  }
}
