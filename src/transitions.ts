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
  playerId: string;
  operation: "buy" | "sell";
  timestamp: number;
};

// --------- State Transition Handlers ---------
const startTournament: STF<TradeState, StartTournamentInput> = {
  handler: ({ inputs, state, emit, msgSender }) => {
    state;
    const { timestamp } = inputs;
    if (state.hasTournamentStarted == true) {
      throw new Error("Tournament Already started");
    }

    // check for operator
    if (msgSender != state.operator) {
      throw new Error("Only operator can start the tournament");
    }

    emit({ name: "TournamentStarted", value: timestamp });
    state.hasTournamentStarted = true;
    state.tournamentStartTime = timestamp;
    return state;
  },
};

const closeTournament: STF<TradeState, StartTournamentInput> = {
  handler: ({ inputs, state, emit, msgSender }) => {
    state;
    const { timestamp } = inputs;
    if (
      state.hasTournamentClosed == true &&
      state.hasTournamentStarted == false
    ) {
      throw new Error("Tournament Already closed or not started");
    }

    // check for operator
    if (msgSender != state.operator) {
      throw new Error("Only operator can start the tournament");
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

    // atleast check they are whitelisted to play in the tournament
    if (state.walletBalances[buyer] == undefined) {
      throw new Error(
        "User not whitelisted to play in the tournament or No Balance"
      );
    }

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
    } else {
      throw new Error("Tournament has not started yet");
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

    // add the trade log
    state.tradeLogs.push({
      buyer,
      playerId,
      operation,
      timestamp,
      price: state.currentPrices[playerId],
    });

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
const updateCurrentPrice: Hook<TradeState> = {
  handler: ({ state }) => {
    // update the current price of all the players
    // current Price -> 100 - matchScore
    const matchScore = 50;
    // Object.entries(state.currentPrices).forEach(([playerId, price]) => {
    //   state.currentPrices[playerId] = 100 - matchScore;
    // });

    return state;
  },
};

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
          // check if the user has bought the player and not sold it , then add the player worth to the user balance
          if (log.operation == "buy") {
            userBalance += currentPrices[log.playerId];
          } else if (log.operation == "sell") {
            // check if the user has sold the player and not bought it , then subtract the player worth from the user balance
            userBalance -= currentPrices[log.playerId];
          }
        });
      state.userBalances[address] = userBalance;
    });

    return state;
  },
};

export const hooks: Hooks<TradeState> = {
  updateUserBalances,
};
