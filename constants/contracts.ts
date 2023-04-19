import { Multicall3, Multicall3__factory } from "../generated/contracts";
import { CHAIN_LIST, Chain } from "./chains";
import { signers } from "./providers";

enum Contracts {
  MULTICALL,
}

const CONTRACT_ADDRESSES: Record<Chain, Record<Contracts, string>> = {
  [Chain.MAINNET]: {
    [Contracts.MULTICALL]: "",
  },
  [Chain.GNOSIS]: {
    [Contracts.MULTICALL]: "",
  },
};

export const IMulticall = Multicall3__factory.createInterface();
export const multicall = CHAIN_LIST.reduce(
  (acc, chain) => ({
    ...acc,
    [chain]: Multicall3__factory.connect(
      CONTRACT_ADDRESSES[chain][Contracts.MULTICALL],
      signers[chain]
    ),
  }),
  {} as Record<Chain, Multicall3>
);
