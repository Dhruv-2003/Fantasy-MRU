export type Action =
  | "Check balance"
  | "Check portfolio"
  | "Check trades"
  | "My players"
  | "start Tournament"
  | "close Tournament"
  | "trade"
  | "Switch account"
  | "Exit";

export interface BalanceResponse {
  address: string;
  balance: number;
}

export interface TradeArgs {
  playerId: number;
  operation: "buy" | "sell";
}

export type TradeLogs = {
  buyer: string;
  price: number;
  playerId: number;
  operation: "buy" | "sell";
  timestamp: number;
};

export interface TradesResponse {
  tradeLogs: TradeLogs[];
}

export type StartTournamentInput = {
  timestamp: number;
};

export type TradeActionInput = {
  buyer: string;
  playerId: number;
  operation: "buy" | "sell";
  timestamp: number;
};
