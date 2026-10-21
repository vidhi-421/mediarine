#!/usr/bin/env bash
set -o errexit

echo "--- 1. Building React + Vite frontend ---"
npm install
npm run build

echo "--- 2. Installing Python backend dependencies ---"
pip install -r backend/requirements.txt

echo "--- Build complete! ---"
