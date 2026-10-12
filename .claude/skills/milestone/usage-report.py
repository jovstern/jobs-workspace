#!/usr/bin/env python3
"""Token use for this project's Claude Code sessions, by agent, model and context size.

Usage: usage-report.py [--since YYYY-MM-DD[THH:MM]] [--until YYYY-MM-DD[THH:MM]]
Cost is an API-price equivalent, useful only for comparing runs with each other.
"""
import argparse
import collections
import glob
import json
import os

PRICES = {"opus": (5, 25), "fable": (5, 25), "sonnet": (3, 15), "haiku": (1, 5)}


def price(model):
    for name, value in PRICES.items():
        if name in (model or ""):
            return value
    return (3, 15)


def load(root, since, until):
    files = sorted(set(glob.glob(root + "/*.jsonl") + glob.glob(root + "/*/subagents/*.jsonl")))
    seen, rows = set(), []
    for path in files:
        agent = "main session"
        if "/subagents/" in path:
            try:
                with open(path.replace(".jsonl", ".meta.json")) as meta:
                    agent = json.load(meta).get("agentType", "subagent")
            except (OSError, ValueError):
                agent = "subagent"
        with open(path) as handle:
            for line in handle:
                try:
                    entry = json.loads(line)
                except ValueError:
                    continue
                if entry.get("type") != "assistant":
                    continue
                message = entry.get("message") or {}
                usage, model = message.get("usage"), message.get("model") or ""
                stamp = entry.get("timestamp", "")
                if not usage or "synthetic" in model:
                    continue
                if (since and stamp < since) or (until and stamp > until):
                    continue
                key = (message.get("id"), entry.get("requestId"))
                if key in seen:
                    continue
                seen.add(key)
                fresh = usage.get("input_tokens", 0)
                write = usage.get("cache_creation_input_tokens", 0)
                read = usage.get("cache_read_input_tokens", 0)
                out = usage.get("output_tokens", 0)
                cin, cout = price(model)
                cost = (fresh * cin + write * cin * 1.25 + read * cin * 0.1 + out * cout) / 1e6
                rows.append((agent, model.replace("claude-", ""), path, fresh + write + read, cost))
    return rows


def main():
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("--since")
    parser.add_argument("--until")
    args = parser.parse_args()

    root = os.path.expanduser("~/.claude/projects/" + os.getcwd().replace("/", "-"))
    rows = load(root, args.since, args.until)
    total = sum(row[4] for row in rows)
    if not rows:
        print("No requests found in", root)
        return

    print(f"{len(rows)} requests, about ${total:.2f} API-equivalent")
    print(f"\n{'agent':<26}{'model':<14}{'runs':>5}{'requests':>10}{'max context':>13}{'cost':>9}{'share':>7}")
    groups = collections.defaultdict(lambda: [set(), 0, 0, 0.0])
    for agent, model, path, context, cost in rows:
        group = groups[(agent, model)]
        group[0].add(path)
        group[1] += 1
        group[2] = max(group[2], context)
        group[3] += cost
    for (agent, model), group in sorted(groups.items(), key=lambda item: -item[1][3]):
        print(
            f"{agent:<26}{model:<14}{len(group[0]):>5}{group[1]:>10}{group[2]:>13,}"
            f"{group[3]:>9.2f}{100 * group[3] / total:>6.0f}%"
        )

    buckets = collections.OrderedDict((name, 0.0) for name in ("under 100k", "100k-200k", "over 200k"))
    for _, _, _, context, cost in rows:
        name = "under 100k" if context < 100_000 else "100k-200k" if context < 200_000 else "over 200k"
        buckets[name] += cost
    print("\nCost by context size of the request:")
    for name, cost in buckets.items():
        print(f"  {name:<12}{100 * cost / total:>5.0f}%")
    print(f"\nLargest context seen: {max(row[3] for row in rows):,} tokens (cap is 200,000)")


if __name__ == "__main__":
    main()
