import inquirer from "inquirer";
import {
  ActionConfirmationStatus,
  ActionSchema,
  AllowedInputTypes,
  MicroRollup,
} from "@stackr/sdk";
import { Wallet } from "ethers";
import { stackrConfig } from "./stackr.config.ts";
import {
  Action,
  BalanceResponse,
  TradeArgs,
  TradeActionInput,
  TradeLogs,
  TradesResponse,
  StartTournamentInput,
} from "./cli-types.ts";

import dotenv from "dotenv";
import { Playground } from "@stackr/sdk/plugins";

import { TradeStateMachine, mru } from "./src/trade.ts";
import { schemas } from "./src/actions.ts";

const stfSchemaMap = {
  startTournament: schemas.startTournamentSchema,
  closeTournament: schemas.closeTournamentSchema,
  trade: schemas.tradeSchema,
};

dotenv.config();

Playground.init(mru);

const tradeStateMachine = mru.stateMachines.get<TradeStateMachine>("trade");

const accounts = {
  Operator: new Wallet(process.env.PRIVATE_KEY!),
  "Account 1": new Wallet(process.env.FIRST_KEY!),
  "Account 2": new Wallet(process.env.SECOND_KEY!),
};

let selectedWallet: Wallet;

const signMessage = async (
  wallet: Wallet,
  schema: ActionSchema,
  inputs: AllowedInputTypes
) => {
  const signature = await wallet.signTypedData(
    schema.domain,
    schema.EIP712TypedData.types,
    inputs
  );
  return signature;
};

const actions = {
  checkBalance: async (): Promise<void> => {
    const currentState = tradeStateMachine?.state;
    if (!currentState) {
      console.log("No State found");
      return;
    }
    if (!currentState) {
      console.log("No State found");
      return;
    }
    const balance = currentState.walletBalances[selectedWallet.address];

    console.log(balance);
  },
  checkPortfolio: async (): Promise<void> => {
    const address = selectedWallet.address;
    const currentState = tradeStateMachine?.state;
    if (!currentState) {
      console.log("No State found");
      return;
    }
    const balance = currentState.userBalances[address];

    console.log(balance);
  },
  checkTrades: async (): Promise<void> => {
    const address = selectedWallet.address;
    const currentState = tradeStateMachine?.state;
    if (!currentState) {
      console.log("No State found");
      return;
    }
    const totalTradesforAddress = currentState.tradeLogs.filter(
      (trade) => trade.buyer == address
    );
    console.log(totalTradesforAddress);
  },
  checkMyPlayers: async (): Promise<void> => {
    const address = selectedWallet.address;
    const currentState = tradeStateMachine?.state;
    if (!currentState) {
      console.log("No State found");
      return;
    }
    const buyLogsForAddress = tradeStateMachine?.state.tradeLogs.filter(
      (trade) => trade.buyer === address && trade.operation === "buy"
    );

    // check if for these players user hasn't sold them after buying them
    const playersToSell = buyLogsForAddress?.filter((buytrade) => {
      const sellLog = tradeStateMachine?.state.tradeLogs.find(
        (sellTrade) =>
          sellTrade.buyer === address &&
          sellTrade.operation === "sell" &&
          sellTrade.playerId === buytrade.playerId &&
          sellTrade.timestamp > buytrade.timestamp
      );
      return !sellLog;
    });

    const playersForAddress = playersToSell
      ? playersToSell.map((trade) => trade.playerId)
      : [];

    console.log(playersForAddress);
  },
  startTournament: async (): Promise<void> => {
    const timestamp = Math.round(new Date().getTime() / 1000);
    const inputs: StartTournamentInput = {
      timestamp: timestamp,
    };
    const action = "startTournament";
    const schema = stfSchemaMap[action];
    console.log(schema);

    const signature = await signMessage(selectedWallet, schema, inputs);
    const createAction = schema.actionFrom({
      inputs,
      signature,
      msgSender: selectedWallet.address,
    });
    const ack = await mru.submitAction(action, createAction);
    ack.waitFor(ActionConfirmationStatus.C1);
    console.log("Tournament has been started");
    console.log(ack);
  },
  closeTournament: async (): Promise<void> => {
    const timestamp = Math.round(new Date().getTime() / 1000);
    const inputs: StartTournamentInput = {
      timestamp: timestamp,
    };
    const action = "closeTournament";
    const schema = stfSchemaMap[action];
    console.log(schema);

    const signature = await signMessage(selectedWallet, schema, inputs);
    const createAction = schema.actionFrom({
      inputs,
      signature,
      msgSender: selectedWallet.address,
    });
    const ack = await mru.submitAction(action, createAction);
    ack.waitFor(ActionConfirmationStatus.C1);
    console.log("Tournament has been closed");
    console.log(ack);
  },
  trade: async (playerId: number, operation: "buy" | "sell"): Promise<void> => {
    const timestamp = Math.round(new Date().getTime() / 1000);
    const inputs: TradeActionInput = {
      buyer: selectedWallet.address,
      playerId: playerId,
      operation: operation,
      timestamp: timestamp,
    };
    const action = "trade";
    const schema = stfSchemaMap[action];
    console.log(schema);

    const signature = await signMessage(selectedWallet, schema, inputs);
    const createAction = schema.actionFrom({
      inputs,
      signature,
      msgSender: selectedWallet.address,
    });
    const ack = await mru.submitAction(action, createAction);
    ack.waitFor(ActionConfirmationStatus.C1);
    console.log("Trade has been placed");
    console.log(ack);
  },
};

const askAccount = async (): Promise<
  "Operator" | "Account 1" | "Account 2"
> => {
  const response = await inquirer.prompt([
    {
      type: "list",
      name: "account",
      message: "Choose an account:",
      choices: ["Operator", "Account 1", "Account 2"],
    },
  ]);
  return response.account;
};

const askAction = async (): Promise<any> => {
  return inquirer.prompt([
    {
      type: "list",
      name: "action",
      message: "Choose an action:",
      choices: [
        "Check balance",
        "Check portfolio",
        "Check trades",
        "My players",
        "start Tournament",
        "close Tournament",
        "trade",
        "Switch account",
        "Exit",
      ],
    },
  ]);
};

const askAmount = async (action: Action): Promise<TradeArgs | {}> => {
  switch (action) {
    case "trade":
      const { operation } = await inquirer.prompt([
        {
          type: "list",
          name: "operation",
          message: "Enter the player to trade with:",
          choices: ["buy", "sell"],
        },
      ]);

      let players: string[] = [];
      const buyLogsForAddress = tradeStateMachine?.state.tradeLogs.filter(
        (trade) =>
          trade.buyer === selectedWallet.address && trade.operation === "buy"
      );

      // check if for these players user hasn't sold them after buying them
      const playersToSell = buyLogsForAddress?.filter((buytrade) => {
        const sellLog = tradeStateMachine?.state.tradeLogs.find(
          (sellTrade) =>
            sellTrade.buyer === selectedWallet.address &&
            sellTrade.operation === "sell" &&
            sellTrade.playerId === buytrade.playerId &&
            sellTrade.timestamp > buytrade.timestamp
        );
        return !sellLog;
      });

      const playersForAddress = playersToSell
        ? playersToSell.map((trade) => trade.playerId)
        : [];

      if (operation === "buy") {
        const allPlayers = Object.keys(tradeStateMachine?.state.currentPrices!);

        // Only show the players to the user which he hasn't bought yet
        players = allPlayers.filter((player) => {
          return !playersForAddress.includes(player);
        });
      } else if (operation === "sell") {
        players = playersForAddress;
      }

      const { playerId } = await inquirer.prompt([
        {
          type: "list",
          name: "playerId",
          message: "Enter the player to trade with:",
          choices: players,
        },
      ]);

      const price = tradeStateMachine?.state.currentPrices[playerId];
      console.log(`Current price for player ${playerId} is ${price}`);

      const { confirm } = await inquirer.prompt([
        {
          message: "Do you want to proceed ?",
          name: "confirm",
          type: "confirm",
        },
      ]);
      if (!confirm) {
        return Promise.resolve({});
      }

      return {
        operation: operation,
        playerId: playerId,
      };

    default:
      return Promise.resolve({});
  }
};

const main = async (): Promise<void> => {
  let exit = false;
  let selectedAccount: string = ""; // To store the selected account

  while (!exit) {
    if (!selectedAccount) {
      selectedAccount = await askAccount();
      if (
        selectedAccount === "Operator" ||
        selectedAccount === "Account 1" ||
        selectedAccount === "Account 2"
      ) {
        selectedWallet = accounts[selectedAccount];
        console.log(
          `You have selected: ${selectedWallet.address.slice(0, 12)}...`
        );
      }
    }

    const actionResponse = await askAction();
    const action: Action = actionResponse.action as Action;

    if (action === "Exit") {
      exit = true;
    } else if (action === "Switch account") {
      selectedAccount = ""; // Reset selected account so the user can choose again
    } else {
      const response = await askAmount(action);
      if (action === "Check balance") {
        await actions.checkBalance();
      } else if (action === "Check portfolio") {
        await actions.checkPortfolio();
      } else if (action === "Check trades") {
        await actions.checkTrades();
      } else if (action === "My players") {
        await actions.checkMyPlayers();
      } else if (action === "start Tournament") {
        await actions.startTournament();
      } else if (action === "close Tournament") {
        await actions.closeTournament();
      } else if (action === "trade") {
        const { operation, playerId } = response as TradeArgs;
        if (operation && playerId) {
          await actions.trade(playerId, operation);
        } else {
          exit = true;
        }
      }
    }
  }

  console.log("Exiting app...");
  process.exit(0);
};

main();
