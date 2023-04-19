import { Handler } from "@netlify/functions";
import { Call } from "../types";
import { CHAIN_LIST, Chain } from "../constants/chains";
import { providers, signers } from "../constants/providers";
import { IMulticall, multicall } from "../constants/contracts";
import { TransactionRequest, formatUnits } from "ethers";
import { StatusCodes } from "http-status-codes";

let calls: Call[] = [
  /**
     EXAMPLE:
     ```
     {
       allowFailure: false,
       target: poh.address,
       callData: pohI.encodeFunctionData(
                        "withdrawFeesAndRewards",
                        [beneficiary, humanityId, requestId, challengeId, round]
                    )
     }
    */
];

const getGasEstimate = async (
  chain: Chain,
  req: TransactionRequest
): Promise<bigint> => await signers[chain].estimateGas(req).catch(() => null);

export const handler: Handler = async () => {
  for (const chain of CHAIN_LIST) {
    let estimates = await Promise.all(
      calls.map(({ target, callData }) =>
        getGasEstimate(chain, { to: target, data: callData.toString() })
      )
    );

    calls = calls.filter((_, i) => estimates[i] !== null);
    estimates = estimates.filter((e) => e !== null);

    const maxGasPrice =
      !!process.env.GAS_PRICE_CEILING_WEI &&
      BigInt(process.env.GAS_PRICE_CEILING_WEI);
    const currentGasPrice = (await providers[chain].getFeeData()).gasPrice;
    const gasPrice =
      maxGasPrice && currentGasPrice > maxGasPrice
        ? maxGasPrice
        : currentGasPrice;

    const batch: Call[] = [];
    let totalGas = BigInt(0);
    for (let i = 0; i < calls.length; i++) {
      if (totalGas + estimates[i] > BigInt(3000000)) break;
      batch.push(calls[i]);
      totalGas += estimates[i];
    }

    if (!batch.length) continue;

    const tx = await multicall[chain].aggregate3(batch, {
      maxFeePerGas: gasPrice,
      maxPriorityFeePerGas: formatUnits(1, "gwei"),
      gasLimit: await getGasEstimate(chain, {
        to: await multicall[chain].getAddress(),
        data: IMulticall.encodeFunctionData("aggregate3", [batch]),
      }),
    });

    await tx.wait();
  }

  return {
    statusCode: StatusCodes.OK,
    body: JSON.stringify({ msg: "ok" }),
  };
};
