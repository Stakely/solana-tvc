# Solana Vote Inclusion Tracker

[solanatvc.com](https://solanatvc.com/) shows how each Solana validator is doing right now under Alpenglow: the share of paying blocks that included its vote (**VIR**, the vote inclusion rate) and its **epoch ratio**.

While the page is open, the site measures every validator about every 5 seconds, so the table shows VIR for all of them. Click **Measure** on a validator to follow it live. Click a column header to sort the table by it.

## How it works

Since epoch 1064, Solana mainnet runs Alpenglow. Votes are no longer on-chain transactions: for each slot, the leader eight slots later puts the votes it has received into its block, a **paying block**. Every validator whose vote is in it earns a fixed amount, set for the whole epoch and proportional to its stake. The vote account's credits counter now holds those rewards in lamports, so ranking by credits would mostly rank validators by stake.

- **VIR** (vote inclusion rate): the share of paying blocks that included the validator's vote, counted from the increase of its reward counter between two readings. It is a count, not an estimate.
- **Epoch ratio**: what the validator has earned so far this epoch compared with the most its stake could have earned, own leader slots included. Healthy validators sit around 0.999.
- **Status**: OK, Missing votes, Not voting, Delinquent, Measuring or Not measurable.

The full method, the colours of the monitor and its limits are explained on [How we measure](https://solanatvc.com/how-we-measure).

## Purpose

This tool is useful when you want a quick real-time overview of what is happening with a validator, for example during a **migration** or any other event where close monitoring is important.

## Important note

The site measures only while someone has the page open, and the table keeps the last 5 minutes of measuring. The data comes from public Solana RPC servers and relies on how Agave currently records rewards; if that changes, the site shows "Measurement under review" instead of numbers.

## Run docker

```
docker build --no-cache --platform=linux/amd64 -t solana-tvc .
docker run --rm --platform=linux/amd64 -p 3000:3000 solana-tvc
```
