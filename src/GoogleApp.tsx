/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from 'react';
import { useGoogleLogin } from '@react-oauth/google';
import axios from 'axios';

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
    scope: 'https://www.googleapis.com/auth/gmail.readonly',
  });

  const fetchEmails = async () => {
    if (!accessToken) {
      console.error('Access token is not available.');
      return;
    }

    try {
      const res = await axios.get('https://www.googleapis.com/gmail/v1/users/me/messages', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      console.log('data', res.data)
      const messages: {
        threadId: string;
        id: string;
      }[] = res.data.messages

      if (messages.length) {
        const emailContent = await Promise.all(messages.map(message => axios.get(`https://www.googleapis.com/gmail/v1/users/me/messages/${message.id}`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        })))

        if (emailContent.length) {
          console.log('emailContent', emailContent)
          const emailData: EmailData[] = emailContent.map(email => email.data)
          setEmails(emailData);
        }
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
                <div className="pb-2">
                  <h3 className="text-lg font-bold">Snippet</h3>
                  <p>{email.snippet}</p>
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
