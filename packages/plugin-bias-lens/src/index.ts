import "dotenv/config";

import { defineDkgPlugin } from "@dkg/plugins";
import { registerTopicResearcher } from "./registerTopicResearcher";
import { registerBiasDetector } from "./registerBiasDetector";
import { registerSaveBiasReport } from "./registerSaveBiasReport";
import { registerAssociateUal } from "./registerAssociateUal";
import { registerListReports } from "./registerListReports";
import { registerGetReport } from "./registerGetReport";
import { registerGetReputation } from "./registerGetReputation";
import { registerVoteOnReport } from "./registerVoteOnReport";

export default defineDkgPlugin((...args) => {
  registerTopicResearcher(...args);
  registerBiasDetector(...args);
  registerSaveBiasReport(...args);
  registerAssociateUal(...args);
  registerListReports(...args);
  registerGetReport(...args);
  registerGetReputation(...args);
  registerVoteOnReport(...args);
});
