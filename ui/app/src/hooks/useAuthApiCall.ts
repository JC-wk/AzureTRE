import {
  AuthenticationResult,
  InteractionRequiredAuthError,
} from "@azure/msal-browser";
import { useMsal, useAccount } from "@azure/msal-react";
import { useCallback } from "react";
import { APIError } from "../models/exceptions";
import config from "../config.json";

export enum ResultType {
  JSON = "JSON",
  Text = "Text",
  None = "None",
}

export enum HttpMethod {
  Get = "GET",
  Post = "POST",
  Patch = "PATCH",
  Delete = "DELETE",
}

export const useAuthApiCall = () => {
  const { instance, accounts } = useMsal();
  const account = useAccount(accounts[0] || {});

  const parseJwt = (token: string): { roles: Array<string> } => {
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map(function (c) {
          return "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2);
        })
        .join(""),
    );

    return JSON.parse(jsonPayload) as { roles: Array<string> };
  };

  return useCallback(
    async (
      endpoint: string,
      method: HttpMethod,
      workspaceApplicationIdURI?: string,
      body?: unknown,
      resultType?: ResultType,
      setRoles?: (roles: Array<string>) => void,
      tokenOnly?: boolean,
      etag?: string,
    ) => {
      if (config.debug)
        console.log("API call", {
          endpoint: endpoint,
          method: method,
          workspaceApplicationIdURI: workspaceApplicationIdURI,
          body: body,
          resultType: resultType,
          tokenOnly: tokenOnly,
          etag: etag,
        });

      if (!account) {
        console.error("No account object found, please refresh.");
        return;
      }

      const applicationIdURI =
        workspaceApplicationIdURI || config.treApplicationId;
      let tokenResponse = {} as AuthenticationResult;
      const tokenRequest = {
        scopes: [`${applicationIdURI}/user_impersonation`],
        account: account,
      };

      // try and get a token silently. at times this might throw an InteractionRequiredAuthError - if so give the user a popup to click
      try {
        tokenResponse = await instance.acquireTokenSilent(tokenRequest);
      } catch (err) {
        console.warn("Unable to get a token silently", err);
        if (err instanceof InteractionRequiredAuthError) {
          tokenResponse = await instance.acquireTokenPopup(tokenRequest);
        }
      }

      if (config.debug) console.log("Token Response", tokenResponse);

      if (!tokenResponse) {
        console.error("Token could not be retrieved, please refresh.");
        return;
      }

      // caller can pass a function to allow us to set the roles to use for RBAC
      if (setRoles) {
        const decodedToken = parseJwt(tokenResponse.accessToken);
        if (config.debug) console.log("Decoded token", decodedToken);
        setRoles(decodedToken.roles);
      }

      // we might just want the token to get the roles.
      if (tokenOnly) return;

      // trim first slash if we're given one
      if (endpoint[0] === "/") endpoint = endpoint.substring(1);

      // default to JSON unless otherwise told
      resultType = resultType || ResultType.JSON;
      if (config.debug)
        console.log(`Calling ${method} on authenticated api: ${endpoint}`);

      // set the headers for auth + http method
      const opts: RequestInit = {
        mode: "cors",
        headers: {
          Authorization: `Bearer ${tokenResponse.accessToken}`,
          "Content-Type": "application/json",
          etag: etag ? etag : "",
        },
        method: method,
      };

      // add a body if we're given one
      if (body) opts.body = JSON.stringify(body);

      let resp;
      try {
        resp = await fetch(`${config.treUrl}/${endpoint}`, opts);
      } catch (err: unknown) {
        const e = err as APIError;
        e.name = "API call failure";
        e.message = "Unable to make call to API Backend";
        e.endpoint = `${config.treUrl}/${endpoint}`;
        throw e;
      }

      if (!resp.ok) {
        const e = new APIError();
        e.message = await resp.text();
        e.status = resp.status;
        e.endpoint = endpoint;
        throw e;
      }

      try {
        switch (resultType) {
          case ResultType.Text: {
            const text = await resp.text();
            if (config.debug) console.log(text);
            return text;
          }
          case ResultType.JSON: {
            const json = await resp.json();
            if (config.debug) console.log(json);
            return json;
          }
          case ResultType.None:
            return;
        }
      } catch (err: unknown) {
        const e = err as APIError;
        e.name = "Error with response data";
        throw e;
      }
    },
    [account, instance],
  );
};
