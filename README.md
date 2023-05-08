# MulticallRelayer

Adds multiple calldatas to a batch and calls [**Multicall3**](https://github.com/mds1/multicall/blob/main/src/Multicall3.sol) contract's [`aggregate3`](https://github.com/mds1/multicall/blob/main/src/Multicall3.sol#L98-L123) function.

## Installing
```sh
$ yarn add @kleros/multicall-relayer
```

## Using it
#### Create MultiCaller
```js
import MultiCaller from "@kleros/multicall-relayer"

const multicaller = new MultiCaller({
    rpcUrl,
    privateKey,
    multicall3Address,
    gasPriceCeilingWei, // optional
    logtailSourceToken, // optional
    amqp: { url, exchange } // optional
})
```

#### Add call to be batched
```js
multicaller.add({
    allowFailure: false,
    target: poh.address,
    callData: pohI.encodeFunctionData(
                "withdrawFeesAndRewards",
                [beneficiary, humanityId, requestId, challengeId, round]
                )
})

// Or multiple calls...
multicaller.add(...calls)
```

#### Send the transaction!
```js
const tx = await multicaller.send()
```

### Constructor arguments
- `rpcUrl` - url of the rpc to be used.
- `privateKey` - private key of wallet to execute the transaction.
- `multicall3Address` - Multicall3 contract address on the chain corresponding to the given rpc.
- `gasPriceCeilingWei` *(optional)* - gas price ceiling in wei.
- `logtailSourceToken` *(optional)* - Logtail token to send logs to. If missing, `console.log` is used.
- `amqp` *(optional)* - AMQP to be notified once the transaction is sent to the blockchain. Requires 2 parameters:
  - `url` - url of the provider.
  - `exchange` - name of the exchange.