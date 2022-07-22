### About this library

The library is an implementation of `zabbix_sender` utility, which sends items data to zabbix server
using the zabbix `trapper` protocol. Because the library is a pure Node.js/Typescript implementation, it doesn't
require invocation of `zabbix_sender` utility. So there is no any `child_process` involved!

### Basic usage example

```typescript
import { ZabbixSender } from '@bettercorp/node-zabbix-sender'
const Sender = new ZabbixSender('zabbix.example.com');

// Add items to request
let req = Sender.add('webserver', 'httpd.running', 0);
req.add('mysql.ping', 1, 'dbserver');

// Add item with default host
req.add('httpd.logs.size', 1024);

// Add item with timestamp 
req.add('httpd.running', 1, 1634645976, 'webserver');

// Add item with timestamp and nanoseconds
req.add('mysql.ping', 0, 1634645976, 758000000, 'dbserver');

// Add item with default host with timestamp. The host has to be set to an empty string in this case.
req.add('httpd.logs.size', 1024, 1634645976);

// Send the items to zabbix trapper
console.dir(await req.send());
```

### Another example, with `addItem` & `send` combined

```typescript
import { ZabbixSender } from '@bettercorp/node-zabbix-sender'  
const Sender = new ZabbixSender('zabbix.example.com');  

// Here is an example: add item and & send it  
console.log(await Sender.add('cpu_load', 0.15).send());  

// Or just send a single item quickly  
console.log(await Sender.send('cpu_load', 0.15));
```

### Instance options

Whenever you create a new instance of zabbix sender, there are several property options:

```typescript 
(host: string, port: number = 10051, timeout: number = 5000, timestamps: boolean = false, nsTiming: boolean = false, hostname: string = hostname()))
```  

- **`host`** and **`port`** are self-explanatory, the zabbix server host & port
- **`timeout`** is a socket timeout in milliseconds, when connecting to the zabbix server
- **`timestamps`** when you `add`, timestamp will be added as well
- **`nsTiming`** will set `timestamps` to true, nanoseconds portion of the timestamp seconds will be added to the item
- **`hostname`** a target monitored host in zabbix. used when you don't specify the host when you `add`, see example above

### Instance methods

```typescript
(item: ZabbixSenderItem)  
(key: string, value: number)  
(key: string, value: number, hostname: string)  
(key: string, value: number, timestamp: number)  
(key: string, value: number, timestamp: number, hostname: string)  
(key: string, value: number, timestamp: number, ns: number)  
(key: string, value: number, timestamp: number, ns: number, hostname: string)  
```

Adds an item to the request payload. `ns` or `timestamp` can only be set if `timestamps` and `nsTiming` are also set to true respectively.
If `timestamps` and `nsTiming` are true respectively but not set in this request, the current system time will be used.  
The `return` value is self instance, so chaining can be used.

**`.length`**

Just returns the number of items.

**`send()`**

Sends all items that were added to the request payload.
In case of `error`, the previously added items will be kept, for the next `send` invocation.

### Protocol References

- https://www.zabbix.com/documentation/6.0/manual/appendix/items/trapper
- https://www.zabbix.com/documentation/6.0/manual/appendix/protocols/header_datalen

### License

Licensed under the MIT License. See the LICENSE file for details.
