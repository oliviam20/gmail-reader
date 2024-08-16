/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from 'react';
import { useGoogleLogin } from '@react-oauth/google';
import axios from 'axios';
import { getBatches, getMissingStrings, extractSenderInfo } from './utils';
import { multipartMixedGmailParse, getBatchMessageBodyStrings, getBatchMessages } from './utils/gmail';
import { WorkerPool } from './utils/worker-pool'

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

function GoogleApp() {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [emails, setEmails] = useState<EmailData[]>([]);
  const [companies, setCompanies] = useState<Record<string, string>[]>([]);

  const login = useGoogleLogin({
    onSuccess: (response) => {
      console.log('Login Success:', response);
      setAccessToken(response.access_token);
    },
    onError: (error) => console.log('Login Failed:', error),
    // scope: 'https://www.googleapis.com/auth/gmail.metadata',
    scope: 'https://www.googleapis.com/auth/gmail.readonly',
    overrideScope: false
  });

  const fetchEmails = async () => {
    if (!accessToken) {
      console.error('Access token is not available.');
      return;
    }

    console.log('access token', accessToken)

    try {
      // scope is readonly
      // filter with q, https://support.google.com/mail/answer/7190?hl=en
      // time can be from epoch seconds
      const res = await axios.get('https://www.googleapis.com/gmail/v1/users/me/messages', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        params: {
          // q: 'subject:welcome after:2023/08/12'
          // q: 'subject:welcome'
          // q: 'subject:(introducing%20welcome)'
          q: '{subject:welcome subject:introducing subject:order}'
        }
      });


      console.log('message list data', res.data)
      const messages: {
        threadId: string;
        id: string;
      }[] = res.data.messages

      if (messages.length) {
        // batch get messages?
        const data: string = messages.map(message => `--batch\nContent-Type: application/http\n\nGET /gmail/v1/users/me/messages/${message.id}`).join('\n\n').concat('\n--batch--');

        const messageIds = messages.map(message => message.id);
        const getStrings = getBatchMessageBodyStrings(messageIds);
        const batches = getBatches(getStrings, 15);
        const formattedGetStringsBatches = batches.map(batch => batch.join('\n\n').concat('\n--batch--'))

        // console.log('formattedBatches', formattedBatches)
        // console.log('batches', batches)

        const batchConfig = {
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
          data
        };
        const pool = new WorkerPool(5, {
          retries: 2,
          timeout: 3000, // 3 seconds
        });

        const results = await Promise.all(formattedGetStringsBatches.map(string => pool.execute(() => axios.request({
          ...batchConfig,
          data: string
        }))))
        const parsedResults: EmailData[] = results.flatMap(result => multipartMixedGmailParse(result.data));
        const parsedResultsWithoutErrors = parsedResults.filter(result => result.id)
        const idsFromParsedResultsWithoutErrors = parsedResultsWithoutErrors.map(result => result.id ?? '')
        const idsFromMessagesList = messages.map(message => message.id)
        const missingIds = getMissingStrings(idsFromMessagesList, idsFromParsedResultsWithoutErrors)

        if (missingIds.length) {
          const missingIdsStrings = getBatchMessageBodyStrings(missingIds);
          const batches = getBatches(missingIdsStrings, 5);
          const formattedMissingBatches = batches.map(batch => batch.join('\n\n').concat('\n--batch--'));
          const missingResults = await getBatchMessages(pool, accessToken, formattedMissingBatches);
          console.log('missingResults', missingResults)
        }

        console.log('parsedResultsWithoutErrors', parsedResultsWithoutErrors)
        const emailContent = parsedResultsWithoutErrors

        const senders = parsedResultsWithoutErrors.map(result => result.payload.headers.find(header => header.name === 'From')?.value ?? '');
        const uniqueSet = new Set(senders);
        const uniqueArray = Array.from(uniqueSet);
        const companyNamesAndEmails = uniqueArray.map(sender => extractSenderInfo(sender) ?? {});
        setCompanies(companyNamesAndEmails)
        
        // const b = await axios.request(config)
        // console.log('1111', b.data)
        // const emailContent = multipartMixedGmailParse(b.data)
        // console.log('parsed response ', multipartMixedGmailParse(b.data))

        // When scope is readonly
        // https://developers.google.com/gmail/api/reference/rest/v1/users.messages
        // internalDate is more reliable than the 'date' in the headers
        // const emailContent = await Promise.all(messages.map(message => axios.get(`https://www.googleapis.com/gmail/v1/users/me/messages/${message.id}`, {
        //   headers: {
        //     Authorization: `Bearer ${accessToken}`,
        //   },
        //   params: {
        //     format: 'full'
        //   }
        // })))
        // if (emailContent.length) {
        //   console.log('emailContent', emailContent)
        //   const emailData: EmailData[] = emailContent.map(email => email.data)
        //   setEmails(emailData);

        //   // crunchybucket86
        //   // const attach = await axios.get(`https://gmail.googleapis.com/gmail/v1/users/me/messages/19125a93e0df7a84/attachments/ANGjdJ8XIj3ek12KWHazXY0UYc37RLfYYLiJz7RWELCItWsHlL2tWmSCfMKkNrwEnArLhIjI0sKwgBoZYXOHWdoqAuxLhi1eRUSqb_vs83EP_adNHFwNrbtMCESRvf0QPL9QwJBff6Y4EwC8Xt14L8NZucfyFq9kPzo1W3zyFstfvpypyDykY8cw2XTkmytC32iGQ9ZJouQU99jKQKE2hGch5A67Q46xzzWQ8pqRBAbLCe3WRHqh_NcuAVb7NTjisbKoT7OwTBCxLnbTsFkG3I2MgsLRA_kX48IB69scCcctJGtn76OpLTglnKx1vX-XRJosK_9qMKQdcJm3vNC4Sv-gqz5Y1PnnLFxwZmGoiwmPuuaOCtGJ2B9dcmonUVFE5W7Q0abTL-XjZvCAAuxm`, {
        //   //   headers: {
        //   //     Authorization: `Bearer ${accessToken}`,
        //   //   }
        //   // })
        //   // console.log('attachment', attach)
        // }

        if (emailContent) {
          console.log('emailContent', emailContent)
          setEmails(emailContent);
        }
      }
    } catch (error) {
      console.error('Error fetching emails:', error);
    }
  };

  console.log('companies', companies)

  return (
    <div className="flex justify-center p-8">
      <div className="flex flex-col gap-2 max-w-xl">
        <h2 className="text-xl p-b-3">Google Auth in React</h2>
        {!accessToken ? (
          <button onClick={() => login()}>Login with Google</button>
        ) : (
          <div>
            <button className="mb-2" onClick={fetchEmails}>Fetch Emails</button>
            {emails.map((email) => {
              const subject = email.payload.headers.find(header => header.name === 'Subject')?.value;
              const from = email.payload.headers.find(header => header.name === 'From')?.value;
              return (
              <div key={email.id} className="border border-sky-500 rounded p-2 mb-4">
                <div className="pb-2">
                  <h3 className="text-lg font-bold">Email id</h3>
                  <p>{email.id}</p>
                </div>
                <div className="pb-2">
                  <h3 className="text-lg font-bold">Labels</h3>
                  {email.labelIds.map(label => <p key={label}>{label}</p>)}
                </div>
                <div className="pb-2">
                  <h3 className="text-lg font-bold">Sender</h3>
                  <p>{from}</p>
                </div>
                <div className="pb-2">
                  <h3 className="text-lg font-bold">Subject</h3>
                  <p>{subject}</p>
                </div>
              </div>
            )})}
          </div>
        )}
      </div>
    </div>
  );
}

export default GoogleApp;
