# Streamint — Crowd-Owned Streaming-Spend DataDAO 🎬📊

Turn your **Netflix / Hulu / Disney+ bills + watch-time** into a shared alt-data asset.  
Contributors keep custody of their CSV/JSON exports, earn $STREAM tokens, and buyers get a real-time panel that links **price paid** → **minutes watched** across platforms.

[![CI](https://img.shields.io/github/actions/workflow/status/zulalakarsu/streamint/ci.yml?label=CI)](../../actions)
[![Last commit](https://img.shields.io/github/last-commit/zulalakarsu/streamint)](../../commits/main)

---

## 💡 Why Streamint?

* **Alt-data gap** – credit-card panels show spend but *not* usage; platform APIs hide churn signals.  
* **User upside** – subscribers co-own & monetise their own data, get “cost-per-minute” dashboards.  
* **Market timing** – streaming inflation & ad-tier pricing are front-page topics in 2025.

---

## Repo Structure

| Path | Purpose | Status |
|------|---------|--------|
| `ui/` | Contributor + Buyer prototype (Next.js / wagmi) | **MVP live** ✅ |
| `packages/refiner/` | Phala TEE function that anonymises & aggregates raw exports | Build OK 🟡 (*deployment next*) |
| `packages/proof/` | Proof-of-contribution stub (tarball released via CI) | OK ✅ |
| `contracts/` | Solidity contracts auto-deployed by Vana CLI | Deployed on **Moksha testnet** |
| `scripts/` | Helper scripts (`deploy`, `register`, etc.) | ✓ |

---

## 🏃‍♀️ Quick Start (Local Dev)

```bash
git clone https://github.com/zulalakarsu/streamint.git
cd streamint

# 1  UI
cd ui
cp .env.example .env.local              # add Google OAuth & Pinata keys
PORT=3001 npm run dev                   # open http://localhost:3001

# 2  Refiner (optional until secrets configured)
# cd packages/refiner && docker build -t streamint-refiner .
