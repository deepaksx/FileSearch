#!/usr/bin/env bash
# exit on error
set -o errexit

# Install backend dependencies
pip install -r backend/requirements.txt

# Initialize database
cd backend
python init_db.py
cd ..
