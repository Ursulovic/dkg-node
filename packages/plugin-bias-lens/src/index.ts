import "dotenv/config";

import { defineDkgPlugin } from "@dkg/plugins";
import { registerTopicResearcher } from "./registerTopicResearcher";
import { registerBiasDetector } from "./registerBiasDetector";

export default defineDkgPlugin((...args) => {
  registerTopicResearcher(...args);
  registerBiasDetector(...args);
});
