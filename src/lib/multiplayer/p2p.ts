export type PeerInfo = { id: string; name?: string };
export type P2PRoomOptions = { roomId: string };
export type SignalKind = string;
export type PeerRow = Record<string, unknown>;
export type SignalRow = Record<string, unknown>;
export type RtcPollResponse = Record<string, unknown>;

export const defaultIceServers: RTCIceServer[] = [];

export class P2PRoom {
  constructor(_opts: P2PRoomOptions) {}
}
