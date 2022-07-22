import { Socket } from "net";
import { hostname as hostnameF } from "os";

export default class ZabbixSender implements ZabbixSenderRequestBasics {
  private _hostname: string = "localhost";
  public get hostname(): string {
    return this._hostname;
  }
  private _host: string = "localhost";
  public get host(): string {
    return this._host;
  }
  private _port: number;
  public get port(): number {
    return this._port;
  }
  private _timeout: number;
  public get timeout(): number {
    return this._timeout;
  }
  private _nsTiming: boolean;
  public get nsTiming(): boolean {
    return this._nsTiming;
  }
  private _timestamps: boolean;
  public get timestamps(): boolean {
    return this._timestamps;
  }

  constructor(
    host: string,
    port: number = 10051,
    timeout: number = 5000,
    timestamps: boolean = false,
    nsTiming: boolean = false,
    hostname: string = hostnameF()
  ) {
    this._host = host;
    this._port = port;
    this._timeout = timeout;
    this._nsTiming = nsTiming;
    this._timestamps = timestamps;
    this._hostname = hostname;

    if (this.nsTiming && !this.timestamps) {
      this._timestamps = true;
    }
  }
  
  public add(data: ZabbixSenderItem): ZabbixSenderRequest;
  public add(key: string, value: number): ZabbixSenderRequest;
  public add(
    key: string,
    value: number,
    hostname?: string
  ): ZabbixSenderRequest;
  public add(
    key: string,
    value: number,
    timestamp: number
  ): ZabbixSenderRequest;
  public add(
    key: string,
    value: number,
    timestamp: number,
    hostname: string
  ): ZabbixSenderRequest;
  public add(
    key: string,
    value: number,
    timestamp: number,
    ns: number,
    hostname: string
  ): ZabbixSenderRequest;
  public add(
    key: string | ZabbixSenderItem,
    value?: number,
    timestamp?: number | string,
    ns?: number | string,
    hostname?: string
  ): ZabbixSenderRequest {
    return new ZabbixSenderRequest(this).add(
      key as any,
      value as any,
      timestamp as any,
      ns as any,
      hostname as any
    );
  }
  public send(data: ZabbixSenderItem): Promise<ZabbixSenderResponse>;
  public send(key: string, value: number): Promise<ZabbixSenderResponse>;
  public send(
    key: string,
    value: number,
    hostname?: string
  ): Promise<ZabbixSenderResponse>;
  public send(
    key: string,
    value: number,
    timestamp: number
  ): Promise<ZabbixSenderResponse>;
  public send(
    key: string,
    value: number,
    timestamp: number,
    hostname: string
  ): Promise<ZabbixSenderResponse>;
  public send(
    key: string,
    value: number,
    timestamp: number,
    ns: number,
    hostname: string
  ): Promise<ZabbixSenderResponse>;
  public send(
    key: string | ZabbixSenderItem,
    value?: number,
    timestamp?: number | string,
    ns?: number | string,
    hostname?: string
  ): Promise<ZabbixSenderResponse> {
    return new ZabbixSenderRequest(this)
      .add(
        key as any,
        value as any,
        timestamp as any,
        ns as any,
        hostname as any
      )
      .send();
  }
}

export interface ZabbixSenderItem {
  host: string;
  key: string;
  value: number;
  clock?: number;
  ns?: number;
}
export interface ZabbixSenderResponse {
  response: string;
  info: string;
}

class ZabbixSenderRequest implements ZabbixSenderRequestBasics {
  private closed: boolean = false;
  private listOfItems: Array<ZabbixSenderItem> = [];
  private sender: ZabbixSender;
  constructor(sender: ZabbixSender) {
    this.sender = sender;
  }

  public get length(): number {
    return this.listOfItems.length;
  }
  public get items(): Array<ZabbixSenderItem> {
    return this.listOfItems;
  }

  public add(data: ZabbixSenderItem): ZabbixSenderRequest;
  public add(key: string, value: number): ZabbixSenderRequest;
  public add(
    key: string,
    value: number,
    hostname?: string
  ): ZabbixSenderRequest;
  public add(
    key: string,
    value: number,
    timestamp: number
  ): ZabbixSenderRequest;
  public add(
    key: string,
    value: number,
    timestamp: number,
    hostname: string
  ): ZabbixSenderRequest;
  public add(
    key: string,
    value: number,
    timestamp: number,
    ns: number,
    hostname: string
  ): ZabbixSenderRequest;
  public add(
    key: string | ZabbixSenderItem,
    value?: number,
    timestamp?: number | string,
    ns?: number | string,
    hostname?: string
  ): ZabbixSenderRequest {
    if (this.closed)
      throw "Data has already been sent. use ZabbixSender.add() to start a new chain.";
    if (typeof key === "string") {
      let newItem: ZabbixSenderItem = {
        host: this.sender.hostname,
        key: key,
        value: value as number,
      };
      if (typeof timestamp === "string") {
        newItem.host = timestamp;
      } else if (typeof ns === "string") {
        newItem.host = ns;
      } else if (typeof hostname === "string") {
        newItem.host = hostname;
      }
      if (this.sender.timestamps) {
        if (typeof timestamp === "number") {
          newItem.clock = timestamp;
        } else {
          newItem.clock = Date.now() / 1000;
        }
        if (this.sender.nsTiming) {
          if (typeof ns === "number") {
            newItem.ns = ns;
          } else {
            newItem.ns = (newItem.clock % 1) * 1000 * 1000000;
          }
        }
      }
      this.listOfItems.push(newItem);
      return this;
    }
    this.listOfItems.push(key);
    return this;
  }

  public async send(): Promise<ZabbixSenderResponse> {
    if (this.closed)
      throw "Data has already been sent. use ZabbixSender.add() to start a new chain.";
    const self = this,
      client = new Socket();

    let response = Buffer.alloc(0);
    let error: any = null;

    return new Promise<any>((resolve, reject) => {
      client.setTimeout(self.sender.timeout);
      client.connect(self.sender.port, self.sender.host, function () {
        client.write(self.prepareData());
      });

      client.on("data", (data: any) => {
        response = Buffer.concat([response, data]);
      });

      client.on("timeout", () => {
        client.destroy();
        error = new Error(
          "socket timed out after " + self.sender.timeout / 1000 + " seconds"
        );
      });

      client.on("error", (err: any) => (error = err));

      client.on("close", function () {
        // bail out on any error
        if (error) {
          return reject(error);
        }

        // bail out if got wrong response
        if (response.subarray(0, 5).toString() !== "ZBXD\x01") {
          return reject(new Error("got invalid response from server"));
        }

        // all clear, return the result
        self.closed = true;
        resolve(JSON.parse(response.subarray(13).toString("utf8")));
      });
    });
  }

  private prepareData() {
    var data: any = {
      request: "sender data",
      data: this.listOfItems,
    };

    if (this.sender.timestamps) {
      data.clock = Date.now() / 1000;
    }
    if (this.sender.nsTiming) {
      data.ns = (data.clock % 1) * 1000 * 1000000;
    }

    var payload = Buffer.from(JSON.stringify(data), "utf8"),
      header = Buffer.alloc(5 + 4); // ZBXD\1 + packed payload.length

    header.write("ZBXD\x01");
    header.writeInt32LE(payload.length, 5);
    return Buffer.concat([header, Buffer.from("\x00\x00\x00\x00"), payload]);
  }
}

export interface ZabbixSenderRequestBasics {
  add(data: ZabbixSenderItem): ZabbixSenderRequest;
  add(key: string, value: number): ZabbixSenderRequest;
  add(key: string, value: number, hostname?: string): ZabbixSenderRequest;
  add(key: string, value: number, timestamp: number): ZabbixSenderRequest;
  add(
    key: string,
    value: number,
    timestamp: number,
    hostname: string
  ): ZabbixSenderRequest;
  add(
    key: string,
    value: number,
    timestamp: number,
    ns: number,
    hostname: string
  ): ZabbixSenderRequest;
  add(
    key: string | ZabbixSenderItem,
    value?: number,
    timestamp?: number | string,
    ns?: number | string,
    hostname?: string
  ): ZabbixSenderRequest;
}
