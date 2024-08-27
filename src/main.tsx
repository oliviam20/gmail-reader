import React from "react";
import ReactDOM from "react-dom/client";
import { GoogleOAuthProvider } from "@react-oauth/google";
import GoogleApp from "./GoogleApp.tsx";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <GoogleOAuthProvider clientId={import.meta.env.VITE_GMAIL_CLIENT_ID!}>
      <GoogleApp />
    </GoogleOAuthProvider>
  </React.StrictMode>,
);
