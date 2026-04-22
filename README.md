# Solana TVC
[Solana TVC](https://solanatvc.com/) is a project that allows you to monitor a validator’s performance in the TVC ranking in real time.

It helps you track ranking movements as they happen, so you can quickly spot when a validator goes up or down in the leaderboard. It also lets you **zoom in** on a specific validator and observe that validator’s voting results over the period of time you are monitoring it.

## How it works

The application continuously polls `solana validators` to retrieve:

- the latest voted slot
- the number of credits

Samples are taken over time and used to provide a near real-time view of validator behavior and ranking changes.

## Purpose

This tool is useful when you want a quick real-time overview of what is happening with a validator, for example during a **migration** or any other event where close monitoring is important.

## Important note

This application is designed to give you a **real-time approximation** of validator performance and voting activity.

Because it relies on polling `solana validators` and sampling data over time, it should be considered a monitoring aid rather than a precision analytics tool.

If you need a higher level of accuracy, there are other tools available that are better suited for deep or highly precise analysis.
## Run docker

```
docker build --no-cache --platform=linux/amd64 -t solana-tvc .
docker run --rm --platform=linux/amd64 -p 3000:3000 solana-tvc
```
