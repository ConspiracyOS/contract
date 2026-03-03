# contract — ConspiracyOS contract framework

> **Planned** — code currently lives in `conctl/internal/contracts/`.
> Will be extracted here once the interface stabilises.

The contract framework defines YAML invariants that `conctl healthcheck`
evaluates on a systemd timer. Contracts are detective controls — they verify
the system matches its intended state and escalate to `sysadmin` on failure.

## Contract format

```yaml
id: CON-SYS-001
type: detective
description: Disk space above minimum threshold
scope: system
checks:
  - name: disk_free
    command: df -h /
    expect_exit: 0
    on_fail:
      action: escalate
      target: sysadmin
```

## Evaluation

`conctl healthcheck` loads all contracts from `/srv/conos/contracts/`,
evaluates each check, writes results to the audit log, and dispatches
`on_fail` actions for any failures. A summary task is sent to `sysadmin`
if any contracts fail.

## Source

Until this repo is populated, see:
- Contract definitions: `container/configs/default/contracts/`
- Evaluator: `conctl/internal/contracts/`
