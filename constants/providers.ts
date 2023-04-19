import { JsonRpcProvider, Provider, Signer, Wallet } from "ethers";
import { CHAIN_LIST, Chain } from "./chains";

const { PRIVATE_KEY } = process.env;

const RPC: Record<Chain, string> = {
  [Chain.MAINNET]: "",
  [Chain.GNOSIS]: "https://rpc.gnosis.gateway.fm",
};

export const providers = CHAIN_LIST.reduce(
  (acc, chain) => ({
    ...acc,
    [chain]: new JsonRpcProvider(RPC[chain]),
  }),
  {} as Record<Chain, Provider>
);

export const signers = CHAIN_LIST.reduce(
  (acc, chain) => ({
    ...acc,
    [chain]: new Wallet(PRIVATE_KEY!, providers[chain]),
  }),
  {} as Record<Chain, Signer>
);
