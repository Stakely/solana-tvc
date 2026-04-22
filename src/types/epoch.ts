export type Epoch = {
  epoch: number;
  slotIndex: number;
  slotsInEpoch: number;
  absoluteSlot: string;
  blockHeight: string;
  transactionCount: string;
  epochCompletedPercent: number;
};

export type GetEpochResponse = Epoch;
