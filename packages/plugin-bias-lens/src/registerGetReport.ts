import { type DkgPlugin } from "@dkg/plugins";
import { z } from "@dkg/plugin-swagger";

import { reportStore } from "./store/index.js";

const title = "Get Bias Report";
const name = "get-bias-report";
const description = `Retrieves a full bias report by IRI or UAL.

**When to use:** User wants to see the complete details of a specific report.

**Input:**
- identifier: Either the report IRI (from detect-bias) or UAL (from DKG publishing)

**Output:** Returns:
- Full JSON-LD knowledge asset (public and private sections)
- Metadata (costs, dates, UAL if published, etc.)

**Flexibility:** Accepts either IRI or UAL for convenient retrieval.`;

const inputSchema = {
  identifier: z.string().describe("Report IRI or UAL"),
};

export const registerGetReport: DkgPlugin = (_, mcp) => {
  mcp.registerTool(
    name,
    { title, description, inputSchema },
    async ({ identifier }) => {
      let report = await reportStore.get(identifier);

      if (!report) {
        const allReports = await reportStore.list();
        const matchingReport = allReports.find(r => r.metadata.ual === identifier);

        if (matchingReport) {
          report = await reportStore.get(matchingReport.id);
        }
      }

      if (!report) {
        return {
          content: [
            {
              type: "text",
              text: `Error: Report not found with identifier: ${identifier}\n\nPlease verify the report IRI or UAL. Use 'list-bias-reports' to see all available reports.`,
            },
          ],
        };
      }

      const publishStatus = report.metadata.ual
        ? `Published to DKG\nUAL: ${report.metadata.ual}\nPublished: ${report.metadata.publishedAt?.toISOString()}`
        : "Unpublished (exists only in session memory)";

      const text = `**${report.metadata.title}**

Report IRI: ${report.id}
Grokipedia: ${report.metadata.grokipediaUrl}
Wikipedia: ${report.metadata.wikipediaUrl}
Bias Level: ${report.metadata.biasLevel}
Analysis Depth: ${report.metadata.analysisDepth}
Cost: $${report.metadata.costUsd.toFixed(4)} USD (${report.metadata.costTrac.toFixed(2)} TRAC)
Private Access Fee: ${report.metadata.privateAccessFee.toFixed(2)} TRAC
Created: ${report.metadata.createdAt.toISOString()}
Status: ${publishStatus}

Full Knowledge Asset (JSON-LD):`;

      return {
        content: [
          { type: "text", text },
          {
            type: "text",
            text: JSON.stringify(report.knowledgeAsset, null, 2),
          },
        ],
      };
    },
  );
};
