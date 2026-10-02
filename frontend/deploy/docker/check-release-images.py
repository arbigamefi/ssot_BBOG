#!/usr/bin/env python3
"""Inspect public manifests in both immutable images before changing services."""
import json
import os
import re
import subprocess


def check(image, revision, chain_id, expected_digest):
    info = json.loads(subprocess.check_output(["docker", "image", "inspect", image]))[0]
    if info["Config"].get("Labels", {}).get("org.opencontainers.image.revision") != revision:
        raise ValueError("application image revision mismatch")
    if info["Config"].get("Labels", {}).get("io.arbigamefi.chain-id") != str(chain_id):
        raise ValueError("application image chain mismatch")
    probe = "const chainId=" + json.dumps(chain_id) + ";const expectedDigest=" + json.dumps(expected_digest) + ";" + r"""
const fs=require('node:fs');
const rows=[];
{
 const files=fs.readdirSync('/app/release-manifests').filter(f=>/^chain-\d+\.json$/.test(f));
 if(files.length!==1||files[0]!=='chain-'+chainId+'.json')process.exit(1);
 const r=JSON.parse(fs.readFileSync('/app/release-manifests/chain-'+chainId+'.json','utf8'));
 if(r.chainId!==chainId||r.isPlaceholder||r.meta?.releaseLock?.schema!=='SSOT_RELEASE_DIGEST_V16')process.exit(1);
 if(r.meta.releaseLock.chainId!==chainId||!/^0x[0-9a-fA-F]{64}$/.test(r.releaseDigest)||r.releaseDigest!==r.meta.releaseLock.digest)process.exit(1);
 if(r.releaseDigest!==expectedDigest)process.exit(1);
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
    chain_id = os.environ.get("DEPLOY_CHAIN_ID", "")
    if chain_id not in ("8453", "84532"):
        raise ValueError("DEPLOY_CHAIN_ID must be 8453 or 84532")
    expected_digest = os.environ.get("EXPECTED_RELEASE_DIGEST", "")
    if not re.fullmatch(r"0x[0-9a-fA-F]{64}", expected_digest):
        raise ValueError("EXPECTED_RELEASE_DIGEST must pin the approved release")
    rows = []
    for kind in ("web", "keeper"):
        image = os.environ.get(kind.upper() + "_IMAGE", "")
        if not re.fullmatch(r"ghcr\.io/arbigamefi/ssot-bbog-" + kind + r"@sha256:[0-9a-f]{64}", image):
            raise ValueError("invalid immutable " + kind + " image")
        rows.append(check(image, revision, int(chain_id), expected_digest))
    if rows[0] != rows[1]:
        raise ValueError("Web and keeper releases differ")
    print(json.dumps({"revision": revision, "releases": rows[0], "status": "verified"}))


if __name__ == "__main__":
    try:
        main()
    except (ValueError, KeyError, subprocess.SubprocessError):
        raise SystemExit("image release verification failed; no deployment was started")
