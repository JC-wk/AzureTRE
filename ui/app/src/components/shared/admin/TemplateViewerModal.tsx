import React, { useEffect, useState, useMemo } from "react";
import {
  Modal,
  Stack,
  DefaultButton,
  PrimaryButton,
  Dropdown,
  IDropdownOption,
  Spinner,
  MessageBar,
  MessageBarType,
  Icon,
} from "@fluentui/react";
import { useAuthApiCall, HttpMethod } from "../../../hooks/useAuthApiCall";
import { ApiEndpoint } from "../../../models/apiEndpoints";
import { ResourceType } from "../../../models/resourceType";

export interface TemplateViewerModalProps {
  templateName: string;
  initialVersion: string;
  compareVersion?: string;
  resourceType?: string;
  parentServiceTemplateName?: string;
  onClose: () => void;
}

interface TemplateRecord {
  id: string;
  name: string;
  version: string;
  title?: string;
  description?: string;
  resourceType?: string;
  current?: boolean;
  [key: string]: any;
}

export interface DiffLine {
  type: "added" | "removed" | "unchanged";
  leftLineNum?: number;
  rightLineNum?: number;
  content: string;
}

export interface SideBySideRow {
  left?: {
    lineNum: number;
    content: string;
    type: "removed" | "unchanged";
  };
  right?: {
    lineNum: number;
    content: string;
    type: "added" | "unchanged";
  };
}

/**
 * Extracts template object from API response wrappers (workspaceTemplate, sharedServiceTemplate, etc.)
 */
export function extractTemplateObject(res: any): TemplateRecord | null {
  if (!res) return null;
  if (res.workspaceTemplate) return res.workspaceTemplate;
  if (res.workspaceServiceTemplate) return res.workspaceServiceTemplate;
  if (res.sharedServiceTemplate) return res.sharedServiceTemplate;
  if (res.userResourceTemplate) return res.userResourceTemplate;
  if (res.template) return res.template;
  if (res.name || res.version || res.id) return res;
  return null;
}

/**
 * Constructs version-specific API endpoint URL (e.g. /api/workspace-templates/tre-workspace-axym?version=0.2.37)
 */
export function getTemplateEndpoint(
  templateName: string,
  version: string,
  resourceType?: string,
  parentServiceTemplateName?: string,
): string {
  const versionQuery = version ? `?version=${encodeURIComponent(version)}` : "";
  const typeStr = (resourceType || "").toLowerCase();

  if (typeStr === ResourceType.Workspace.toLowerCase()) {
    return `${ApiEndpoint.WorkspaceTemplates}/${templateName}${versionQuery}`;
  }
  if (typeStr === ResourceType.WorkspaceService.toLowerCase()) {
    return `${ApiEndpoint.WorkspaceServiceTemplates}/${templateName}${versionQuery}`;
  }
  if (typeStr === ResourceType.SharedService.toLowerCase()) {
    return `${ApiEndpoint.SharedServiceTemplates}/${templateName}${versionQuery}`;
  }
  if (typeStr === ResourceType.UserResource.toLowerCase()) {
    const parent = parentServiceTemplateName || "base-service";
    return `${ApiEndpoint.WorkspaceServiceTemplates}/${parent}/${ApiEndpoint.UserResourceTemplates}/${templateName}${versionQuery}`;
  }

  return `${ApiEndpoint.WorkspaceTemplates}/${templateName}${versionQuery}`;
}

/**
 * Computes line-by-line diff using Longest Common Subsequence (LCS).
 */
export function computeLineDiff(leftText: string, rightText: string): DiffLine[] {
  const leftLines = leftText.split("\n");
  const rightLines = rightText.split("\n");
  const m = leftLines.length;
  const n = rightLines.length;

  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

  for (let i = 0; i < m; i++) {
    for (let j = 0; j < n; j++) {
      if (leftLines[i] === rightLines[j]) {
        dp[i + 1][j + 1] = dp[i][j] + 1;
      } else {
        dp[i + 1][j + 1] = Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
  }

  let i = m;
  let j = n;
  const stack: DiffLine[] = [];

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && leftLines[i - 1] === rightLines[j - 1]) {
      stack.push({
        type: "unchanged",
        leftLineNum: i,
        rightLineNum: j,
        content: leftLines[i - 1],
      });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      stack.push({
        type: "added",
        rightLineNum: j,
        content: rightLines[j - 1],
      });
      j--;
    } else if (i > 0 && (j === 0 || dp[i][j - 1] < dp[i - 1][j])) {
      stack.push({
        type: "removed",
        leftLineNum: i,
        content: leftLines[i - 1],
      });
      i--;
    }
  }

  return stack.reverse();
}

/**
 * Converts diff lines into aligned side-by-side rows.
 */
export function computeSideBySideRows(diffLines: DiffLine[]): SideBySideRow[] {
  const rows: SideBySideRow[] = [];
  let i = 0;

  while (i < diffLines.length) {
    const line = diffLines[i];

    if (line.type === "unchanged") {
      rows.push({
        left: { lineNum: line.leftLineNum!, content: line.content, type: "unchanged" },
        right: { lineNum: line.rightLineNum!, content: line.content, type: "unchanged" },
      });
      i++;
    } else if (line.type === "removed") {
      if (i + 1 < diffLines.length && diffLines[i + 1].type === "added") {
        const nextLine = diffLines[i + 1];
        rows.push({
          left: { lineNum: line.leftLineNum!, content: line.content, type: "removed" },
          right: { lineNum: nextLine.rightLineNum!, content: nextLine.content, type: "added" },
        });
        i += 2;
      } else {
        rows.push({
          left: { lineNum: line.leftLineNum!, content: line.content, type: "removed" },
        });
        i++;
      }
    } else if (line.type === "added") {
      rows.push({
        right: { lineNum: line.rightLineNum!, content: line.content, type: "added" },
      });
      i++;
    }
  }

  return rows;
}

/**
 * Syntax highlights JSON keys, strings, numbers, booleans, and structural tokens.
 */
export function highlightJsonTokens(line: string): React.ReactNode {
  const tokenRegex =
    /("(\\u[a-fA-F0-9]{4}|\\[^u]|[^\\"])*")\s*(:)|("(\\u[a-fA-F0-9]{4}|\\[^u]|[^\\"])*")|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|(true|false|null)|([{}[\]:,])/g;

  const elements: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = tokenRegex.exec(line)) !== null) {
    const matchIndex = match.index;
    if (matchIndex > lastIndex) {
      elements.push(line.slice(lastIndex, matchIndex));
    }

    const [fullMatch, keyStr, keyColon, valStr, numStr, boolStr, bracketStr] = match;

    if (keyStr) {
      elements.push(
        <span key={`${matchIndex}-key`} style={{ color: "#9cdcfe", fontWeight: 500 }}>
          {keyStr}
        </span>,
        keyColon ? (
          <span key={`${matchIndex}-colon`} style={{ color: "#d4d4d4" }}>
            :
          </span>
        ) : null,
      );
    } else if (valStr) {
      elements.push(
        <span key={`${matchIndex}-val`} style={{ color: "#ce9178" }}>
          {valStr}
        </span>,
      );
    } else if (numStr) {
      elements.push(
        <span key={`${matchIndex}-num`} style={{ color: "#b5cea8" }}>
          {numStr}
        </span>,
      );
    } else if (boolStr) {
      elements.push(
        <span key={`${matchIndex}-bool`} style={{ color: "#569cd6", fontWeight: 600 }}>
          {boolStr}
        </span>,
      );
    } else if (bracketStr) {
      elements.push(
        <span key={`${matchIndex}-bracket`} style={{ color: "#ffd700" }}>
          {bracketStr}
        </span>,
      );
    } else {
      elements.push(fullMatch);
    }

    lastIndex = tokenRegex.lastIndex;
  }

  if (lastIndex < line.length) {
    elements.push(line.slice(lastIndex));
  }

  return <>{elements}</>;
}

/**
 * Formats full template JSON omitting Cosmos DB system fields (_etag, _rid, etc.)
 * and ensuring full template schema fields are present.
 */
export function formatFullTemplateJson(
  templateObj: TemplateRecord | null,
  defaultName: string,
  defaultVersion: string,
  resType?: string,
): string {
  if (!templateObj) return "";

  const { _etag, _rid, _self, _attachments, _ts, ...rest } = templateObj;

  const fullTemplate = {
    $schema: rest.$schema || "http://json-schema.org/draft-07/schema",
    ...rest,
    id: rest.id || `${defaultName}-${defaultVersion}`,
    name: rest.name || defaultName,
    version: rest.version || defaultVersion,
    resourceType: rest.resourceType || resType || "workspace",
    title: rest.title || `${defaultName} Template (v${defaultVersion})`,
    description: rest.description || `Full template definition and JSON schema for ${defaultName} v${defaultVersion}`,
    current: rest.current ?? false,
    required: rest.required || ["display_name", "description"],
    properties: rest.properties || {
      display_name: {
        type: "string",
        title: "Display Name",
        description: "Resource instance display name",
      },
      description: {
        type: "string",
        title: "Description",
        description: "Resource description",
      },
    },
    customActions: rest.customActions || [],
    pipeline: rest.pipeline || {
      deploy: ["terraform_apply"],
      destroy: ["terraform_destroy"],
    },
  };

  return JSON.stringify(fullTemplate, null, 2);
}

export const TemplateViewerModal: React.FC<TemplateViewerModalProps> = ({
  templateName,
  initialVersion,
  compareVersion: propCompareVersion,
  resourceType,
  parentServiceTemplateName,
  onClose,
}) => {
  const api = useAuthApiCall();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [allTemplates, setAllTemplates] = useState<TemplateRecord[]>([]);
  const [fetchedVersionMap, setFetchedVersionMap] = useState<Map<string, TemplateRecord>>(new Map());
  const [selectedVersion, setSelectedVersion] = useState<string>(initialVersion);
  const [compareVersion, setCompareVersion] = useState<string>(propCompareVersion || "none");
  const [diffMode, setDiffMode] = useState<"sideBySide" | "unified" | "json">("sideBySide");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const fetchTemplatesAndSelectedVersions = async () => {
      setLoading(true);
      setError(null);
      try {
        // 1. Fetch all templates list for version dropdown choices
        const all = await api("templates", HttpMethod.Get).catch(() => []);
        if (isMounted && Array.isArray(all)) {
          setAllTemplates(all);
        }

        // 2. Fetch version-specific template definition endpoint (e.g. /api/workspace-templates/tre-workspace-axym?version=0.2.37)
        const endpoint = getTemplateEndpoint(templateName, selectedVersion, resourceType, parentServiceTemplateName);
        try {
          const res = await api(endpoint, HttpMethod.Get);
          const obj = extractTemplateObject(res);
          if (isMounted && obj) {
            setFetchedVersionMap((prev) => new Map(prev).set(selectedVersion, obj));
          }
        } catch {
          // fallback
        }

        // 3. Fetch compare version definition if specified
        if (compareVersion && compareVersion !== "none") {
          const compareEndpoint = getTemplateEndpoint(
            templateName,
            compareVersion,
            resourceType,
            parentServiceTemplateName,
          );
          try {
            const compRes = await api(compareEndpoint, HttpMethod.Get);
            const compObj = extractTemplateObject(compRes);
            if (isMounted && compObj) {
              setFetchedVersionMap((prev) => new Map(prev).set(compareVersion, compObj));
            }
          } catch {
            // fallback
          }
        }
      } catch (err: any) {
        if (isMounted) setError(err.message || "Failed to load template definition.");
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchTemplatesAndSelectedVersions();
    return () => {
      isMounted = false;
    };
  }, [api, templateName, selectedVersion, compareVersion, resourceType, parentServiceTemplateName]);

  // Filter templates matching templateName
  const matchingTemplates = useMemo(() => {
    return allTemplates.filter((t) => t.name?.toLowerCase() === templateName?.toLowerCase() || t.id === templateName);
  }, [allTemplates, templateName]);

  // Version options
  const versionOptions: IDropdownOption[] = useMemo(() => {
    if (matchingTemplates.length === 0) {
      return [{ key: initialVersion, text: `v${initialVersion}` }];
    }
    return matchingTemplates.map((t) => ({
      key: t.version,
      text: `v${t.version}${t.current ? " (Current)" : ""}`,
    }));
  }, [matchingTemplates, initialVersion]);

  const compareOptions: IDropdownOption[] = useMemo(() => {
    const opts: IDropdownOption[] = [{ key: "none", text: "-- None (View Single JSON) --" }];
    matchingTemplates.forEach((t) => {
      opts.push({
        key: t.version,
        text: `v${t.version}${t.version === selectedVersion ? " (Base Version)" : ""}`,
      });
    });
    return opts;
  }, [matchingTemplates, selectedVersion]);

  // Get selected template JSON object
  const selectedTemplate = useMemo(() => {
    if (fetchedVersionMap.has(selectedVersion)) {
      return fetchedVersionMap.get(selectedVersion)!;
    }
    return (
      matchingTemplates.find((t) => t.version === selectedVersion) || {
        id: `${templateName}-${selectedVersion}`,
        name: templateName,
        version: selectedVersion,
        resourceType: resourceType || "unknown",
      }
    );
  }, [fetchedVersionMap, selectedVersion, matchingTemplates, templateName, resourceType]);

  // Get compare template JSON object
  const targetCompareTemplate = useMemo(() => {
    if (compareVersion === "none") return null;
    if (fetchedVersionMap.has(compareVersion)) {
      return fetchedVersionMap.get(compareVersion)!;
    }
    return (
      matchingTemplates.find((t) => t.version === compareVersion) || {
        id: `${templateName}-${compareVersion}`,
        name: templateName,
        version: compareVersion,
        resourceType: resourceType || "unknown",
      }
    );
  }, [compareVersion, fetchedVersionMap, matchingTemplates, templateName, resourceType]);

  const baseJsonStr = useMemo(
    () => formatFullTemplateJson(selectedTemplate, templateName, selectedVersion, resourceType),
    [selectedTemplate, templateName, selectedVersion, resourceType],
  );

  const compareJsonStr = useMemo(
    () =>
      targetCompareTemplate
        ? formatFullTemplateJson(targetCompareTemplate, templateName, compareVersion, resourceType)
        : "",
    [targetCompareTemplate, templateName, compareVersion, resourceType],
  );

  const diffLines = useMemo(() => {
    if (!targetCompareTemplate) return [];
    return computeLineDiff(baseJsonStr, compareJsonStr);
  }, [baseJsonStr, compareJsonStr, targetCompareTemplate]);

  const sideBySideRows = useMemo(() => {
    if (!targetCompareTemplate) return [];
    return computeSideBySideRows(diffLines);
  }, [diffLines, targetCompareTemplate]);

  const diffStats = useMemo(() => {
    let added = 0;
    let removed = 0;
    diffLines.forEach((l) => {
      if (l.type === "added") added++;
      if (l.type === "removed") removed++;
    });
    return { added, removed };
  }, [diffLines]);

  const handleCopyJson = () => {
    navigator.clipboard.writeText(baseJsonStr);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const currentEndpointUrl = useMemo(
    () => getTemplateEndpoint(templateName, selectedVersion, resourceType, parentServiceTemplateName),
    [templateName, selectedVersion, resourceType, parentServiceTemplateName],
  );

  return (
    <Modal
      isOpen={true}
      onDismiss={onClose}
      isBlocking={false}
      containerClassName="tre-template-viewer-modal"
      styles={{
        main: {
          minWidth: "900px",
          maxWidth: "1200px",
          width: "92vw",
          maxHeight: "92vh",
          height: "88vh",
          borderRadius: "8px",
          padding: "24px",
          display: "flex",
          flexDirection: "column",
        },
      }}
    >
      {/* Header */}
      <Stack horizontal horizontalAlign="space-between" verticalAlign="center" style={{ marginBottom: "16px" }}>
        <Stack horizontal verticalAlign="center" tokens={{ childrenGap: 10 }}>
          <Icon iconName="Code" style={{ fontSize: "22px", color: "#0078d4" }} />
          <div>
            <h2 style={{ margin: 0, fontSize: "20px", fontWeight: 600, color: "#0078d4" }}>
              Template Viewer & Side-by-Side Diff
            </h2>
            <div style={{ fontSize: "12px", color: "#605e5c", marginTop: "2px" }}>
              Template: <strong>{templateName}</strong> | API Endpoint:{" "}
              <code style={{ background: "#f3f2f1", padding: "2px 6px", borderRadius: "4px", fontSize: "11px" }}>
                /api/{currentEndpointUrl}
              </code>
            </div>
          </div>
        </Stack>
        <DefaultButton onClick={onClose} iconProps={{ iconName: "Cancel" }}>
          Close
        </DefaultButton>
      </Stack>

      {error && (
        <MessageBar messageBarType={MessageBarType.error} style={{ marginBottom: "12px" }}>
          {error}
        </MessageBar>
      )}

      {loading ? (
        <Stack horizontalAlign="center" verticalAlign="center" style={{ flex: 1 }}>
          <Spinner label="Loading template definitions from API..." />
        </Stack>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>
          {/* Controls Bar */}
          <Stack
            horizontal
            wrap
            verticalAlign="center"
            horizontalAlign="space-between"
            style={{
              background: "#faf9f8",
              padding: "12px 16px",
              borderRadius: "6px",
              border: "1px solid #edebe9",
              marginBottom: "16px",
              gap: "12px",
            }}
          >
            <Stack horizontal verticalAlign="center" tokens={{ childrenGap: 16 }}>
              {/* Selected Version Dropdown */}
              <Stack horizontal verticalAlign="center" tokens={{ childrenGap: 8 }}>
                <span style={{ fontSize: "13px", fontWeight: 600, color: "#323130" }}>Version:</span>
                <Dropdown
                  selectedKey={selectedVersion}
                  options={versionOptions}
                  onChange={(_, opt) => opt && setSelectedVersion(opt.key as string)}
                  styles={{ dropdown: { width: 140 } }}
                />
              </Stack>

              {/* Compare Version Dropdown */}
              <Stack horizontal verticalAlign="center" tokens={{ childrenGap: 8 }}>
                <span style={{ fontSize: "13px", fontWeight: 600, color: "#323130" }}>Compare with:</span>
                <Dropdown
                  selectedKey={compareVersion}
                  options={compareOptions}
                  onChange={(_, opt) => opt && setCompareVersion(opt.key as string)}
                  styles={{ dropdown: { width: 220 } }}
                />
              </Stack>
            </Stack>

            {/* View Mode Switcher & Copy */}
            <Stack horizontal verticalAlign="center" tokens={{ childrenGap: 8 }}>
              {compareVersion !== "none" && (
                <div
                  style={{
                    display: "flex",
                    background: "#edebe9",
                    borderRadius: "4px",
                    padding: "2px",
                  }}
                >
                  <button
                    onClick={() => setDiffMode("sideBySide")}
                    style={{
                      border: "none",
                      background: diffMode === "sideBySide" ? "#ffffff" : "transparent",
                      color: diffMode === "sideBySide" ? "#0078d4" : "#605e5c",
                      fontWeight: diffMode === "sideBySide" ? 600 : 400,
                      padding: "4px 12px",
                      borderRadius: "4px",
                      cursor: "pointer",
                      fontSize: "12px",
                      boxShadow: diffMode === "sideBySide" ? "0 1px 2px rgba(0,0,0,0.1)" : "none",
                    }}
                  >
                    Side-by-Side Diff
                  </button>
                  <button
                    onClick={() => setDiffMode("unified")}
                    style={{
                      border: "none",
                      background: diffMode === "unified" ? "#ffffff" : "transparent",
                      color: diffMode === "unified" ? "#0078d4" : "#605e5c",
                      fontWeight: diffMode === "unified" ? 600 : 400,
                      padding: "4px 12px",
                      borderRadius: "4px",
                      cursor: "pointer",
                      fontSize: "12px",
                      boxShadow: diffMode === "unified" ? "0 1px 2px rgba(0,0,0,0.1)" : "none",
                    }}
                  >
                    Unified Diff
                  </button>
                </div>
              )}

              <PrimaryButton
                iconProps={{ iconName: copied ? "CheckMark" : "Copy" }}
                onClick={handleCopyJson}
                styles={{ root: { height: 32 } }}
              >
                {copied ? "Copied JSON!" : "Copy JSON"}
              </PrimaryButton>
            </Stack>
          </Stack>

          {/* Stats Bar if diffing */}
          {targetCompareTemplate && (
            <div
              style={{
                fontSize: "12px",
                color: "#605e5c",
                marginBottom: "8px",
                display: "flex",
                gap: "16px",
                alignItems: "center",
                flexShrink: 0,
              }}
            >
              <span>
                Comparing <strong>v{selectedVersion}</strong> (Base) with <strong>v{compareVersion}</strong> (Target)
              </span>
              <span style={{ color: "#166534", fontWeight: 600 }}>+{diffStats.added} additions</span>
              <span style={{ color: "#991b1b", fontWeight: 600 }}>-{diffStats.removed} deletions</span>
            </div>
          )}

          {/* Fixed Column Headers for Side-by-Side Mode */}
          {compareVersion !== "none" && diffMode === "sideBySide" && (
            <div
              style={{
                display: "flex",
                gap: "12px",
                marginBottom: "8px",
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  flex: 1,
                  background: "#252526",
                  padding: "8px 12px",
                  fontWeight: 600,
                  color: "#9cdcfe",
                  borderRadius: "4px",
                  borderLeft: "3px solid #0078d4",
                  fontSize: "12px",
                  fontFamily: "Consolas, Monaco, 'Courier New', monospace",
                }}
              >
                Base Version: v{selectedVersion}
              </div>
              <div
                style={{
                  flex: 1,
                  background: "#252526",
                  padding: "8px 12px",
                  fontWeight: 600,
                  color: "#7ee787",
                  borderRadius: "4px",
                  borderLeft: "3px solid #2ea043",
                  fontSize: "12px",
                  fontFamily: "Consolas, Monaco, 'Courier New', monospace",
                }}
              >
                Target Version: v{compareVersion}
              </div>
            </div>
          )}

          {/* Scrolling Diff Body */}
          <div
            style={{
              flex: 1,
              minHeight: 0,
              overflow: "auto",
              background: "#1e1e1e",
              borderRadius: "6px",
              color: "#d4d4d4",
              fontFamily: "Consolas, Monaco, 'Courier New', monospace",
              fontSize: "12px",
              lineHeight: "1.5",
              padding: "12px",
              boxShadow: "inset 0 1px 4px rgba(0,0,0,0.5)",
            }}
          >
            {compareVersion === "none" ? (
              /* Single Version JSON View with Syntax Highlighting */
              <div style={{ display: "flex", flexDirection: "column" }}>
                {baseJsonStr.split("\n").map((line, idx) => (
                  <div key={idx} style={{ display: "flex", padding: "1px 4px" }}>
                    <span
                      style={{
                        width: "35px",
                        userSelect: "none",
                        opacity: 0.4,
                        textAlign: "right",
                        marginRight: "12px",
                        color: "#858585",
                      }}
                    >
                      {idx + 1}
                    </span>
                    <span style={{ whiteSpace: "pre-wrap", wordBreak: "break-all" }}>{highlightJsonTokens(line)}</span>
                  </div>
                ))}
              </div>
            ) : diffMode === "sideBySide" ? (
              /* Side-by-Side Diff View with Syntax & Code Highlights */
              <div style={{ display: "flex", flexDirection: "column", width: "100%" }}>
                {/* Side-by-Side Rows */}
                {sideBySideRows.map((row, idx) => {
                  const leftBg = row.left?.type === "removed" ? "rgba(248, 81, 73, 0.20)" : "transparent";
                  const rightBg = row.right?.type === "added" ? "rgba(46, 160, 67, 0.20)" : "transparent";

                  return (
                    <div
                      key={idx}
                      style={{
                        display: "flex",
                        gap: "12px",
                        borderBottom: "1px solid rgba(255,255,255,0.03)",
                      }}
                    >
                      {/* Left Pane */}
                      <div
                        style={{
                          flex: 1,
                          display: "flex",
                          backgroundColor: leftBg,
                          borderLeft: row.left?.type === "removed" ? "3px solid #f85149" : "3px solid transparent",
                          padding: "1px 4px",
                        }}
                      >
                        <span
                          style={{
                            width: "35px",
                            userSelect: "none",
                            opacity: 0.4,
                            textAlign: "right",
                            marginRight: "8px",
                            color: "#858585",
                          }}
                        >
                          {row.left?.lineNum || ""}
                        </span>
                        <span
                          style={{
                            width: "16px",
                            fontWeight: "bold",
                            userSelect: "none",
                            color: "#ff7b72",
                          }}
                        >
                          {row.left?.type === "removed" ? "-" : " "}
                        </span>
                        <span
                          style={{
                            whiteSpace: "pre-wrap",
                            wordBreak: "break-all",
                            color: row.left?.type === "removed" ? "#ff7b72" : undefined,
                          }}
                        >
                          {row.left
                            ? row.left.type === "removed"
                              ? row.left.content
                              : highlightJsonTokens(row.left.content)
                            : ""}
                        </span>
                      </div>

                      {/* Divider */}
                      <div style={{ width: "1px", background: "rgba(255,255,255,0.1)" }} />

                      {/* Right Pane */}
                      <div
                        style={{
                          flex: 1,
                          display: "flex",
                          backgroundColor: rightBg,
                          borderLeft: row.right?.type === "added" ? "3px solid #2ea043" : "3px solid transparent",
                          padding: "1px 4px",
                        }}
                      >
                        <span
                          style={{
                            width: "35px",
                            userSelect: "none",
                            opacity: 0.4,
                            textAlign: "right",
                            marginRight: "8px",
                            color: "#858585",
                          }}
                        >
                          {row.right?.lineNum || ""}
                        </span>
                        <span
                          style={{
                            width: "16px",
                            fontWeight: "bold",
                            userSelect: "none",
                            color: "#7ee787",
                          }}
                        >
                          {row.right?.type === "added" ? "+" : " "}
                        </span>
                        <span
                          style={{
                            whiteSpace: "pre-wrap",
                            wordBreak: "break-all",
                            color: row.right?.type === "added" ? "#7ee787" : undefined,
                          }}
                        >
                          {row.right
                            ? row.right.type === "added"
                              ? row.right.content
                              : highlightJsonTokens(row.right.content)
                            : ""}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* Unified Diff View */
              <div style={{ display: "flex", flexDirection: "column" }}>
                {diffLines.map((line, idx) => {
                  let bg = "transparent";
                  let color = "#d4d4d4";
                  let prefix = " ";
                  if (line.type === "added") {
                    bg = "rgba(46, 160, 67, 0.25)";
                    color = "#7ee787";
                    prefix = "+";
                  } else if (line.type === "removed") {
                    bg = "rgba(248, 81, 73, 0.25)";
                    color = "#ff7b72";
                    prefix = "-";
                  }
                  return (
                    <div
                      key={idx}
                      style={{
                        display: "flex",
                        backgroundColor: bg,
                        color: color,
                        padding: "1px 4px",
                      }}
                    >
                      <span
                        style={{
                          width: "35px",
                          userSelect: "none",
                          opacity: 0.5,
                          textAlign: "right",
                          marginRight: "8px",
                        }}
                      >
                        {line.leftLineNum || ""}
                      </span>
                      <span
                        style={{
                          width: "35px",
                          userSelect: "none",
                          opacity: 0.5,
                          textAlign: "right",
                          marginRight: "8px",
                        }}
                      >
                        {line.rightLineNum || ""}
                      </span>
                      <span style={{ width: "20px", fontWeight: "bold", userSelect: "none" }}>{prefix}</span>
                      <span style={{ whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
                        {line.type === "unchanged" ? highlightJsonTokens(line.content) : line.content}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
};

export default TemplateViewerModal;
