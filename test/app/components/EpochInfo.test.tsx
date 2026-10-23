import { act, screen } from '@testing-library/react';
import { EpochInfo } from '@/app/components/EpochInfo.tsx';
import { epochFixture, renderUi } from '../support/fixtures.tsx';

// Absolute slot where epoch 1065 of epochFixture starts; 432,000 slots each.
const EPOCH_START = 460_080_000;
const SLOTS_IN_EPOCH = 432_000;

function epochAt(slotIndex: number, epoch = 1065) {
  return epochFixture({
    epoch,
    slotIndex,
    absoluteSlot: String(
      EPOCH_START + (epoch - 1065) * SLOTS_IN_EPOCH + slotIndex
    ),
  });
}

// Mounts EpochInfo with a reading of /api/epoch arriving at `start` (ms) and
// returns a function for the next readings, which first lets the clock (and
// the one-second countdown) run until their arrival.
function mount(start: number, firstSlotIndex: number) {
  jest.setSystemTime(start);
  const { rerender } = renderUi(<EpochInfo epoch={epochAt(firstSlotIndex)} />);
  return (t: number, slotIndex: number, epoch = 1065) => {
    act(() => {
      jest.advanceTimersByTime(t - Date.now());
    });
    rerender(<EpochInfo epoch={epochAt(slotIndex, epoch)} />);
  };
}

type Read = ReturnType<typeof mount>;

// One reading every 5 s from `from`: the data provider polls every
// measurePollMs and the server refreshes its file on every other poll, so
// with 0.4 s slots the slot moves 25 every 10 s.
function polls(read: Read, from: number, slotIndexes: number[]) {
  slotIndexes.forEach((slotIndex, i) => read(from + i * 5_000, slotIndex));
}

function shows(hms: string) {
  expect(screen.getByText(hms)).toBeInTheDocument();
}

describe('EpochInfo', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('counts down every second and re-anchors on each new sample', () => {
    const read = mount(1_000_000, 431_000);
    // 1,000 slots left at the 0.215 s fallback.
    shows('00:03:35');

    act(() => {
      jest.advanceTimersByTime(1_000);
    });
    shows('00:03:34');

    // The same slot 5 s later is not a sample: the countdown goes on.
    read(1_005_000, 431_000);
    shows('00:03:30');

    // The slot moved since the poll before: a sample, which re-anchors the
    // countdown. One sample does not measure yet: 975 slots × 0.215 s.
    read(1_010_000, 431_025);
    shows('00:03:29');

    // 75 slots in the 30 s since the first sample: 0.4 s per slot, 900 slots
    // left.
    polls(read, 1_015_000, [431_025, 431_050, 431_050, 431_075, 431_075]);
    read(1_040_000, 431_100);
    shows('00:06:00');

    // The next epoch, after the tab was hidden for 364 s. That first reading
    // is not a sample, but the countdown re-anchors on the new epoch with the
    // measured 0.4 s: 431,990 slots left × 0.4 s = 47:59:56.
    read(1_404_000, 10, 1066);
    shows('47:59:56');

    // The next poll is a sample. The samples from before the hidden tab have
    // expired and the measured 0.4 s is kept: 431,978 × 0.4 s.
    read(1_409_000, 22, 1066);
    shows('47:59:51');
  });

  it('does not measure from the first reading, which may be stale', () => {
    // Nobody asked the server for a while: the first reading is the file of
    // the last visit, 10,000 slots behind. 11,000 slots × 0.215 s.
    const read = mount(1_000_000, 421_000);
    shows('00:39:25');

    // The poll after it gets the file that reading refreshed: the first
    // sample, 1,000 slots × 0.215 s.
    read(1_005_000, 431_000);
    shows('00:03:35');

    // 75 slots in 30 s: 0.4 s per slot, 925 slots left. Measured from the
    // first reading it would be 0.0035 s per slot and 00:00:03.
    polls(read, 1_010_000, [431_000, 431_025, 431_025, 431_050, 431_050]);
    read(1_035_000, 431_075);
    shows('00:06:10');
  });

  it('measures and re-anchors when each poll takes 11 s', () => {
    // The requests take 6 s on top of the 5 s wait. The server refreshes
    // its file on every poll: 27.5 slots every 11 s, 0.4 s per slot.
    const read = mount(1_000_000, 300_000);
    const slowPoll = (k: number) =>
      read(1_000_000 + k * 11_000, 300_000 + Math.floor(k * 27.5));
    // 132,000 slots × 0.215 s.
    shows('07:53:00');

    // With no rhythm yet, the second reading (11 s after the first) is not
    // a sample; from the third on they are. 110 slots in the 44 s since the
    // first sample: 0.4 s per slot, 131,835 slots left.
    [1, 2, 3, 4, 5, 6].forEach(slowPoll);
    shows('14:38:54');

    // Each sample re-anchors the countdown. The one at 77 s measured 137
    // slots in 55 s; this one 165 in 66 s: 131,780 slots left × 0.4 s.
    [7, 8].forEach(slowPoll);
    shows('14:38:32');

    // A pause is still a pause: hidden for 120 s, the first reading back
    // carries the file refreshed on the last poll before (slot index
    // 300,247). It is not a sample and the countdown goes on. As a sample it
    // would measure 1 s per slot (36:35:53); re-anchored, 14:38:21.
    read(1_214_000, 300_247);
    shows('14:36:26');
  });

  describe('after a hidden tab', () => {
    // Measured at 0.4 s per slot. The poll at 1,045,000 has the server
    // refresh its file (to slot index 400,112) and the tab is hidden next,
    // with nobody else polling.
    function measured(): Read {
      const read = mount(1_000_000, 400_000);
      polls(read, 1_005_000, [400_000, 400_025, 400_025, 400_050, 400_050]);
      polls(read, 1_030_000, [400_075, 400_075, 400_100, 400_100]);
      // 31,900 slots × 0.4 s from 1,040,000.
      shows('03:32:35');
      return read;
    }

    it('keeps the measured slot time and does not measure from the stale reading', () => {
      const read = measured();

      // Back after 400 s: the first reading is the file refreshed before the
      // tab was hidden. It is not a sample and the countdown goes on.
      read(1_445_000, 400_112);
      shows('03:25:55');

      // The next poll is a sample. The old samples have expired and the
      // measured 0.4 s is kept: 30,875 slots × 0.4 s.
      read(1_450_000, 401_125);
      shows('03:25:50');

      // 75 slots in the 30 s since that sample: still 0.4 s per slot, 30,800
      // slots left. Measured from the stale reading it would be 0.032 s.
      polls(read, 1_455_000, [401_125, 401_150, 401_150, 401_175, 401_175]);
      read(1_480_000, 401_200);
      shows('03:25:20');
    });

    it('measures from the samples before a short one', () => {
      const read = measured();

      // Back after 120 s: the stale first reading is not a sample.
      read(1_165_000, 400_112);
      shows('03:30:35');

      // The next poll is a sample, measured from the one at 1,010,000: 400
      // slots in 160 s, 0.4 s per slot, 31,575 slots left. Taking the stale
      // reading as a sample would give 1.78 s per slot.
      read(1_170_000, 400_425);
      shows('03:30:30');
    });
  });
});
