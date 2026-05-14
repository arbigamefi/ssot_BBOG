export type GameBetPanelState = {
  status: string;
  error?: { message?: string };
  plan?: { preview?: { needsApproval?: boolean } };
};
