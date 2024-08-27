/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useMemo, useCallback } from "react";
import { useGoogleLogin } from "@react-oauth/google";
import { extractSenderInfo, mergeEmailsByNameOrEmail } from "./utils";
import { fetchGmailMessages, getGmailMessageList } from "./utils/gmail";
import { WorkerPool } from "./utils/worker-pool";
import Spinner from "./components/Spinner";

export interface EmailData {
  historyId: string;
  id: string;
  internalDate: string;
  labelIds: string[];
  payload: {
    body: {
      size: number;
    };
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
  const [isFetching, setIsFetching] = useState<boolean>(false);
  const [firstPageEmails, setFirstPageEmails] = useState<EmailData[]>([]);
  const [timeToGetFirstEmails, setTimeToGetFirstEmails] = useState<string | null>(null);
  const [timeToGetAllEmails, setTimeToGetAllEmails] = useState<string | null>(null);

  const login = useGoogleLogin({
    onSuccess: (response) => {
      setAccessToken(response.access_token);
    },
    onError: (error) => console.log("Login Failed:", error),
    scope: "https://www.googleapis.com/auth/gmail.readonly",
    overrideScope: false,
  });

  const pool = useMemo(
    () =>
      new WorkerPool(5, {
        retries: 2,
        timeout: 3000, // 3 seconds
      }),
    [],
  );

  const companies = useMemo(() => {
    const arrEmails = emails.length > firstPageEmails.length ? emails : firstPageEmails;
    const senders =
      arrEmails.map((email) => email.payload.headers.find((header) => header.name === "From")?.value ?? "") ?? [];
    const uniqueSet = new Set(senders);
    const uniqueArray = Array.from(uniqueSet);
    const companyNamesAndEmails = uniqueArray.map((sender) => {
      const senderEmails = arrEmails.filter(
        (email) => email.payload.headers.find((header) => header.name === "From")?.value === sender,
      );
      const sortEmails = senderEmails.sort(
        (a, b) => new Date(parseInt(a.internalDate)).getTime() - new Date(parseInt(b.internalDate)).getTime(),
      );
      const senderInfo = extractSenderInfo(sender) ?? {};
      return {
        ...senderInfo,
        joinDate: parseInt(sortEmails[0].internalDate),
        numEmails: sortEmails.length,
      };
    });

    const mergedCompanies = mergeEmailsByNameOrEmail(companyNamesAndEmails);

    const sortedMergedCompanies = mergedCompanies.sort((a, b) => a.joinDate - b.joinDate);

    return sortedMergedCompanies;
  }, [emails, firstPageEmails]);

  const getAllGmailMessages = useCallback(
    async (accessToken: string, isFirstFetch: boolean, year: number, pageToken?: string) => {
      const startTime = new Date();

      const res = await getGmailMessageList(accessToken, year, pageToken);
      const {
        messages,
        nextPageToken,
      }: {
        messages: {
          threadId: string;
          id: string;
        }[];
        nextPageToken?: string | undefined;
      } = res;

      let results: EmailData[] = [];
      if (messages?.length) {
        const messageIds = messages.map((message) => message.id);
        results = (await fetchGmailMessages(accessToken, pool, messageIds)) ?? [];

        if (isFirstFetch) {
          setFirstPageEmails(results);
          const endTime = new Date();
          const startTimeMs = startTime.getTime();
          const endTimeMs = endTime.getTime();
          const timeDiff = endTimeMs - startTimeMs;
          const differenceSeconds = (timeDiff / 1000).toFixed(3);
          setTimeToGetFirstEmails(differenceSeconds);
        }
      }

      let nextPageEmails: EmailData[] = [];
      if (nextPageToken) {
        nextPageEmails = (await getAllGmailMessages(accessToken, false, year, nextPageToken)) ?? [];
      }

      return [...results, ...nextPageEmails];
    },
    [pool],
  );

  async function fetchEmails() {
    if (!accessToken) {
      console.error("Access token is not available.");
      return;
    }

    setTimeToGetFirstEmails(null);
    setTimeToGetAllEmails(null);

    try {
      const startTime = new Date();
      setIsFetching(true);
      // Need to get oldest emails first, limit by oldest 4 years ago
      const emails = [];
      const oldestYear = 4;
      for (let i = oldestYear; i > -1; i--) {
        const currentDate = new Date();
        const pastDate = new Date(currentDate.setFullYear(currentDate.getFullYear() - i));
        const year = pastDate.getFullYear();
        const isFirstFetch = i === oldestYear;
        const allEmails = await getAllGmailMessages(accessToken, isFirstFetch, year);
        emails.push(...allEmails);
      }

      setEmails(emails);
      setIsFetching(false);
      const endTime = new Date();
      const startTimeMs = startTime.getTime();
      const endTimeMs = endTime.getTime();
      const timeDiff = endTimeMs - startTimeMs;
      const differenceSeconds = (timeDiff / 1000).toFixed(3);
      setTimeToGetAllEmails(differenceSeconds);
    } catch (error) {
      console.error("Error fetching emails:", error);
    }
  }

  console.log("companies", companies);

  return (
    <div className="flex justify-center p-8">
      <div className="flex max-w-xl flex-col gap-2">
        <h2 className="p-b-3 text-xl">Google Auth in React</h2>
        {timeToGetFirstEmails ? <p>Seconds to get first page of emails: {timeToGetFirstEmails}</p> : null}
        {timeToGetAllEmails ? <p>Seconds to get all emails: {timeToGetAllEmails}</p> : null}
        {emails.length ? <p>Total emails fetched: {emails.length}</p> : null}
        {companies?.length > 0 ? <div>Number of companies that have your data: {companies.length}</div> : null}
        {emails.length ? (
          <button className="mb-2 w-[170px]">
            <p>
              <a
                className="inline-block"
                href={`data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(emails))}`}
                download="gmailData.json"
              >
                Download emails
              </a>
            </p>
          </button>
        ) : null}
        {!accessToken ? (
          <button onClick={() => login()}>Login with Google</button>
        ) : (
          <div>
            {isFetching ? (
              <button className="mb-2 flex items-center">
                <Spinner />
                <span className="pl-2">Fetching more emails...</span>
              </button>
            ) : (
              <button className="mb-2" onClick={fetchEmails}>
                Fetch Emails
              </button>
            )}
            {companies.map((company) => {
              return (
                <div key={company.names[0]} className="mb-4 rounded border border-sky-500 p-2">
                  <div className="pb-2">
                    <h3 className="text-lg font-bold">Company name</h3>
                    <p>{company.names.length > 1 ? company.emails[0] : company.names[0]}</p>
                  </div>
                  <div className="pb-2">
                    <h3 className="text-lg font-bold">Email</h3>
                    {company.emails.map((email) => (
                      <p key={email}>{email}</p>
                    ))}
                  </div>
                  <div className="pb-2">
                    <h3 className="text-lg font-bold">Joined</h3>
                    <p>{new Date(company.joinDate).toDateString()}</p>
                  </div>
                  <div className="pb-2">
                    <h3 className="text-lg font-bold">Number of emails</h3>
                    <p>{company.numEmails}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default GoogleApp;
