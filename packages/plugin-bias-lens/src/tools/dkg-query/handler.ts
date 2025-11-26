import type { DkgClient, DkgQueryInput, DkgQueryResult } from "./types.js";
import { runDkgQueryAgent } from "./agent/index.js";

export const dkgQueryHandler = async (
  input: DkgQueryInput,
  dkgClient: DkgClient
): Promise<DkgQueryResult> => {
  return runDkgQueryAgent(input, dkgClient);
};
