import { type DkgPlugin } from "@dkg/plugins";

import { reportStore } from "./store/index.js";

const title = "List Bias Reports";
const name = "list-bias-reports";
const description = `Lists all bias reports from the current session.

**When to use:** User wants to see their previous bias analyses or find a report to publish.

**Output:** Returns a list of reports with metadata:
- IRI: Report IRI (matches @id in JSON-LD)
- title: Article title
- biasLevel: none|low|moderate|high|severe
- costUsd/costTrac: Analysis costs
- ual: null if unpublished, UAL string if published
- createdAt: When the analysis was run
- publishedAt: When published to DKG (null if unpublished)

**To publish a report:** Use 'save-bias-report' with the report IRI.`;

export const registerListReports: DkgPlugin = (_, mcp) => {
  mcp.registerTool(
    name,
    { title, description, inputSchema: {} },
    async () => {
      const reports = await reportStore.list();

      if (reports.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: "No bias reports found in the current session. Run 'detect-bias' to create a new report.",
            },
          ],
        };
      }

      const reportList = reports.map((r) => {
        const uuid = r.id.replace("https://bias-lens.neuroweb.ai/report/", "");

        let statusLine: string;
        if (r.metadata.ual && r.metadata.explorerUrl) {
          statusLine = `Status: Published\n  [View Knowledge Asset](${r.metadata.explorerUrl})`;
        } else {
          statusLine = "Status: Unpublished";
        }

        return `- **${r.metadata.title}**
  Report ID: ${uuid}
  Bias Level: ${r.metadata.biasLevel}
  Analysis Depth: ${r.metadata.analysisDepth}
  Cost: $${r.metadata.costUsd.toFixed(4)} USD (${r.metadata.costTrac.toFixed(2)} TRAC)
  ${statusLine}
  Created: ${r.metadata.createdAt.toISOString()}`;
      }).join("\n\n");

      const text = `Found ${reports.length} bias report(s):\n\n${reportList}`;

      return {
        content: [{ type: "text", text }],
      };
    },
  );
};
