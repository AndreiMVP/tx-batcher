import {
  ContractTransactionResponse,
  JsonRpcProvider,
  Provider,
  Signer,
  TransactionRequest,
  Wallet,
  formatUnits,
} from "ethers";
import { Multicall3, Multicall3__factory } from "./generated/contracts";
import { Logtail } from "@logtail/node";
import { AMQP } from "./utils";

type Call = Multicall3.Call3Struct;
const IMulticall = Multicall3__factory.createInterface();

interface MultiCallerInterface {
  rpcUrl: string;
  privateKey: string;
  multicall3Address: string;
  gasPriceCeilingWei?: string | number | bigint;
  logtailSourceToken?: string;
  amqp?: { url: string; exchange: string };
}

export default class MultiCaller {
  private readonly gasPriceCeiling?: bigint;

  private readonly provider: Provider;
  private readonly signer: Signer;
  private readonly contract: Multicall3;

  private readonly calls: Call[];

  private readonly logtail?: Logtail;
  private readonly amqp?: AMQP;

  constructor({
    rpcUrl,
    privateKey,
    gasPriceCeilingWei,
    multicall3Address,
    logtailSourceToken,
    amqp,
  }: MultiCallerInterface) {
    this.provider = new JsonRpcProvider(rpcUrl);
    this.signer = new Wallet(privateKey, this.provider);

    this.contract = Multicall3__factory.connect(multicall3Address, this.signer);

    this.gasPriceCeiling = gasPriceCeilingWei && BigInt(gasPriceCeilingWei);

    this.calls = [];

    this.logtail = logtailSourceToken && new Logtail(logtailSourceToken);
    this.amqp = amqp && new AMQP(amqp.url, amqp.exchange);
  }

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
  add(...calls: Call[]) {
    this.calls.push(...calls);
  }

  private async gasEstimate(req: TransactionRequest): Promise<bigint> {
    return await this.signer.estimateGas(req).catch(() => null);
  }

  private async batchGasEstimate() {
    return await Promise.all(
      this.calls.map(({ target, callData }) =>
        this.gasEstimate({ to: target, data: callData.toString() })
      )
    );
  }

  private async gasPrice() {
    const currentGasPrice = (await this.provider.getFeeData()).gasPrice;
    return this.gasPriceCeiling && currentGasPrice > this.gasPriceCeiling
      ? this.gasPriceCeiling
      : currentGasPrice;
  }

  private async filtered() {
    const estimates = await this.batchGasEstimate();

    return {
      calls: this.calls.filter((_, i) => estimates[i] !== null),
      estimates: estimates.filter((e) => e !== null),
    };
  }

  async send(): Promise<ContractTransactionResponse | null> {
    const filtered = await this.filtered();

    const batch: Call[] = [];
    let totalGas = BigInt(0);
    for (let i = 0; i < this.calls.length; i++) {
      if (totalGas + filtered.estimates[i] > BigInt(3000000)) break;
      batch.push(this.calls[i]);
      totalGas += filtered.estimates[i];
    }

    if (!batch.length) return null;

    const tx = await this.contract.aggregate3(batch, {
      maxFeePerGas: await this.gasPrice(),
      maxPriorityFeePerGas: formatUnits(1, "gwei"),
      gasLimit: await this.gasEstimate({
        to: await this.contract.getAddress(),
        data: IMulticall.encodeFunctionData("aggregate3", [batch]),
      }),
    });

    await this.notifyServices(tx);

    return tx;
  }

  private async notifyServices({
    chainId,
    hash,
    blockNumber,
    nonce,
  }: ContractTransactionResponse) {
    if (this.logtail) {
      await this.logtail.info("MultiCall TX", {
        chainId: chainId.toString(),
        hash,
        blockNumber,
        nonce,
      });

      if (this.amqp)
        await this.amqp.emit(chainId.toString(), hash, {
          onSuccess: async () =>
            await this.logtail.info("MultiCall AMQP Message", {
              exchange: this.amqp.exchange,
              chainId: chainId.toString(),
              hash,
            }),
          onError: async (err) =>
            await this.logtail.error("MultiCall AMQP Error", {
              exchange: this.amqp.exchange,
              chainId: chainId.toString(),
              hash,
              err: err.message || "",
            }),
        });

      await this.logtail.flush();
    } else {
      console.log("MultiCall TX", {
        chainId: chainId.toString(),
        hash,
        blockNumber,
        nonce,
      });

      if (this.amqp) {
        await this.amqp.emit(chainId.toString(), hash, {
          onSuccess: () =>
            console.log(`MultiCall AMQP message`, {
              exchange: this.amqp.exchange,
              chainId,
              hash,
            }),
          onError: (err) => console.error("MultiCall AMQP Error", err),
        });
      }
    }
  }
}
