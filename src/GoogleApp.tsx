/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from 'react';
import { useGoogleLogin } from '@react-oauth/google';
import axios from 'axios';
import { multipartMixedGmailParse, getBatches } from './utils';
import { WorkerPool } from './utils/worker-pool'

// const str = `--glboundary_Q9QAqBclzQADMzonvu3ApTMkvaTpH32xAj2R1Xw\nContent-type: application/json; charset=utf-8\nContent-length: 59\n\n{"response":[{"status":200},{"status":200},{"status":200}]}\n--glboundary_Q9QAqBclzQADMzonvu3ApTMkvaTpH32xAj2R1Xw\nContent-type: application/json; charset=utf-8\nContent-length: 496\n\n{"id":"159208004","firstName":"Watson","lastName":"Bot","gender":null,"email":"glipbots@gmail.com","location":null,"avatar":"https://glipstagenet-glp-pla-aws.s3.amazonaws.com/web/customer_files/4440076/IBM_Watson.png?Expires=2075494478&AWSAccessKeyId=AKIAJ34Q3RA3GV6K4TVQ&Signature=5Yvbr%2Bb1nk5M9CAsaZccZmwCJrc%3D","companyId":"159208004","creationTime":"2017-01-25T01:22:46.915Z","lastModifiedTime":"2018-06-18T17:46:24.019Z","employeeSince":null,"jobTitle":null,"birthday":null,"webPage":null}
// --glboundary_Q9QAqBclzQADMzonvu3ApTMkvaTpH32xAj2R1Xw\nContent-type: application/json; charset=utf-8\nContent-length: 486\n\n{"id":"130829004","firstName":"Jitender","lastName":"Kumar","gender":null,"email":"joe@idp.com","location":null,"avatar":"https://glipstagenet-glp-pla-aws.s3.amazonaws.com/web/customer_files/52920332/test.png?Expires=2075494478&AWSAccessKeyId=AKIAJ34Q3RA3GV6K4TVQ&Signature=AjprebKeB1OHfGCEz9vkkZMgUCk%3D","companyId":"130829004","creationTime":"2017-01-25T05:19:24.637Z","lastModifiedTime":"2018-06-21T05:09:17.472Z","employeeSince":null,"jobTitle":null,"birthday":null,"webPage":null}\n--glboundary_Q9QAqBclzQADMzonvu3ApTMkvaTpH32xAj2R1Xw\nContent-type: application/json; charset=utf-8\nContent-length: 317\n\n{"id":"glip-2367491","firstName":"Pawan","lastName":"Venugopal","gender":null,"email":"pkvenu@gmail.com","location":null,"avatar":null,"companyId":"glip-860161","creationTime":"2017-03-23T06:57:13.078Z","lastModifiedTime":"2017-10-31T20:10:41.312Z","employeeSince":null,"jobTitle":null,"birthday":null,"webPage":null}\n--glboundary_Q9QAqBclzQADMzonvu3ApTMkvaTpH32xAj2R1Xw--`

// const uuu = multipartMixedParse(str)
// console.log('uuu',uuu)

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
        }
      });

      // when scope is metadata, cannot use 'q' parameter
      // const res = await axios.get('https://www.googleapis.com/gmail/v1/users/me/messages', {
      //   headers: {
      //     Authorization: `Bearer ${accessToken}`,
      //   },
      // });


      console.log('message list data', res.data)
      const messages: {
        threadId: string;
        id: string;
      }[] = res.data.messages

      if (messages.length) {
        // batch get messages?
        const data: string = messages.map(message => `--batch\nContent-Type: application/http\n\nGET /gmail/v1/users/me/messages/${message.id}`).join('\n\n').concat('\n--batch--');

        const getStrings = messages.map(message => `--batch\nContent-Type: application/http\n\nGET /gmail/v1/users/me/messages/${message.id}`);
        const batches = getBatches(getStrings, 5);
        const formattedGetStringsBatches = batches.map(batch => batch.join('\n\n').concat('\n--batch--'))

        // console.log('formattedBatches', formattedBatches)
        // console.log('batches', batches)
        
        const config = {
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
          timeout: 5000, // 5 seconds
        });

        const results = await Promise.all(formattedGetStringsBatches.map(string => pool.execute(() => axios.request({
          ...batchConfig,
          data: string
        }))))
        const parasedResults = results.map(result => multipartMixedGmailParse(result.data));
        console.log('parasedResults', parasedResults)
        
        const b = await axios.request(config)
        // console.log('1111', b.data)
        console.log('parsed response ', multipartMixedGmailParse(b.data))

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

        // When scope is metadata only
        // const emailContent = await axios.get(`https://www.googleapis.com/gmail/v1/users/me/messages/${messages[0].id}`, {
        //   headers: {
        //     Authorization: `Bearer ${accessToken}`,
        //   },
        //   params: {
        //     format: 'METADATA'
        //   }
        // })
        // if (emailContent) {
        //   console.log('emailContent', emailContent)
        //   // setEmails([emailContent]);
        // }
      }
    } catch (error) {
      console.error('Error fetching emails:', error);
    }
  };

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
