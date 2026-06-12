PYTHON = python3
NPM = npm

# Setup target, to install dependencies
setup:
	@echo "Installing Python dependencies..."
	pip install -r requirements.txt
	@echo "Installing Node dependencies..."
	$(NPM) install

# Pipeline Target to run data processing and static plot generation sequentially.
pipeline:
	@echo "Initializing database and loading data..."
	$(PYTHON) load_data.py
	@echo "Generating output tables and plots..."

# Dashboard Target to run both the backend and frontend simultaneously.
dashboard:
	@echo "Starting backend and frontend servers..."
	# We use npx concurrently to run two blocking servers in the same terminal
	npx concurrently "./load_data.py server" "npm start"
