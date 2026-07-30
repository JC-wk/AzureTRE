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

export interface TemplateViewerModalProps {
  templateName: string;
  initialVersion: string;
  compareVersion?: string;
  resourceType?: string;
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
  onClose,
}) => {
  const api = useAuthApiCall();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [allTemplates, setAllTemplates] = useState<TemplateRecord[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<string>(initialVersion);
  const [compareVersion, setCompareVersion] = useState<string>(propCompareVersion || "none");
  const [diffMode, setDiffMode] = useState<"sideBySide" | "unified" | "json">("unified");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const fetchTemplates = async () => {
      setLoading(true);
      setError(null);
      try {
        const templates = await api("templates", HttpMethod.Get);
        if (Array.isArray(templates)) {
          setAllTemplates(templates);
        } else {
          setAllTemplates([]);
        }
      } catch (err: any) {
        setError(err.message || "Failed to fetch template definitions.");
      } finally {
        setLoading(false);
      }
    };
    fetchTemplates();
  }, [api]);

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
    return (
      matchingTemplates.find((t) => t.version === selectedVersion) || {
        id: `${templateName}-${selectedVersion}`,
        name: templateName,
        version: selectedVersion,
        resourceType: resourceType || "unknown",
      }
    );
  }, [matchingTemplates, selectedVersion, templateName, resourceType]);

  // Get compare template JSON object
  const targetCompareTemplate = useMemo(() => {
    if (compareVersion === "none") return null;
    return (
      matchingTemplates.find((t) => t.version === compareVersion) || {
        id: `${templateName}-${compareVersion}`,
        name: templateName,
        version: compareVersion,
        resourceType: resourceType || "unknown",
      }
    );
  }, [matchingTemplates, compareVersion, templateName, resourceType]);

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

  return (
    <Modal
      isOpen={true}
      onDismiss={onClose}
      isBlocking={false}
      containerClassName="tre-template-viewer-modal"
      styles={{
        main: {
          minWidth: "850px",
          maxWidth: "1100px",
          width: "90vw",
          maxHeight: "90vh",
          height: "85vh",
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
            <h2 style={{ margin: 0, fontSize: "20px", fontWeight: 600, color: "#0078d4" }}>Template Viewer & Diff</h2>
            <div style={{ fontSize: "12px", color: "#605e5c", marginTop: "2px" }}>
              Template: <strong>{templateName}</strong> | Base Version: <strong>v{selectedVersion}</strong>
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
          <Spinner label="Loading template definitions..." />
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
                    onClick={() => setDiffMode("unified")}
                    style={{
                      border: "none",
                      background: diffMode === "unified" ? "#ffffff" : "transparent",
                      color: diffMode === "unified" ? "#0078d4" : "#605e5c",
                      fontWeight: diffMode === "unified" ? 600 : 400,
                      padding: "4px 10px",
                      borderRadius: "4px",
                      cursor: "pointer",
                      fontSize: "12px",
                      boxShadow: diffMode === "unified" ? "0 1px 2px rgba(0,0,0,0.1)" : "none",
                    }}
                  >
                    Unified Diff
                  </button>
                  <button
                    onClick={() => setDiffMode("sideBySide")}
                    style={{
                      border: "none",
                      background: diffMode === "sideBySide" ? "#ffffff" : "transparent",
                      color: diffMode === "sideBySide" ? "#0078d4" : "#605e5c",
                      fontWeight: diffMode === "sideBySide" ? 600 : 400,
                      padding: "4px 10px",
                      borderRadius: "4px",
                      cursor: "pointer",
                      fontSize: "12px",
                      boxShadow: diffMode === "sideBySide" ? "0 1px 2px rgba(0,0,0,0.1)" : "none",
                    }}
                  >
                    Side-by-Side
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
                marginBottom: "12px",
                display: "flex",
                gap: "16px",
                alignItems: "center",
              }}
            >
              <span>
                Comparing <strong>v{selectedVersion}</strong> (Base) with <strong>v{compareVersion}</strong> (Target)
              </span>
              <span style={{ color: "#166534", fontWeight: 600 }}>+{diffStats.added} additions</span>
              <span style={{ color: "#991b1b", fontWeight: 600 }}>-{diffStats.removed} deletions</span>
            </div>
          )}

          {/* View Container */}
          <div
            style={{
              flex: 1,
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
              /* Single Version JSON View */
              <pre style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{baseJsonStr}</pre>
            ) : diffMode === "unified" ? (
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
                      <span style={{ whiteSpace: "pre-wrap", wordBreak: "break-all" }}>{line.content}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* Side-by-Side Diff View */
              <div style={{ display: "flex", width: "100%", gap: "12px" }}>
                <div style={{ flex: 1, overflowX: "auto" }}>
                  <div
                    style={{
                      background: "#252526",
                      padding: "4px 8px",
                      fontWeight: 600,
                      color: "#9cdcfe",
                      marginBottom: "6px",
                      borderRadius: "3px",
                    }}
                  >
                    v{selectedVersion} (Base)
                  </div>
                  <pre style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{baseJsonStr}</pre>
                </div>
                <div style={{ width: "1px", background: "#3c3c3c" }} />
                <div style={{ flex: 1, overflowX: "auto" }}>
                  <div
                    style={{
                      background: "#252526",
                      padding: "4px 8px",
                      fontWeight: 600,
                      color: "#ce9178",
                      marginBottom: "6px",
                      borderRadius: "3px",
                    }}
                  >
                    v{compareVersion} (Target)
                  </div>
                  <pre style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{compareJsonStr}</pre>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
};
export default TemplateViewerModal;
