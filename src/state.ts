import { State } from "@stackr/sdk/machine";
import { keccak256, solidityPackedKeccak256 } from "ethers";
import { MerkleTree } from "merkletreejs";

export type TradeLogs = {
  buyer: string;
  price: number;
  playerId: number;
  operation: "buy" | "sell";
};

export type TradeStateVariable = {
  hasTournamentStarted: boolean;
  operator: string;
  currentPrices: Record<number, number>;
  tradeLogs: TradeLogs[];
  walletBalances: Record<string, number>; // just credits
  userBalances: Record<string, number>; // walletBalance + worth of the player in portfolio
};

export class TradeStateTree {
  public hasTournamentStarted: boolean;
  public operator: string;

  public tradeMerkleTree: MerkleTree;
  public tradeLogs: TradeLogs[];

  public currentPricesTree: MerkleTree;
  public currentPrices: Record<number, number>;

  public walletBalancesTree: MerkleTree;
  public walletBalances: Record<string, number>;

  public userBalancesTree: MerkleTree;
  public userBalances: Record<string, number>;

  constructor(rawState: TradeStateVariable) {
    const {
      tradeLogMerkelTree,
      currentPricesMerkelTree,
      walletBalancesMerkelTree,
      userBalancesMerkelTree,
    } = this.createTree(rawState);
    this.tradeMerkleTree = tradeLogMerkelTree;
    this.tradeLogs = rawState.tradeLogs;

    this.currentPricesTree = currentPricesMerkelTree;
    this.currentPrices = rawState.currentPrices;

    this.walletBalancesTree = walletBalancesMerkelTree;
    this.walletBalances = rawState.walletBalances;

    this.userBalancesTree = userBalancesMerkelTree;
    this.userBalances = rawState.userBalances;

    this.hasTournamentStarted = rawState.hasTournamentStarted;
    this.operator = rawState.operator;
  }

  createTree(rawState: TradeStateVariable) {
    const hashedTradeLeaves = rawState.tradeLogs.map((tradeLog) => {
      return solidityPackedKeccak256(
        ["address", "uint256", "uint256", "string"],
        [tradeLog.buyer, tradeLog.price, tradeLog.playerId, tradeLog.operation]
      );
    });
    const tradeLogMerkelTree = new MerkleTree(hashedTradeLeaves, keccak256, {
      hashLeaves: false,
      sortLeaves: true,
      sortPairs: true,
    });

    const hashedCurrentPrices = Object.entries(rawState.currentPrices).map(
      ([playerId, price]) => {
        return solidityPackedKeccak256(
          ["uint256", "uint256"],
          [playerId, price]
        );
      }
    );
    const currentPricesMerkelTree = new MerkleTree(
      hashedCurrentPrices,
      keccak256,
      {
        hashLeaves: false,
        sortLeaves: true,
        sortPairs: true,
      }
    );

    const hashedWalletBalances = Object.entries(rawState.walletBalances).map(
      ([address, balance]) => {
        return solidityPackedKeccak256(
          ["address", "uint256"],
          [address, balance]
        );
      }
    );
    const walletBalancesMerkelTree = new MerkleTree(
      hashedWalletBalances,
      keccak256,
      {
        hashLeaves: false,
        sortLeaves: true,
        sortPairs: true,
      }
    );

    const hashedUserBalances = Object.entries(rawState.userBalances).map(
      ([address, balance]) => {
        return solidityPackedKeccak256(
          ["address", "uint256"],
          [address, balance]
        );
      }
    );
    const userBalancesMerkelTree = new MerkleTree(
      hashedUserBalances,
      keccak256,
      {
        hashLeaves: false,
        sortLeaves: true,
        sortPairs: true,
      }
    );

    return {
      tradeLogMerkelTree,
      currentPricesMerkelTree,
      walletBalancesMerkelTree,
      userBalancesMerkelTree,
    };
  }
}

export class TradeState extends State<TradeStateVariable, TradeStateTree> {
  constructor(state: TradeStateVariable) {
    super(state);
  }

  transformer() {
    return {
      wrap: () => {
        return new TradeStateTree(this.state);
      },
      unwrap: (wrappedState: TradeStateTree) => {
        return {
          hasTournamentStarted: wrappedState.hasTournamentStarted,
          operator: wrappedState.operator,
          currentPrices: wrappedState.currentPrices,
          tradeLogs: wrappedState.tradeLogs,
          walletBalances: wrappedState.walletBalances,
          userBalances: wrappedState.userBalances,
        };
      },
    };
  }

  getRootHash(): string {
    const wrappedState = this.transformer().wrap();

    const finalMerkleTree = new MerkleTree(
      [
        wrappedState.tradeMerkleTree.getHexRoot(),
        wrappedState.currentPricesTree.getHexRoot(),
        wrappedState.walletBalancesTree.getHexRoot(),
        wrappedState.userBalancesTree.getHexRoot(),
        keccak256(wrappedState.hasTournamentStarted.toString()),
        keccak256(wrappedState.operator),
      ],
      keccak256,
      {
        hashLeaves: false,
        sortLeaves: true,
        sortPairs: true,
      }
    );

    return finalMerkleTree.getHexRoot();
  }
}
