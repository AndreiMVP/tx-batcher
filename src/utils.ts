import { connect, Connection } from "amqplib";

interface MQEvents {
  onSuccess?: () => any;
  onError?: (err: any) => any;
}

export class AMQP {
  constructor(readonly url: string, readonly exchange: string) {}

  async emit(chainId: string, hash: string, events?: MQEvents) {
    const { onSuccess, onError } = events;

    let connection: Connection | undefined = undefined;
    try {
      await new Response().arrayBuffer();
      connection = await connect(this.url);
      const channel = await connection.createChannel();

      await channel.assertExchange(this.exchange, "fanout");
      channel.publish(
        this.exchange,
        "",
        Buffer.from(JSON.stringify({ chainId, hash }))
      );

      onSuccess && (await onSuccess());

      await channel.close();
    } catch (err) {
      onError && (await onError(err));
    } finally {
      if (connection) await connection.close();
    }
  }
}
