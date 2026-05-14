export type GameRoomBetPanelState = {
  status: string;
  error?: { message?: string };
  plan?: { preview?: { needsApproval?: boolean } };
};
