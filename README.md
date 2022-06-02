# comms3-transports

This library encapsulate the default comms3 transports:

- P2P
- Websocket
- Livekit

## Integration tests

For livekit/p2p integration test we are using https://www.npmjs.com/package/wrtc, check supported platforms there to see if you OS / node version is compatible.


To start a local livekit instance:

```
docker run --rm -p 7880:7880 \
       -p 7881:7881 \
       -p 7882:7882/udp \
       -v $PWD/test/integration/livekit.yaml:/livekit.yaml \
       livekit/livekit-server \
       --config /livekit.yaml \
       --node-ip 127.0.0.1
```

Make sure to set the required variables in the `.env` file
