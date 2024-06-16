import { MicroRollup } from "@stackr/sdk";
import { stackrConfig } from "../stackr.config.ts";

import { schemas } from "./actions.ts";
import { tradeStateMachine } from "./machines.stackr.ts";

type TradeStateMachine = typeof tradeStateMachine;

const mru = await MicroRollup({
  config: stackrConfig,
  actionSchemas: [
    schemas.startTournamentSchema,
    schemas.closeTournamentSchema,
    schemas.tradeSchema,
  ],
  stateMachines: [tradeStateMachine],
  stfSchemaMap: {
    startTournament: schemas.startTournamentSchema,
    closeTournament: schemas.closeTournamentSchema,
    trade: schemas.tradeSchema,
  },
  blockHooks: {
    pre: [],
    post: ["updateUserBalances"],
  },
  isSandbox: true,
});

await mru.init();

export { TradeStateMachine, mru };
