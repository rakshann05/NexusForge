# Cloud Architecture

Local development uses Docker PostgreSQL and filesystem storage. Production deploys the web and API as separate containers behind TLS, with managed PostgreSQL, object storage through an adapter, secrets injected by the runtime, and a single WebSocket-capable API deployment. Scale API workers horizontally with a shared Socket.IO adapter when realtime traffic requires it.
