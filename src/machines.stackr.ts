import { StateMachine } from "@stackr/sdk/machine";
import genesisState from "../genesis-state.json";
import { transitions } from "./transitions";
import { TradeState } from "./state";

const STATE_MACHINES = {
  TradeState: "trade",
};

const tradeStateMachine = new StateMachine({
  id: STATE_MACHINES.TradeState,
  stateClass: TradeState,
  initialState: genesisState.state,
  on: transitions,
});

// the Operator is set in genesis state itself
// set Intial currentPrice for all the players
// set Intial walletBalance for all the users , as credits in genesis state

export { STATE_MACHINES, tradeStateMachine };
