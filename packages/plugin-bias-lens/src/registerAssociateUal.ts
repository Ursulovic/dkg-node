import { type DkgPlugin } from "@dkg/plugins";
import { z } from "@dkg/plugin-swagger";

import { reportStore } from "./store/index.js";

const title = "Associate UAL with Report";
const name = "associate-ual-with-report";
const description = `Associates a DKG UAL with a bias report after publishing.

**Preferred method:** Use 'save-bias-report' instead - it handles publishing AND UAL association in one step.

**When to use this tool:** Only if you published using the essentials plugin's 'DKG Knowledge Asset create' tool directly.

**Input:**
- reportIri: The report IRI from detect-bias (e.g., https://bias-lens.neuroweb.ai/report/{uuid})
- ual: The UAL returned from DKG publishing

**Output:** Confirmation that UAL has been linked to the report.`;

const inputSchema = {
  reportIri: z.string().describe("Report IRI from detect-bias (e.g., https://bias-lens.neuroweb.ai/report/{uuid})"),
  ual: z.string().describe("UAL returned from DKG Knowledge Asset create tool"),
};

export const registerAssociateUal: DkgPlugin = (_, mcp) => {
  mcp.registerTool(
    name,
    { title, description, inputSchema },
    async ({ reportIri, ual }) => {
      const report = await reportStore.get(reportIri);

      if (!report) {
        return {
          content: [
            {
              type: "text",
              text: `Error: Report not found with IRI: ${reportIri}\n\nPlease verify the IRI. Use 'list-bias-reports' to see available reports.`,
            },
          ],
        };
      }

      const explorerUrl = `https://dkg-testnet.origintrail.io/explore?ual=${encodeURIComponent(ual)}`;
      await reportStore.updateUal(reportIri, ual, explorerUrl);

      const text = `Successfully associated UAL with report!

Report IRI: ${reportIri}
UAL: ${ual}
Report Title: ${report.metadata.title}

The report is now published to DKG and can be retrieved using either the report IRI or the UAL.`;

      return {
        content: [{ type: "text", text }],
      };
    },
  );
};
