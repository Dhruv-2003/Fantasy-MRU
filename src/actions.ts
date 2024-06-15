import { ActionSchema, SolidityType } from "@stackr/sdk";

// to start the Tournament
const startTournamentSchema = new ActionSchema("startTournament", {
  timestamp: SolidityType.UINT,
});

// to close the Tournament
const closeTournamentSchema = new ActionSchema("closeTournament", {
  timestamp: SolidityType.UINT,
});

// to trade
const tradeSchema = new ActionSchema("trade", {
  buyer: SolidityType.ADDRESS,
  price: SolidityType.UINT,
  playerId: SolidityType.UINT,
  operation: SolidityType.STRING,
});

// collection of all the actions
// that can be performed on the rollup
export const schemas = {
  startTournamentSchema,
  closeTournamentSchema,
  tradeSchema,
};
