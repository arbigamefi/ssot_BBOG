#!/usr/bin/env python3
"""Inspect public manifests in both immutable images before changing services."""
import json
import os
import re
import subprocess


def check(image, revision):
    info = json.loads(subprocess.check_output(["docker", "image", "inspect", image]))[0]
    if info["Config"].get("Labels", {}).get("org.opencontainers.image.revision") != revision:
        raise ValueError("application image revision mismatch")
    probe = r"""
const fs=require('node:fs');
const rows=[];
for(const chainId of [8453,84532]) {
 const r=JSON.parse(fs.readFileSync('/app/release-manifests/chain-'+chainId+'.json','utf8'));
 if(r.chainId!==chainId||r.isPlaceholder||r.meta?.releaseLock?.schema!=='SSOT_RELEASE_DIGEST_V15')process.exit(1);
 if(r.meta.releaseLock.chainId!==chainId||!/^0x[0-9a-fA-F]{64}$/.test(r.releaseDigest)||r.releaseDigest!==r.meta.releaseLock.digest)process.exit(1);
 rows.push({chainId,digest:r.releaseDigest,gameHub:r.contracts.gameHub,banks:r.assets.map(a=>a.bank)});
}
console.log(JSON.stringify(rows));
"""
    return json.loads(subprocess.check_output([
        "docker", "run", "--rm", "--read-only", "--network", "none",
        "--entrypoint", "node", image, "-e", probe,
    ], timeout=20, stderr=subprocess.DEVNULL))


def main():
    revision = os.environ.get("EXPECTED_REVISION", "")
    if not re.fullmatch(r"[0-9a-f]{40}", revision):
        raise ValueError("EXPECTED_REVISION must be a full commit")
    rows = []
    for kind in ("web", "keeper"):
        image = os.environ.get(kind.upper() + "_IMAGE", "")
        if not re.fullmatch(r"ghcr\.io/arbigamefi/ssot-bbog-" + kind + r"@sha256:[0-9a-f]{64}", image):
            raise ValueError("invalid immutable " + kind + " image")
        rows.append(check(image, revision))
    if rows[0] != rows[1]:
        raise ValueError("Web and keeper releases differ")
    print(json.dumps({"revision": revision, "releases": rows[0], "status": "verified"}))


if __name__ == "__main__":
    try:
        main()
    except (ValueError, KeyError, subprocess.SubprocessError):
        raise SystemExit("v1.5 image verification failed; no deployment was started")
