import { Transitions, STF, Hooks, Hook } from "@stackr/sdk/machine";
import { TradeState, TradeStateTree as StateWrapper } from "./state";

// --------- Utilities ---------
const getTradeLogsForAddress = (address: string, state: StateWrapper) => {
  return state.tradeLogs.filter((log) => log.buyer == address);
};

// --------- Input Types ---------
type StartTournamentInput = {
  timestamp: number;
};

type TradeActionInput = {
  buyer: string;
  playerId: number;
  operation: "buy" | "sell";
  timestamp: number;
};

// --------- State Transition Handlers ---------
const startTournament: STF<TradeState, StartTournamentInput> = {
  handler: ({ inputs, state, emit }) => {
    state;
    const { timestamp } = inputs;
    if (state.hasTournamentStarted == true) {
      throw new Error("Tournament Already started");
    }
    emit({ name: "TournamentStarted", value: timestamp });
    state.hasTournamentStarted = true;
    state.tournamentStartTime = timestamp;
    return state;
  },
};

const closeTournament: STF<TradeState, StartTournamentInput> = {
  handler: ({ inputs, state, emit }) => {
    state;
    const { timestamp } = inputs;
    if (
      state.hasTournamentClosed == true &&
      state.hasTournamentStarted == false
    ) {
      throw new Error("Tournament Already closed or not started");
    }
    emit({ name: "TournamentClosed", value: timestamp });
    state.hasTournamentClosed = true;
    return state;
  },
};

const trade: STF<TradeState, TradeActionInput> = {
  handler: ({ inputs, state }) => {
    const { buyer, playerId, operation, timestamp } = inputs;

    const tradeLogs = getTradeLogsForAddress(buyer, state);

    // check if the tournament is closed
    if (state.hasTournamentClosed) {
      throw new Error("Tournament is closed");
    }

    // check if the tournamet has started
    if (state.hasTournamentStarted) {
      // check if the user has done less than 10 trades after it started
      const tradeLogsInTrunament = tradeLogs.filter(
        (log) => log.timestamp >= state.tournamentStartTime
      );
      if (tradeLogsInTrunament.length >= 10) {
        throw new Error("Max trades limit reached");
      }
    }

    // perform action for the operation
    if (operation == "buy") {
      // check balance of the user
      if (state.walletBalances[buyer] < state.currentPrices[playerId]) {
        throw new Error("Insufficient balance");
      }

      // check is user hasn't already bought the player
      const buyLogsPlayer = tradeLogs.filter((log) => log.playerId == playerId);
      if (buyLogsPlayer.length > 0) {
        // check if the last record is buy for this player or not
        if (buyLogsPlayer[buyLogsPlayer.length - 1].operation == "buy") {
          throw new Error("Player already bought");
        }
      }

      // update the user balance
      state.walletBalances[buyer] -= state.currentPrices[playerId];
    } else if (operation == "sell") {
      // check that user should have this player to sell
      const buyLogsPlayer = tradeLogs.filter((log) => log.playerId == playerId);
      if (buyLogsPlayer.length == 0) {
        throw new Error("Player not bought");
      } else {
        // check if the last record is sell for this player or not
        if (buyLogsPlayer[buyLogsPlayer.length - 1].operation == "sell") {
          throw new Error("Player already sold");
        }
      }

      // update the user balance & credit the amount back to the user profile
      state.walletBalances[buyer] += state.currentPrices[playerId];
    } else {
      throw new Error("Invalid operation");
    }

    return state;
  },
};

export const transitions: Transitions<TradeState> = {
  startTournament,
  closeTournament,
  trade,
};

// --------- Hooks ---------

// Updates the current Price according to the match Score

// Updates the user balance before and after every trade

const updateUserBalances: Hook<TradeState> = {
  handler: ({ state }) => {
    // update the user balance for all the wallets
    // user Balance -> Wallet Balance + Portfolio worth

    const walletBalances = state.walletBalances;
    const currentPrices = state.currentPrices;
    const tradeLogs = state.tradeLogs;

    Object.entries(walletBalances).forEach(([address, balance]) => {
      let userBalance = balance;
      tradeLogs
        .filter((log) => log.buyer == address)
        .forEach((log) => {
          if (log.operation == "buy") {
            userBalance -= currentPrices[log.playerId];
          } else {
            userBalance += currentPrices[log.playerId];
          }
        });
      state.userBalances[address] = userBalance;
    });

    return state;
  },
};

export const hooks: Hooks<TradeState> = {};
