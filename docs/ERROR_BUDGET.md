# Error Budget

> Track reliability against an SLO to know when to ship features vs. fix bugs.

## Concept

An **error budget** is the maximum allowable error rate before reliability work must take priority over feature work.

- **SLO (Service Level Objective)**: 99.5% success rate (default)
- **Error budget**: 0.5% of requests can fail per measurement window
- **Measurement window**: 24 hours (rolling)

## How It Works

1. structlog (E131) outputs JSON logs with `status_code` for every request
2. `scripts/checks/check-error-budget.sh` parses these logs
3. The script calculates: `success_rate = (total - 5xx) / total * 100`
4. If `success_rate >= SLO`: budget remaining, features can ship
5. If `success_rate < SLO`: budget exhausted, freeze features

## Usage

```bash
# Check error budget from a log file
make error-budget LOG=./server.log

# Or directly
./scripts/checks/check-error-budget.sh ./server.log --slo 99.5
```

## When Budget is Exhausted

1. **Freeze** non-critical feature work
2. **Investigate** recent deployments (check canary deploy guide)
3. **Fix** the reliability issue
4. **Monitor** until the success rate recovers above the SLO
5. **Resume** feature work

## SLO Targets by Environment

| Environment | SLO    | Error Budget |
|-------------|--------|--------------|
| Production  | 99.5%  | 0.5%         |
| Staging     | 99.0%  | 1.0%         |
| Development | 95.0%  | 5.0%         |

## Integration

- **Canary deployments** (docs/CANARY_DEPLOY.md): Check budget before deploying
- **Structlog** (E131): Provides the JSON log data
- **`make doctor-production`**: Could include a budget check in the future
