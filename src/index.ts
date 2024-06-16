import express, { Request, Response } from "express";

import { ActionEvents } from "@stackr/sdk";
import { Playground } from "@stackr/sdk/plugins";
import dotenv from "dotenv";
import { schemas } from "./actions.ts";
import { TradeStateMachine, mru } from "./trade.ts";
import { transitions } from "./transitions.ts";

console.log("Starting server...");
dotenv.config();

const tradeStateMachine = mru.stateMachines.get<TradeStateMachine>("trade");

const app = express();
app.use(express.json());

if (process.env.NODE_ENV === "development") {
  const playground = Playground.init(mru);

  playground.addGetMethod(
    "/custom/hello",
    async (_req: Request, res: Response) => {
      res.json({
        message: "Hello from the custom route",
      });
    }
  );
}

const { actions, chain, events } = mru;

events.subscribe(ActionEvents.SUBMIT, (args) => {
  console.log("Submitted an action", args);
});

events.subscribe(ActionEvents.EXECUTION_STATUS, async (action) => {
  console.log("Submitted an action", action);
});

app.get("/actions/:hash", async (req: Request, res: Response) => {
  const { hash } = req.params;
  const action = await actions.getByHash(hash);
  if (!action) {
    return res.status(404).send({ message: "Action not found" });
  }
  return res.send(action);
});

app.get("/blocks/:hash", async (req: Request, res: Response) => {
  const { hash } = req.params;
  const block = await chain.getBlockByHash(hash);
  if (!block) {
    return res.status(404).send({ message: "Block not found" });
  }
  return res.send(block);
});

app.post("/:reducerName", async (req: Request, res: Response) => {
  const { reducerName } = req.params;
  const actionReducer = transitions[reducerName];

  if (!actionReducer) {
    res.status(400).send({ message: "̦̦no reducer for action" });
    return;
  }
  const action = reducerName as keyof typeof schemas;

  const { msgSender, signature, inputs } = req.body;

  const schema = schemas[action];

  try {
    const newAction = schema.actionFrom({ msgSender, signature, inputs });
    const ack = await mru.submitAction(reducerName, newAction);
    res.status(201).send({ ack });
  } catch (e: any) {
    res.status(400).send({ error: e.message });
  }
  return;
});

app.get("/", (_req: Request, res: Response) => {
  return res.send({ state: tradeStateMachine?.state });
});

app.get("/balance/:address", (_req: Request, res: Response) => {
  const { address } = _req.params;
  const currentState = tradeStateMachine?.state;
  if (!currentState) {
    res.status(400).send({ message: "No State found" });
    return;
  }
  const balance = currentState.walletBalances[address];

  return res.send({ address: address, balance: balance });
});

app.get("/portfolio/:address", (_req: Request, res: Response) => {
  const { address } = _req.params;
  const currentState = tradeStateMachine?.state;
  if (!currentState) {
    res.status(400).send({ message: "No State found" });
    return;
  }
  const balance = currentState.userBalances[address];

  return res.send({ address: address, balance: balance });
});

app.get("/trades/:address", (_req: Request, res: Response) => {
  const { address } = _req.params;
  const currentState = tradeStateMachine?.state;
  if (!currentState) {
    res.status(400).send({ message: "No State found" });
    return;
  }
  const totalTradesforAddress = currentState.tradeLogs.filter(
    (trade) => trade.buyer == address
  );
  return res.send({ address: address, trades: totalTradesforAddress });
});

app.get("/players/:address", (_req: Request, res: Response) => {
  const { address } = _req.params;
  const currentState = tradeStateMachine?.state;
  if (!currentState) {
    res.status(400).send({ message: "No State found" });
    return;
  }
  let playersForAddress: any[] = [];

  // check all the trades , select the ones which buyers has bought, and still not sold
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

  playersForAddress = playersToSell
    ? playersToSell.map((trade) => trade.playerId)
    : [];

  return res.send({ address: address, trades: playersForAddress });
});

app.listen(3000, () => {
  console.log("listening on port 3000");
});
